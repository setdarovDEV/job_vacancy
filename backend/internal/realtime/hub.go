package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/internal/pkg/random"
)

const (
	sendBuffer    = 64               // events queued per connection before it's considered stuck
	writeTimeout  = 10 * time.Second //
	heartbeat     = 30 * time.Second // ping + presence refresh
	presenceTTL   = 90 * time.Second // a connection counts as online this long after its last heartbeat
	maxFrameBytes = 4096
	maxWatched    = 200
	framesPerSec  = 20
)

// Frame is a client → server WebSocket message.
type Frame struct {
	Type           string      `json:"type"` // ping | typing | read | watch_presence
	ConversationID uuid.UUID   `json:"conversation_id"`
	MessageID      int64       `json:"message_id"`
	UserIDs        []uuid.UUID `json:"user_ids"`
}

// FrameHandler implements the application frames (typing, read receipts).
type FrameHandler interface {
	HandleFrame(ctx context.Context, userID uuid.UUID, f Frame) error
}

// Hub owns this instance's WebSocket connections and one Redis subscription through
// which it receives events for the users connected here. Channels are subscribed while
// at least one local connection needs them and unsubscribed afterwards.
type Hub struct {
	rdb      *redis.Client
	ps       *redis.PubSub
	log      *slog.Logger
	mu       sync.Mutex
	users    map[uuid.UUID]map[*Conn]struct{} // connections per user
	watchers map[uuid.UUID]map[*Conn]struct{} // connections watching a user's presence
}

func NewHub(ctx context.Context, rdb *redis.Client, log *slog.Logger) *Hub {
	h := &Hub{
		rdb: rdb, ps: rdb.Subscribe(ctx), log: log,
		users: map[uuid.UUID]map[*Conn]struct{}{}, watchers: map[uuid.UUID]map[*Conn]struct{}{},
	}
	go h.run()
	return h
}

func (h *Hub) Close() error { return h.ps.Close() }

func (h *Hub) run() {
	for msg := range h.ps.Channel() {
		var id uuid.UUID
		var set map[uuid.UUID]map[*Conn]struct{}
		switch {
		case strings.HasPrefix(msg.Channel, "rt:u:"):
			id, _ = uuid.Parse(msg.Channel[5:])
			set = h.users
		case strings.HasPrefix(msg.Channel, "rt:p:"):
			id, _ = uuid.Parse(msg.Channel[5:])
			set = h.watchers
		default:
			continue
		}
		payload := []byte(msg.Payload)
		h.mu.Lock()
		for c := range set[id] {
			c.enqueue(payload)
		}
		h.mu.Unlock()
	}
}

// Conn is one client WebSocket.
type Conn struct {
	hub      *Hub
	ws       *websocket.Conn
	UserID   uuid.UUID
	id       string
	send     chan []byte
	watching map[uuid.UUID]struct{} // guarded by hub.mu
	closed   chan struct{}
	once     sync.Once
}

func (c *Conn) enqueue(b []byte) {
	select {
	case c.send <- b:
	default: // a client that can't keep up is dropped; it reconnects and catches up via REST
		c.shutdown(websocket.StatusPolicyViolation, "too slow")
	}
}

func (c *Conn) shutdown(code websocket.StatusCode, reason string) {
	c.once.Do(func() {
		close(c.closed)
		go c.ws.Close(code, reason)
	})
}

// Serve runs a connection until the client leaves or ctx ends.
func (h *Hub) Serve(ctx context.Context, ws *websocket.Conn, userID uuid.UUID, frames FrameHandler) {
	ws.SetReadLimit(maxFrameBytes)
	c := &Conn{hub: h, ws: ws, UserID: userID, id: random.Base36(12), send: make(chan []byte, sendBuffer),
		watching: map[uuid.UUID]struct{}{}, closed: make(chan struct{})}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	h.register(ctx, c)
	defer h.unregister(context.WithoutCancel(ctx), c)

	go c.writeLoop(ctx)
	c.readLoop(ctx, frames)
	c.shutdown(websocket.StatusNormalClosure, "")
}

