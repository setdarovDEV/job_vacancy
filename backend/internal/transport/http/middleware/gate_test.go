package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/internal/pkg/ratelimit"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/token"
)

// redisTrips counts Redis round trips (a command or a pipeline each).
type redisTrips struct{ n atomic.Int64 }

func (c *redisTrips) DialHook(next redis.DialHook) redis.DialHook { return next }
func (c *redisTrips) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error { c.n.Add(1); return next(ctx, cmd) }
}
func (c *redisTrips) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return func(ctx context.Context, cmds []redis.Cmder) error { c.n.Add(1); return next(ctx, cmds) }
}

// revocations is the old per-request lookup, used when the gate isn't mounted.
type revocations struct{ rdb *redis.Client }

func (r revocations) IsRevoked(ctx context.Context, id uuid.UUID) (bool, error) {
	n, err := r.rdb.Exists(ctx, "sess:revoked:"+id.String()).Result()
	return n > 0, err
}

type gateFixture struct {
	mr     *miniredis.Miniredis
	rdb    *redis.Client
	trips  *redisTrips
	tokens *token.Manager
	router http.Handler
	// before is the number of Redis round trips made before the handler ran.
	before atomic.Int64
}

func newGateFixture(t *testing.T, ipLimit, userLimit int) *gateFixture {
	t.Helper()
	f := &gateFixture{mr: miniredis.RunT(t), trips: &redisTrips{}}
	f.rdb = redis.NewClient(&redis.Options{Addr: f.mr.Addr()})
	t.Cleanup(func() { _ = f.rdb.Close() })
	f.rdb.AddHook(f.trips)
	f.tokens = token.NewManager("test-secret-test-secret-test-secret-00", "jobvacancy.uz", 15*time.Minute)
	gate := &Gate{RDB: f.rdb, Tokens: f.tokens,
		IP:         ratelimit.Rule{Name: "api_ip", Limit: ipLimit, Window: time.Minute},
		User:       ratelimit.Rule{Name: "api_user", Limit: userLimit, Window: time.Minute},
		RevokedKey: func(id uuid.UUID) string { return "sess:revoked:" + id.String() }}
	auth := &Authenticator{Tokens: f.tokens, Revoked: revocations{f.rdb}}
	r := chi.NewRouter()
	r.Use(ClientIP(false, nil), gate.Middleware)
	handler := func(w http.ResponseWriter, r *http.Request) {
		f.before.Store(f.trips.n.Load())
		p, ok := reqctx.PrincipalFrom(r.Context())
		if ok {
			w.Header().Set("X-User", p.UserID.String())
		}
		w.WriteHeader(http.StatusNoContent)
	}
	r.With(auth.Require).Get("/private", handler)
	r.With(auth.Optional).Get("/public", handler)
	f.router = r
	return f
}

func (f *gateFixture) do(path, tok, ip string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.RemoteAddr = ip + ":4242"
	if tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	f.trips.n.Store(0)
	f.before.Store(-1)
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)
	return rec
}

