package middleware

import (
	"net/http"
	"strings"

	chimw "github.com/go-chi/chi/v5/middleware"
)

// Compress gzips/deflates JSON and text responses (TZ BE-06). It is mounted only when
// no nginx sits in front (dev, staging without a proxy); in production nginx does brotli
// and gzip. Responses that already carry Content-Encoding (pre-compressed cache bytes)
// pass through untouched, and WebSocket upgrades are never wrapped.
func Compress(level int) func(http.Handler) http.Handler {
	c := chimw.NewCompressor(level, "application/json", "text/plain", "text/html", "text/css",
		"application/javascript", "image/svg+xml")
	gz := c.Handler
	return func(next http.Handler) http.Handler {
		wrapped := gz(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
				next.ServeHTTP(w, r)
				return
			}
			wrapped.ServeHTTP(w, r)
		})
	}
}