func (c *Conn) writeLoop(ctx context.Context) {
	t := time.NewTicker(heartbeat)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-c.closed:
			return
		case b := <-c.send:
			wctx, cancel := context.WithTimeout(ctx, writeTimeout)
			err := c.ws.Write(wctx, websocket.MessageText, b)
			cancel()
			if err != nil {
				c.shutdown(websocket.StatusGoingAway, "write failed")
				return
			}
		case <-t.C:
			pctx, cancel := context.WithTimeout(ctx, writeTimeout)
			err := c.ws.Ping(pctx)
			cancel()
			if err != nil {
				c.shutdown(websocket.StatusGoingAway, "ping failed")
				return
			}
			c.hub.touchPresence(ctx, c)
		}
	}
}

func (c *Conn) readLoop(ctx context.Context, frames FrameHandler) {
	window, count := time.Now(), 0
	for {
		_, data, err := c.ws.Read(ctx)
		if err != nil {
			return
		}
		if now := time.Now(); now.Sub(window) > time.Second {
			window, count = now, 0
		}
		if count++; count > framesPerSec {
			c.shutdown(websocket.StatusPolicyViolation, "rate limited")
			return
		}
		var f Frame
		if json.Unmarshal(data, &f) != nil {
			continue
		}
		switch f.Type {
		case "ping":
			c.event(Event{Type: "pong", Data: map[string]int64{"ts": time.Now().UnixMilli()}})
		case "watch_presence":
			c.hub.watch(ctx, c, f.UserIDs)
		default:
			if err := frames.HandleFrame(ctx, c.UserID, f); err != nil && !errors.Is(err, context.Canceled) {
				c.event(Event{Type: "error", Data: map[string]string{"frame": f.Type, "message": err.Error()}})
			}
		}
	}
}

func (c *Conn) event(ev Event) {
	if b, err := json.Marshal(ev); err == nil {
		c.enqueue(b)
	}
}

// ---- subscriptions -----------------------------------------------------------------------

func (h *Hub) register(ctx context.Context, c *Conn) {
	h.mu.Lock()
	first := len(h.users[c.UserID]) == 0
	if first {
		h.users[c.UserID] = map[*Conn]struct{}{}
	}
	h.users[c.UserID][c] = struct{}{}
	h.mu.Unlock()
	if first {
		if err := h.ps.Subscribe(ctx, userChannel(c.UserID)); err != nil {
			h.log.Warn("subscribe", "err", err)
		}
	}
	h.touchPresence(ctx, c)
	c.event(Event{Type: "ready", Data: map[string]string{"user_id": c.UserID.String()}})
}

func (h *Hub) unregister(ctx context.Context, c *Conn) {
	h.mu.Lock()
	delete(h.users[c.UserID], c)
	last := len(h.users[c.UserID]) == 0
	if last {
		delete(h.users, c.UserID)
	}
	var unwatch []string
	for id := range c.watching {
		delete(h.watchers[id], c)
		if len(h.watchers[id]) == 0 {
			delete(h.watchers, id)
			unwatch = append(unwatch, presenceChannel(id))
		}
	}
	h.mu.Unlock()
	if last {
		unwatch = append(unwatch, userChannel(c.UserID))
	}
	if len(unwatch) > 0 {
		_ = h.ps.Unsubscribe(ctx, unwatch...)
	}
	h.dropPresence(ctx, c)
}

// watch replaces the set of users whose presence c follows and sends their current state.
func (h *Hub) watch(ctx context.Context, c *Conn, ids []uuid.UUID) {
	if len(ids) > maxWatched {
		ids = ids[:maxWatched]
	}
	want := map[uuid.UUID]struct{}{}
	for _, id := range ids {
		want[id] = struct{}{}
	}
	var sub, unsub []string
	h.mu.Lock()
	for id := range c.watching {
		if _, keep := want[id]; !keep {
			delete(c.watching, id)
			delete(h.watchers[id], c)
			if len(h.watchers[id]) == 0 {
				delete(h.watchers, id)
				unsub = append(unsub, presenceChannel(id))
			}
		}
	}
	for id := range want {
		if _, has := c.watching[id]; has {
			continue
		}
		c.watching[id] = struct{}{}
		if h.watchers[id] == nil {
			h.watchers[id] = map[*Conn]struct{}{}
			sub = append(sub, presenceChannel(id))
		}
		h.watchers[id][c] = struct{}{}
	}
	h.mu.Unlock()
	if len(unsub) > 0 {
		_ = h.ps.Unsubscribe(ctx, unsub...)
	}
	if len(sub) > 0 {
		_ = h.ps.Subscribe(ctx, sub...)
	}
	states, err := h.Presence(ctx, ids)
	if err == nil {
		c.event(Event{Type: "presence.snapshot", Data: states})
	}
}

