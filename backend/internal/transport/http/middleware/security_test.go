package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TZ SEC-03 (API side): every response carries nosniff, a deny-all CSP, CORP and noindex;
// signed-in responses default to no-store unless the handler chose a policy.
func TestSecurityHeaders(t *testing.T) {
	h := SecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/public" {
			w.Header().Set("Cache-Control", "public, max-age=60")
		}
		w.WriteHeader(http.StatusOK)
	}))
	get := func(path, auth string) http.Header {
		r := httptest.NewRequest(http.MethodGet, path, nil)
		if auth != "" {
			r.Header.Set("Authorization", auth)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, r)
		return rec.Header()
	}
	anon := get("/me", "")
	for k, v := range map[string]string{
		"X-Content-Type-Options":       "nosniff",
		"Content-Security-Policy":      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
		"Cross-Origin-Resource-Policy": "same-site",
		"X-Robots-Tag":                 "noindex",
	} {
		if got := anon.Get(k); got != v {
			t.Errorf("%s = %q, want %q", k, got, v)
		}
	}
	if cc := anon.Get("Cache-Control"); cc != "" {
		t.Errorf("anonymous default Cache-Control %q", cc)
	}
	if cc := get("/me", "Bearer x").Get("Cache-Control"); cc != "no-store" {
		t.Errorf("signed-in default Cache-Control %q, want no-store", cc)
	}
	if cc := get("/public", "Bearer x").Get("Cache-Control"); cc != "public, max-age=60" {
		t.Errorf("handler's own policy lost: %q", cc)
	}
}