func (f *gateFixture) token(t *testing.T, user, session uuid.UUID) string {
	t.Helper()
	tok, _, err := f.tokens.Issue(user, session, "seeker", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

// TZ BE-09 ✅: an authenticated request makes exactly one Redis round trip before its
// handler: the IP limit, the revocation check and the user limit in one script.
func TestGateOneRedisTripPerAuthenticatedRequest(t *testing.T) {
	f := newGateFixture(t, 100, 100)
	user, session := uuid.New(), uuid.New()
	tok := f.token(t, user, session)
	f.do("/private", tok, "198.51.100.1") // loads the script into Redis (EVALSHA miss once per server)

	rec := f.do("/private", tok, "198.51.100.1")
	if rec.Code != http.StatusNoContent || rec.Header().Get("X-User") != user.String() {
		t.Fatalf("authenticated request: %d %q", rec.Code, rec.Header().Get("X-User"))
	}
	if got := f.before.Load(); got != 1 {
		t.Fatalf("%d Redis round trips before the handler, want 1", got)
	}
	// Optional auth (public pages) is the same single call.
	if rec := f.do("/public", tok, "198.51.100.1"); rec.Header().Get("X-User") != user.String() || f.before.Load() != 1 {
		t.Fatalf("optional auth: user=%q trips=%d", rec.Header().Get("X-User"), f.before.Load())
	}
	// Anonymous: one call (IP limit only).
	if rec := f.do("/public", "", "198.51.100.1"); rec.Code != http.StatusNoContent || f.before.Load() != 1 {
		t.Fatalf("anonymous: %d trips=%d", rec.Code, f.before.Load())
	}
	// The counters are the limiter's own keys, so budgets carry over across the change.
	if v, _ := f.mr.Get("rl:api_user:u:" + user.String()); v != "3" {
		t.Fatalf("user counter = %q, want 3", v)
	}
	if v, _ := f.mr.Get("rl:api_ip:198.51.100.1"); v != "4" {
		t.Fatalf("ip counter = %q, want 4", v)
	}
}

// A revoked session is rejected by the same call and doesn't spend the user budget; an
// invalid token is rejected without the per-user keys.
func TestGateRevokedAndInvalidTokens(t *testing.T) {
	f := newGateFixture(t, 100, 100)
	user, session := uuid.New(), uuid.New()
	tok := f.token(t, user, session)
	f.do("/private", tok, "198.51.100.2")
	if err := f.rdb.Set(context.Background(), "sess:revoked:"+session.String(), 1, time.Minute).Err(); err != nil {
		t.Fatal(err)
	}
	if rec := f.do("/private", tok, "198.51.100.2"); rec.Code != http.StatusUnauthorized || f.trips.n.Load() != 1 {
		t.Fatalf("revoked: %d after %d trips", rec.Code, f.trips.n.Load())
	}
	if rec := f.do("/public", tok, "198.51.100.2"); rec.Code != http.StatusNoContent || rec.Header().Get("X-User") != "" {
		t.Fatalf("revoked token on a public route kept its user: %q", rec.Header().Get("X-User"))
	}
	if v, _ := f.mr.Get("rl:api_user:u:" + user.String()); v != "1" {
		t.Fatalf("user counter after revocation = %q, want 1", v)
	}
	if rec := f.do("/private", "not-a-jwt", "198.51.100.2"); rec.Code != http.StatusUnauthorized || f.trips.n.Load() != 1 {
		t.Fatalf("invalid token: %d after %d trips", rec.Code, f.trips.n.Load())
	}
}

// Both limits answer 429 with Retry-After.
func TestGateLimits(t *testing.T) {
	f := newGateFixture(t, 5, 2)
	tok := f.token(t, uuid.New(), uuid.New())
	for i := range 2 {
		if rec := f.do("/private", tok, "198.51.100.3"); rec.Code != http.StatusNoContent {
			t.Fatalf("request %d: %d", i, rec.Code)
		}
	}
	rec := f.do("/private", tok, "198.51.100.3")
	if rec.Code != http.StatusTooManyRequests || rec.Header().Get("Retry-After") == "" {
		t.Fatalf("user over limit: %d retry=%q", rec.Code, rec.Header().Get("Retry-After"))
	}
	// Another user behind the same IP still has a budget until the IP ceiling (5).
	other := f.token(t, uuid.New(), uuid.New())
	if rec := f.do("/private", other, "198.51.100.3"); rec.Code != http.StatusNoContent {
		t.Fatalf("second user: %d", rec.Code)
	}
	if rec := f.do("/public", "", "198.51.100.3"); rec.Code != http.StatusNoContent {
		t.Fatalf("5th request from the IP: %d", rec.Code)
	}
	if rec := f.do("/public", "", "198.51.100.3"); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("6th request from the IP: %d", rec.Code)
	}
	if rec := f.do("/public", "", "198.51.100.4"); rec.Code != http.StatusNoContent {
		t.Fatalf("another IP: %d", rec.Code)
	}
}

// Redis down: requests pass and a valid token is accepted (fail open, as before).
func TestGateFailsOpen(t *testing.T) {
	f := newGateFixture(t, 1, 1)
	user := uuid.New()
	tok := f.token(t, user, uuid.New())
	f.mr.Close()
	for range 3 {
		rec := f.do("/private", tok, "198.51.100.5")
		if rec.Code != http.StatusNoContent || rec.Header().Get("X-User") != user.String() {
			t.Fatalf("with Redis down: %d user=%q", rec.Code, rec.Header().Get("X-User"))
		}
	}
}
