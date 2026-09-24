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
	heartbeat     = 30 * time.Second // ping + presence refresh + revocation check
	presenceTTL   = 90 * time.Second // a connection counts as online this long after its last heartbeat
	maxFrameBytes = 4096
	maxWatched    = 200
	framesPerSec  = 20
)

// Close codes clients act on (TZ BE-15). StatusServiceRestart (1012): this instance is
// shutting down, reconnect (to another one) and fetch what was missed over REST.
// StatusSessionRevoked: the session was signed out, revoked or its user blocked; don't
// reconnect with it.
const StatusSessionRevoked websocket.StatusCode = 4001

// revokeChannel carries comma-separated ids of revoked sessions (auth.RevocationStore
// publishes them). Every instance listens and closes their sockets at once.
const revokeChannel = "rt:revoke"

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
//
// The registry is split into shards (by user, watched user or session id), each with its
// own lock, so delivering an event to one user never waits for unrelated connects,
// disconnects or presence watches (TZ BE-15).
type Hub struct {
	// Audience limits who sees whose presence (TZ SEC-05); set it before serving.
	Audience Audience
	// RevokedKey names the Redis marker of a revoked session (auth.RevokedKey). With it a
	// connection is refused when its session is already revoked, and the heartbeat closes
	// it if a revocation message was missed. Set it before serving.
	RevokedKey func(sessionID uuid.UUID) string

	rdb    *redis.Client
	ps     *redis.PubSub
	log    *slog.Logger
	shards []shard

	life     sync.Mutex // guards stopping and conns.Add
	stopping bool
	conns    sync.WaitGroup // Serve calls in flight
}

func NewHub(ctx context.Context, rdb *redis.Client, log *slog.Logger) *Hub {
	return newHub(ctx, rdb, log, defaultShards)
}

func newHub(ctx context.Context, rdb *redis.Client, log *slog.Logger, shards int) *Hub {
	h := &Hub{rdb: rdb, ps: rdb.Subscribe(ctx, revokeChannel), log: log, shards: newShards(shards)}
	go h.run()
	return h
}

// Close stops the Redis subscription (after Shutdown).
func (h *Hub) Close() error { return h.ps.Close() }

func (h *Hub) run() {
	for msg := range h.ps.Channel() {
		switch {
		case strings.HasPrefix(msg.Channel, "rt:u:"):
			h.deliver(msg.Channel[5:], []byte(msg.Payload), false)
		case strings.HasPrefix(msg.Channel, "rt:p:"):
			h.deliver(msg.Channel[5:], []byte(msg.Payload), true)
		case msg.Channel == revokeChannel:
			h.closeSessions(msg.Payload)
		}
	}
}

// deliver queues payload on every local connection of a user (or watching a user's
// presence). Only that user's shard is read-locked.
func (h *Hub) deliver(rawID string, payload []byte, presence bool) {
	id, err := uuid.Parse(rawID)
	if err != nil {
		return
	}
	sh := h.shardOf(id)
	sh.mu.RLock()
	set := sh.users[id]
	if presence {
		set = sh.watchers[id]
	}
	for c := range set {
		c.enqueue(payload)
	}
	sh.mu.RUnlock()
}

// closeSessions closes the local connections opened with any of the revoked sessions.
func (h *Hub) closeSessions(payload string) {
	for _, raw := range strings.Split(payload, ",") {
		sid, err := uuid.Parse(strings.TrimSpace(raw))
		if err != nil {
			continue
		}
		sh := h.shardOf(sid)
		sh.mu.RLock()
		conns := make([]*Conn, 0, len(sh.sessions[sid]))
		for c := range sh.sessions[sid] {
			conns = append(conns, c)
		}
		sh.mu.RUnlock()
		for _, c := range conns {
			c.shutdown(StatusSessionRevoked, "session revoked")
		}
	}
}

// Shutdown closes every connection with 1012 (service restart) so clients reconnect to
// another instance and catch up over REST, then waits until their handlers returned or
// ctx ends (TZ BE-15, OPS-07). New connections are refused from now on. It returns the
// number of connections closed.
func (h *Hub) Shutdown(ctx context.Context) int {
	h.life.Lock()
	h.stopping = true
	h.life.Unlock()

	var all []*Conn
	for i := range h.shards {
		sh := &h.shards[i]
		sh.mu.RLock()
		for _, set := range sh.users {
			for c := range set {
				all = append(all, c)
			}
		}
		sh.mu.RUnlock()
	}
	for _, c := range all {
		c.shutdown(websocket.StatusServiceRestart, "server restarting")
	}
	done := make(chan struct{})
	go func() { h.conns.Wait(); close(done) }()
	select {
	case <-done:
	case <-ctx.Done():
		h.log.Warn("websocket connections still open after the shutdown timeout", "closed", len(all))
	}
	return len(all)
}

