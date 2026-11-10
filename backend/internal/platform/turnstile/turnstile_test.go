package turnstile

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
)

func TestVerify(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		switch r.Form.Get("response") {
		case "good":
			_, _ = w.Write([]byte(`{"success":true,"hostname":"jobvacancy.uz"}`))
		case "elsewhere":
			_, _ = w.Write([]byte(`{"success":true,"hostname":"evil.example"}`))
		default:
			_, _ = w.Write([]byte(`{"success":false}`))
		}
	}))
	defer srv.Close()
	c := New("s", "jobvacancy.uz")
	c.URL = srv.URL
	for token, want := range map[string]bool{"good": true, "elsewhere": false, "bad": false} {
		ok, err := c.Verify(context.Background(), token, netip.Addr{})
		if err != nil || ok != want {
			t.Errorf("%s: ok=%v err=%v, want %v", token, ok, err, want)
		}
	}
	c.Hostname = "" // any host
	if ok, _ := c.Verify(context.Background(), "elsewhere", netip.Addr{}); !ok {
		t.Error("no hostname configured should accept any host")
	}
}
