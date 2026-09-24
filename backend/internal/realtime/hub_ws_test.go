package realtime_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/coder/websocket"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/internal/modules/auth"
	"jobvacancy.uz/backend/internal/realtime"
)

type noFrames struct{}

func (noFrames) HandleFrame(context.Context, uuid.UUID, realtime.Frame) error { return nil }

type rig struct {
	t   *testing.T
	mr  *miniredis.Miniredis
	rdb *redis.Client
	hub *realtime.Hub
	srv *httptest.Server
}

// newRig serves hub.Serve on a test server; the user and session come from the query.
func newRig(t *testing.T) *rig {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	hub := realtime.NewHub(context.Background(), rdb, log)
	hub.RevokedKey = auth.RevokedKey
	t.Cleanup(func() { _ = hub.Close() })
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid := uuid.MustParse(r.URL.Query().Get("u"))
		sid, _ := uuid.Parse(r.URL.Query().Get("s"))
		ws, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		hub.Serve(r.Context(), ws, uid, sid, noFrames{})
	}))
	t.Cleanup(srv.Close)
	return &rig{t: t, mr: mr, rdb: rdb, hub: hub, srv: srv}
}

type client struct {
	ws     *websocket.Conn
	events chan map[string]any
	closed chan websocket.StatusCode
}

// dial connects as user/session and returns once the first frame arrived (normally
// "ready"; a refused connection closes instead).
func (g *rig) dial(user, session uuid.UUID) *client {
	g.t.Helper()
	url := strings.Replace(g.srv.URL, "http", "ws", 1) + "/?u=" + user.String() + "&s=" + session.String()
	ws, _, err := websocket.Dial(context.Background(), url, nil)
	if err != nil {
		g.t.Fatal(err)
	}
	c := &client{ws: ws, events: make(chan map[string]any, 64), closed: make(chan websocket.StatusCode, 1)}
	go func() {
		for {
			_, b, err := ws.Read(context.Background())
			if err != nil {
				c.closed <- websocket.CloseStatus(err)
				return
			}
			var ev map[string]any
			_ = json.Unmarshal(b, &ev)
			c.events <- ev
		}
	}()
	g.t.Cleanup(func() { _ = ws.CloseNow() })
	return c
}

func (c *client) next(t *testing.T) (map[string]any, websocket.StatusCode) {
	t.Helper()
	select {
	case ev := <-c.events:
		return ev, 0
	case code := <-c.closed:
		return nil, code
	case <-time.After(3 * time.Second):
		t.Fatal("no event within 3s")
		return nil, 0
	}
}

func (c *client) waitClose(t *testing.T) websocket.StatusCode {
	t.Helper()
	deadline := time.After(3 * time.Second)
	for {
		select {
		case <-c.events:
		case code := <-c.closed:
			return code
		case <-deadline:
			t.Fatal("socket not closed within 3s")
			return 0
		}
	}
}

func (c *client) ready(t *testing.T) {
	t.Helper()
	if ev, code := c.next(t); ev == nil || ev["type"] != "ready" {
		t.Fatalf("want ready, got %v (close %d)", ev, code)
	}
}

// TZ BE-15 / SEC-05: revoking a session (sign-out, revoke from the device list, password
// change, blocking) closes the sockets opened with it at once, with 4001; the same user's
// other sessions keep theirs.
func TestRevokedSessionClosesItsSocket(t *testing.T) {
	g := newRig(t)
	user, s1, s2 := uuid.New(), uuid.New(), uuid.New()
	a := g.dial(user, s1)
	a.ready(t)
	b := g.dial(user, s2)
	b.ready(t)

	start := time.Now()
	if err := auth.NewRevocationStore(g.rdb, 15*time.Minute).Revoke(context.Background(), s1); err != nil {
		t.Fatal(err)
	}
	if code := a.waitClose(t); code != realtime.StatusSessionRevoked {
		t.Fatalf("revoked session closed with %d, want %d", code, realtime.StatusSessionRevoked)
	}
	t.Logf("socket closed %v after the revocation", time.Since(start).Round(time.Millisecond))

	// The other session still gets events.
	_ = (&realtime.Publisher{RDB: g.rdb}).ToUsers(context.Background(), []uuid.UUID{user}, realtime.Event{Type: "ping.test"})
	if ev, code := b.next(t); ev == nil || ev["type"] != "ping.test" {
		t.Fatalf("other session: got %v (close %d)", ev, code)
	}

	// A ticket redeemed after its session was revoked never gets "ready".
	c := g.dial(user, s1)
	if ev, code := c.next(t); ev != nil || code != realtime.StatusSessionRevoked {
		t.Fatalf("revoked session connected: event %v, close %d", ev, code)
	}
}