// track counts a new connection unless the hub is shutting down.
func (h *Hub) track() bool {
	h.life.Lock()
	defer h.life.Unlock()
	if h.stopping {
		return false
	}
	h.conns.Add(1)
	return true
}

// Conn is one client WebSocket.
type Conn struct {
	hub       *Hub
	ws        *websocket.Conn
	UserID    uuid.UUID
	SessionID uuid.UUID // uuid.Nil for tickets issued before sessions were bound
	id        string
	send      chan []byte
	mu        sync.Mutex
	watching  map[uuid.UUID]struct{} // guarded by mu
	closed    chan struct{}
	once      sync.Once
	code      websocket.StatusCode // why the server closed it; set once, before closed is closed
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
		c.code = code
		close(c.closed)
		wsClosed.WithLabelValues(closeReason(code)).Inc()
		go c.ws.Close(code, reason)
	})
}

// Serve runs a connection until the client leaves, the server closes it, or ctx ends.
// sessionID binds the socket to the session its ticket was issued for (uuid.Nil: none).
func (h *Hub) Serve(ctx context.Context, ws *websocket.Conn, userID, sessionID uuid.UUID, frames FrameHandler) {
	if !h.track() {
		_ = ws.Close(websocket.StatusServiceRestart, "server restarting")
		return
	}
	defer h.conns.Done()
	ws.SetReadLimit(maxFrameBytes)
	c := &Conn{hub: h, ws: ws, UserID: userID, SessionID: sessionID, id: random.Base36(12),
		send: make(chan []byte, sendBuffer), watching: map[uuid.UUID]struct{}{}, closed: make(chan struct{})}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	wsConnections.Inc()
	defer wsConnections.Dec()
	ok := h.register(ctx, c)
	defer h.unregister(context.WithoutCancel(ctx), c)
	if !ok {
		return // closed with StatusSessionRevoked; Close finishes the handshake itself
	}

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
			if c.hub.touchPresence(ctx, c) {
				c.shutdown(StatusSessionRevoked, "session revoked")
				return
			}
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
//
// A channel is subscribed by the first local connection that needs it and unsubscribed by
// the last one leaving, both while holding the key's shard lock, so a connect and a
// disconnect of the same user can't leave the subscription in the wrong state.

// register adds c to the registry and marks the user online. It returns false (and has
// closed c) when c's session is already revoked.
func (h *Hub) register(ctx context.Context, c *Conn) bool {
	us := h.shardOf(c.UserID)
	us.mu.Lock()
	if add(us.users, c.UserID, c) {
		if err := h.ps.Subscribe(ctx, userChannel(c.UserID)); err != nil {
			h.log.Warn("subscribe", "err", err)
		}
	}
	us.mu.Unlock()
	// Registered under its session before the revocation check below, so a revocation
	// landing in between is caught by one or the other.
	if c.SessionID != uuid.Nil {
		ss := h.shardOf(c.SessionID)
		ss.mu.Lock()
		add(ss.sessions, c.SessionID, c)
		ss.mu.Unlock()
	}
	h.syncHidden(ctx, c.UserID)
	if h.touchPresence(ctx, c) {
		c.shutdown(StatusSessionRevoked, "session revoked")
		return false
	}
	c.event(Event{Type: "ready", Data: map[string]string{"user_id": c.UserID.String()}})
	return true
}

func (h *Hub) unregister(ctx context.Context, c *Conn) {
	us := h.shardOf(c.UserID)
	us.mu.Lock()
	if remove(us.users, c.UserID, c) {
		_ = h.ps.Unsubscribe(ctx, userChannel(c.UserID))
	}
	us.mu.Unlock()
	if c.SessionID != uuid.Nil {
		ss := h.shardOf(c.SessionID)
		ss.mu.Lock()
		remove(ss.sessions, c.SessionID, c)
		ss.mu.Unlock()
	}
	c.mu.Lock()
	watching := c.watching
	c.watching = nil
	c.mu.Unlock()
	h.updateWatchers(ctx, c, nil, keys(watching))

	// A restarting instance keeps the user's presence entry: the client reconnects to
	// another instance within seconds, so watchers see no offline/online flap (the entry
	// expires by itself after presenceTTL if it doesn't).
	if c.code != websocket.StatusServiceRestart {
		h.dropPresence(ctx, c)
	}
}

// watch replaces the set of users whose presence c follows and sends their current state.
// Only users c may see are followed (TZ SEC-05); the others are dropped silently.
func (h *Hub) watch(ctx context.Context, c *Conn, ids []uuid.UUID) {
	if len(ids) > maxWatched {
		ids = ids[:maxWatched]
	}
	states, err := h.VisiblePresence(ctx, c.UserID, ids, false)
	if err != nil {
		h.log.Warn("presence audience", "err", err)
		return
	}
	want := make(map[uuid.UUID]struct{}, len(states))
	for _, st := range states {
		want[st.UserID] = struct{}{}
	}
	var added, dropped []uuid.UUID
	c.mu.Lock()
	if c.watching == nil { // closing
		c.mu.Unlock()
		return
	}
	for id := range c.watching {
		if _, keep := want[id]; !keep {
			delete(c.watching, id)
			dropped = append(dropped, id)
		}
	}
	for id := range want {
		if _, has := c.watching[id]; !has {
			c.watching[id] = struct{}{}
			added = append(added, id)
		}
	}
	c.mu.Unlock()
	h.updateWatchers(ctx, c, added, dropped)
	c.event(Event{Type: "presence.snapshot", Data: states})
}

// updateWatchers adds c as a watcher of added and removes it from dropped, one lock and
// at most one (un)subscribe command per shard.
func (h *Hub) updateWatchers(ctx context.Context, c *Conn, added, dropped []uuid.UUID) {
	if len(added)+len(dropped) == 0 {
		return
	}
	type change struct{ add, drop []uuid.UUID }
	byShard := map[*shard]*change{}
	at := func(id uuid.UUID) *change {
		sh := h.shardOf(id)
		ch := byShard[sh]
		if ch == nil {
			ch = &change{}
			byShard[sh] = ch
		}
		return ch
	}
	for _, id := range added {
		at(id).add = append(at(id).add, id)
	}
	for _, id := range dropped {
		at(id).drop = append(at(id).drop, id)
	}
	for sh, ch := range byShard {
		var sub, unsub []string
		sh.mu.Lock()
		for _, id := range ch.drop {
			if remove(sh.watchers, id, c) {
				unsub = append(unsub, presenceChannel(id))
			}
		}
		for _, id := range ch.add {
			if add(sh.watchers, id, c) {
				sub = append(sub, presenceChannel(id))
			}
		}
		if len(unsub) > 0 {
			_ = h.ps.Unsubscribe(ctx, unsub...)
		}
		if len(sub) > 0 {
			if err := h.ps.Subscribe(ctx, sub...); err != nil {
				h.log.Warn("subscribe", "err", err)
			}
		}
		sh.mu.Unlock()
	}
}

func keys(m map[uuid.UUID]struct{}) []uuid.UUID {
	out := make([]uuid.UUID, 0, len(m))
	for id := range m {
		out = append(out, id)
	}
	return out
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

// touchPresence refreshes c's presence entry and, in the same round trip, checks whether
// its session has been revoked; it reports the latter (the caller closes the socket).
func (h *Hub) touchPresence(ctx context.Context, c *Conn) (revoked bool) {
	key := presenceKey(c.UserID)
	now := time.Now()
	pipe := h.rdb.TxPipeline()
	pipe.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(now.Unix(), 10))
	pipe.ZAdd(ctx, key, redis.Z{Score: float64(now.Add(presenceTTL).Unix()), Member: c.id})
	card := pipe.ZCard(ctx, key)
	pipe.Expire(ctx, key, 2*presenceTTL)
	hidden := pipe.Exists(ctx, hiddenKey(c.UserID))
	var gone *redis.IntCmd
	if h.RevokedKey != nil && c.SessionID != uuid.Nil {
		gone = pipe.Exists(ctx, h.RevokedKey(c.SessionID))
	}
	if _, err := pipe.Exec(ctx); err != nil {
		h.log.Warn("presence", "err", err)
		return false // fail open, like the request gate
	}
	if gone != nil && gone.Val() > 0 {
		return true
	}
	if card.Val() == 1 && hidden.Val() == 0 { // this connection just brought the user online
		h.announce(ctx, PresenceState{UserID: c.UserID, Online: true})
	}
	return false
}

func (h *Hub) dropPresence(ctx context.Context, c *Conn) {
	key := presenceKey(c.UserID)
	now := time.Now()
	pipe := h.rdb.TxPipeline()
	pipe.ZRem(ctx, key, c.id)
	pipe.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(now.Unix(), 10))
	card := pipe.ZCard(ctx, key)
	pipe.Set(ctx, lastSeenKey(c.UserID), now.Unix(), 30*24*time.Hour)
	hidden := pipe.Exists(ctx, hiddenKey(c.UserID))
	if _, err := pipe.Exec(ctx); err != nil {
		return
	}
	if card.Val() == 0 && hidden.Val() == 0 {
		h.announce(ctx, PresenceState{UserID: c.UserID, Online: false, LastSeenAt: &now})
	}
}

func (h *Hub) announce(ctx context.Context, st PresenceState) { h.publish(ctx, st) }

// publish sends a presence change to everyone watching the user (only viewers allowed by
// the Audience ever subscribe to it).
func (h *Hub) publish(ctx context.Context, st PresenceState) {
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
