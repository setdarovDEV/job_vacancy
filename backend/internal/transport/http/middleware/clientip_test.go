package middleware

import (
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/internal/pkg/ratelimit"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
)

var dockerNet = []netip.Prefix{netip.MustParsePrefix("172.16.0.0/12"), netip.MustParsePrefix("127.0.0.0/8")}

func resolvedIP(t *testing.T, trust bool, remote string, headers map[string]string) string {
	t.Helper()
	var got string
	h := ClientIP(trust, dockerNet)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		got = reqctx.ClientIP(r.Context()).String()
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = remote
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	h.ServeHTTP(httptest.NewRecorder(), req)
	return got
}

func TestClientIPTrustsOnlyNginx(t *testing.T) {
	cases := []struct {
		name    string
		trust   bool
		remote  string
		headers map[string]string
		want    string
	}{
		{"direct client, no proxy mode", false, "203.0.113.7:5000", map[string]string{"X-Real-IP": "1.2.3.4"}, "203.0.113.7"},
		{"nginx sets X-Real-IP", true, "172.18.0.5:41000", map[string]string{"X-Real-IP": "198.51.100.23"}, "198.51.100.23"},
		{"spoofed X-Real-IP from outside nginx's network", true, "203.0.113.7:5000", map[string]string{"X-Real-IP": "1.2.3.4"}, "203.0.113.7"},
		{"X-Forwarded-For is never trusted", true, "172.18.0.5:41000", map[string]string{"X-Forwarded-For": "1.2.3.4"}, "172.18.0.5"},
		{"garbage X-Real-IP falls back to the peer", true, "172.18.0.5:41000", map[string]string{"X-Real-IP": "not-an-ip"}, "172.18.0.5"},
		{"ipv4-mapped ipv6 peer", true, "[::ffff:172.18.0.5]:41000", map[string]string{"X-Real-IP": "2001:db8::1"}, "2001:db8::1"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := resolvedIP(t, tc.trust, tc.remote, tc.headers); got != tc.want {
				t.Fatalf("client ip = %s, want %s", got, tc.want)
			}
		})
	}
}

// TZ SEC-02: behind nginx every client has its own rate-limit budget, and a client can't
// escape its budget by inventing X-Real-IP / X-Forwarded-For values.
func TestRateLimitIsPerClientBehindNginx(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	rule := ratelimit.Rule{Name: "test", Limit: 3, Window: time.Minute}
	h := ClientIP(true, dockerNet)(RateLimit(ratelimit.New(rdb), rule, KeyByIP)(
		http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })))

	hit := func(remote string, headers map[string]string) int {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/vacancies", nil)
		req.RemoteAddr = remote
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	const nginx = "172.18.0.5:40000"
	alice := map[string]string{"X-Real-IP": "198.51.100.1"}
	bob := map[string]string{"X-Real-IP": "198.51.100.2"}

	for i := range 3 {
		if c := hit(nginx, alice); c != http.StatusNoContent {
			t.Fatalf("alice request %d: %d", i+1, c)
		}
	}
	if c := hit(nginx, alice); c != http.StatusTooManyRequests {
		t.Fatalf("alice over the limit: got %d, want 429", c)
	}
	if c := hit(nginx, bob); c != http.StatusNoContent {
		t.Fatalf("bob shares nginx's address but must have his own budget: got %d", c)
	}

	// A direct attacker rotating X-Real-IP/X-Forwarded-For still spends one budget.
	for i := range 3 {
		spoof := map[string]string{"X-Real-IP": "10.9.9." + string(rune('1'+i)), "X-Forwarded-For": "8.8.8." + string(rune('1'+i))}
		if c := hit("203.0.113.9:1234", spoof); c != http.StatusNoContent {
			t.Fatalf("attacker request %d: %d", i+1, c)
		}
	}
	if c := hit("203.0.113.9:1234", map[string]string{"X-Real-IP": "10.9.9.9"}); c != http.StatusTooManyRequests {
		t.Fatalf("spoofed headers bypassed the limit: got %d", c)
	}
}