// TZ BE-15: on shutdown every socket gets 1012 (service restart) so the client reconnects
// to another instance and catches up over REST; the user's presence entry is kept for
// that reconnect, and new connections are refused with 1012 too.
func TestShutdownClosesWithServiceRestart(t *testing.T) {
	g := newRig(t)
	users := make([]uuid.UUID, 5)
	clients := make([]*client, len(users))
	for i := range users {
		users[i] = uuid.New()
		clients[i] = g.dial(users[i], uuid.New())
		clients[i].ready(t)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	start := time.Now()
	if n := g.hub.Shutdown(ctx); n != len(users) {
		t.Fatalf("Shutdown closed %d connections, want %d", n, len(users))
	}
	t.Logf("shutdown finished in %v", time.Since(start).Round(time.Millisecond))
	for i, c := range clients {
		if code := c.waitClose(t); code != websocket.StatusServiceRestart {
			t.Fatalf("client %d closed with %d, want 1012", i, code)
		}
	}
	st, err := g.hub.Presence(context.Background(), users)
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range st {
		if !s.Online {
			t.Fatalf("presence dropped on restart for %s: clients would flap offline", s.UserID)
		}
	}
	late := g.dial(uuid.New(), uuid.New())
	if ev, code := late.next(t); ev != nil || code != websocket.StatusServiceRestart {
		t.Fatalf("connection during shutdown: event %v, close %d", ev, code)
	}
}

// The sharded registry under concurrent connects, disconnects and deliveries (run with
// -race): every connected client gets exactly the events sent to its user, and nothing
// stays subscribed or registered afterwards.
func TestShardedHubConcurrentFanOut(t *testing.T) {
	g := newRig(t)
	pub := &realtime.Publisher{RDB: g.rdb}
	const users, perUser, events = 16, 3, 20
	var wg sync.WaitGroup
	errs := make(chan error, users*perUser)
	for u := 0; u < users; u++ {
		user := uuid.New()
		conns := make([]*client, perUser)
		for i := range conns {
			conns[i] = g.dial(user, uuid.New())
			conns[i].ready(t)
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			for e := 0; e < events; e++ {
				_ = pub.ToUsers(context.Background(), []uuid.UUID{user}, realtime.Event{Type: fmt.Sprintf("e%d", e)})
			}
		}()
		for _, c := range conns {
			wg.Add(1)
			go func(c *client) {
				defer wg.Done()
				for e := 0; e < events; e++ {
					select {
					case ev := <-c.events:
						if ev["type"] != fmt.Sprintf("e%d", e) {
							errs <- fmt.Errorf("user %s: got %v, want e%d", user, ev["type"], e)
							return
						}
					case <-time.After(5 * time.Second):
						errs <- fmt.Errorf("user %s: event e%d missing", user, e)
						return
					}
				}
				_ = c.ws.Close(websocket.StatusNormalClosure, "")
			}(c)
		}
	}
	// Churn on other users at the same time.
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c := g.dial(uuid.New(), uuid.New())
			c.ready(t)
			_ = c.ws.Close(websocket.StatusNormalClosure, "")
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Error(err)
	}
	// All channels are released once everyone left (only rt:revoke stays).
	deadline := time.Now().Add(3 * time.Second)
	for {
		chans := g.mr.PubSubChannels("rt:*")
		if len(chans) == 1 && chans[0] == "rt:revoke" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("channels still subscribed: %v", chans)
		}
		time.Sleep(20 * time.Millisecond)
	}
}
