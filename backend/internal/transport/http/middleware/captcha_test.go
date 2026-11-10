package middleware

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
)

type fakeVerifier struct {
	ok  bool
	err error
}

func (f fakeVerifier) Verify(context.Context, string, netip.Addr) (bool, error) { return f.ok, f.err }

func TestCaptcha(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	okHandler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	cases := []struct {
		name   string
		v      CaptchaVerifier
		token  string
		status int
	}{
		{"off without secret", nil, "", 204},
		{"missing token", fakeVerifier{ok: true}, "", 400},
		{"valid", fakeVerifier{ok: true}, "t", 204},
		{"rejected", fakeVerifier{ok: false}, "t", 400},
		{"cloudflare down fails closed", fakeVerifier{err: errors.New("x")}, "t", 503},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h := Captcha(c.v, nil, log)(okHandler)
			req := httptest.NewRequest(http.MethodPost, "/", nil)
			if c.token != "" {
				req.Header.Set(CaptchaHeader, c.token)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			if rec.Code != c.status {
				t.Fatalf("status %d, want %d", rec.Code, c.status)
			}
		})
	}
}
