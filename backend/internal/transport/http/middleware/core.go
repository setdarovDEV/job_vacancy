// Package middleware contains the HTTP middleware chain shared by all routes.
package middleware

import (
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/random"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/metrics"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

// RequestID propagates X-Request-ID from nginx or generates a new one.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" || len(id) > 64 {
			id = random.Token(12)
		}
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r.WithContext(reqctx.WithRequestID(r.Context(), id)))
	})
}

// ClientIP resolves the caller address (TZ SEC-02). X-Real-IP is honoured only when
// trustProxy is set and the TCP peer is one of the trusted proxies (our nginx, which
// overwrites X-Real-IP with $remote_addr, or the SSR web server forwarding it).
// X-Forwarded-For is never read: clients can prepend anything to it.
func ClientIP(trustProxy bool, trusted []netip.Prefix) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var peer netip.Addr
			if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
				peer, _ = netip.ParseAddr(host)
			}
			peer = peer.Unmap()
			ip := peer
			if trustProxy && peer.IsValid() && inPrefixes(peer, trusted) {
				if v := r.Header.Get("X-Real-IP"); v != "" {
					if real, err := netip.ParseAddr(strings.TrimSpace(v)); err == nil {
						ip = real.Unmap()
					}
				}
			}
			next.ServeHTTP(w, r.WithContext(reqctx.WithClientIP(r.Context(), ip)))
		})
	}
}

func inPrefixes(ip netip.Addr, prefixes []netip.Prefix) bool {
	for _, p := range prefixes {
		if p.Contains(ip) {
			return true
		}
	}
	return false
}

type statusWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (w *statusWriter) WriteHeader(code int) {
	if w.status == 0 {
		w.status = code
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	n, err := w.ResponseWriter.Write(b)
	w.bytes += n
	return n, err
}

// Unwrap lets http.ResponseController reach the underlying writer (needed for WebSocket hijack).
func (w *statusWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

// Observe logs each request and records Prometheus metrics labelled by route pattern
// (e.g. /api/v1/vacancies/{id}), never by raw path, to keep label cardinality bounded.
func Observe(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w}
			next.ServeHTTP(sw, r)
			if sw.status == 0 {
				sw.status = http.StatusOK
			}
			elapsed := time.Since(start)

			route := chi.RouteContext(r.Context()).RoutePattern()
			if route == "" {
				route = "unmatched"
			}
			metrics.HTTPRequests.WithLabelValues(route, r.Method, strconv.Itoa(sw.status)).Inc()
			metrics.HTTPDuration.WithLabelValues(route, r.Method).Observe(elapsed.Seconds())

			if route == "/healthz" || route == "/readyz" {
				return
			}
			level := slog.LevelInfo
			if sw.status >= 500 {
				level = slog.LevelError
			}
			path := r.URL.Path
			if strings.Contains(route, "{token}") {
				path = route // e.g. DELETE /me/devices/{token}: never log push tokens
			}
			log.LogAttrs(r.Context(), level, "http",
				slog.String("method", r.Method),
				slog.String("path", path),
				slog.Int("status", sw.status),
				slog.Int("bytes", sw.bytes),
				slog.Duration("took", elapsed),
				slog.String("ip", reqctx.ClientIP(r.Context()).String()),
				slog.String("request_id", reqctx.RequestID(r.Context())),
			)
		})
	}
}

// Recover turns panics into 500 responses and logs the stack.
func Recover(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if v := recover(); v != nil {
					if v == http.ErrAbortHandler {
						panic(v)
					}
					log.ErrorContext(r.Context(), "panic", "value", v,
						"request_id", reqctx.RequestID(r.Context()), "stack", string(debug.Stack()))
					response.Error(w, r, apperr.Internal)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// CORS allows the configured web origins with credentials (the refresh cookie).
// In production web and API share one origin through nginx, so this is mostly for dev.
func CORS(origins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(origins))
	for _, o := range origins {
		allowed[strings.TrimRight(o, "/")] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && allowed[origin] {
				h := w.Header()
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Credentials", "true")
				h.Add("Vary", "Origin")
				if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
					h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
					h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Client-Type, X-Request-ID, Accept-Language")
					h.Set("Access-Control-Max-Age", "600")
					w.WriteHeader(http.StatusNoContent)
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
