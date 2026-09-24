package turnstile

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
)

func TestVerify(t *testing.T) {
	var got map[string]string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		got = map[string]string{"secret": r.Form.Get("secret"), "response": r.Form.Get("response"), "remoteip": r.Form.Get("remoteip")}
		switch r.Form.Get("response") {
		case "good":
			_ = json.NewEncoder(w).Encode(Result{Success: true, Hostname: "jobvacancy.uz"})
		case "other-site":
			_ = json.NewEncoder(w).Encode(Result{Success: true, Hostname: "evil.example"})
		case "cf-down":
			_ = json.NewEncoder(w).Encode(Result{ErrorCodes: []string{"internal-error"}})
		case "5xx":
			w.WriteHeader(http.StatusBadGateway)
		default:
			_ = json.NewEncoder(w).Encode(Result{ErrorCodes: []string{"invalid-input-response"}})
		}
	}))
	defer srv.Close()
	v := New("s3cret", "jobvacancy.uz")
	v.URL = srv.URL
	ip := netip.MustParseAddr("203.0.113.7")
	ctx := context.Background()

	if ok, err := v.Verify(ctx, "good", ip); !ok || err != nil {
		t.Fatalf("good token: %v %v", ok, err)
	}
	if got["secret"] != "s3cret" || got["remoteip"] != "203.0.113.7" {
		t.Fatalf("form sent: %v", got)
	}
	for _, tok := range []string{"bad", "other-site", "", string(make([]byte, 3000))} {
		if ok, err := v.Verify(ctx, tok, ip); ok || err != nil {
			t.Fatalf("token %.10q: %v %v", tok, ok, err)
		}
	}
	for _, tok := range []string{"cf-down", "5xx"} {
		if _, err := v.Verify(ctx, tok, ip); err == nil {
			t.Fatalf("token %q: want an error (Cloudflare unavailable)", tok)
		}
	}
}