// ---- presence ----------------------------------------------------------------------------

// A user is online while any of their connections (on any instance) has a fresh entry in
// the sorted set presence:<id>, scored by expiry time.

type PresenceState struct {
	UserID     uuid.UUID  `json:"user_id"`
	Online     bool       `json:"online"`
	LastSeenAt *time.Time `json:"last_seen_at"`
}

func presenceKey(id uuid.UUID) string { return "presence:" + id.String() }
func lastSeenKey(id uuid.UUID) string { return "presence:last:" + id.String() }

func (h *Hub) touchPresence(ctx context.Context, c *Conn) {
	key := presenceKey(c.UserID)
	now := time.Now()
	pipe := h.rdb.TxPipeline()
	pipe.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(now.Unix(), 10))
	pipe.ZAdd(ctx, key, redis.Z{Score: float64(now.Add(presenceTTL).Unix()), Member: c.id})
	card := pipe.ZCard(ctx, key)
	pipe.Expire(ctx, key, 2*presenceTTL)
	if _, err := pipe.Exec(ctx); err != nil {
		h.log.Warn("presence", "err", err)
		return
	}
	if card.Val() == 1 { // this connection just brought the user online
		h.announce(ctx, PresenceState{UserID: c.UserID, Online: true})
	}
}

func (h *Hub) dropPresence(ctx context.Context, c *Conn) {
	key := presenceKey(c.UserID)
	now := time.Now()
	pipe := h.rdb.TxPipeline()
	pipe.ZRem(ctx, key, c.id)
	pipe.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(now.Unix(), 10))
	card := pipe.ZCard(ctx, key)
	pipe.Set(ctx, lastSeenKey(c.UserID), now.Unix(), 30*24*time.Hour)
	if _, err := pipe.Exec(ctx); err != nil {
		return
	}
	if card.Val() == 0 {
		h.announce(ctx, PresenceState{UserID: c.UserID, Online: false, LastSeenAt: &now})
	}
}

func (h *Hub) announce(ctx context.Context, st PresenceState) {
	b, _ := json.Marshal(Event{Type: "presence", Data: st})
	_ = h.rdb.Publish(ctx, presenceChannel(st.UserID), b).Err()
}

// Presence reports who of ids is online right now.
func (h *Hub) Presence(ctx context.Context, ids []uuid.UUID) ([]PresenceState, error) {
	now := strconv.FormatInt(time.Now().Unix(), 10)
	pipe := h.rdb.Pipeline()
	counts := make([]*redis.IntCmd, len(ids))
	last := make([]*redis.StringCmd, len(ids))
	for i, id := range ids {
		counts[i] = pipe.ZCount(ctx, presenceKey(id), now, "+inf")
		last[i] = pipe.Get(ctx, lastSeenKey(id))
	}
	if _, err := pipe.Exec(ctx); err != nil && !errors.Is(err, redis.Nil) {
		return nil, err
	}
	out := make([]PresenceState, len(ids))
	for i, id := range ids {
		out[i] = PresenceState{UserID: id, Online: counts[i].Val() > 0}
		if ts, err := last[i].Int64(); err == nil && !out[i].Online {
			t := time.Unix(ts, 0).UTC()
			out[i].LastSeenAt = &t
		}
	}
	return out, nil
}

// IsOnline is a single-user shortcut used to decide on offline notifications.
func (h *Hub) IsOnline(ctx context.Context, id uuid.UUID) bool {
	st, err := h.Presence(ctx, []uuid.UUID{id})
	return err == nil && len(st) == 1 && st[0].Online
}
