package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"
)

// Timeout puts a deadline on every request context (TZ BE-01): database, Redis and
// outbound calls made with r.Context() give up when it passes, so a slow dependency
// can't pile up goroutines and connections. The WebSocket endpoint lives for hours and
// is exempt; the PDF export renders a document and gets the longer slow deadline.
func Timeout(normal, slow time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			d := requestBudget(r, normal, slow)
			if d <= 0 {
				next.ServeHTTP(w, r)
				return
			}
			ctx, cancel := context.WithTimeout(r.Context(), d)
			defer cancel()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// requestBudget returns the deadline for r, or 0 for none. Routing hasn't happened yet
// at this point, so the path is matched directly.
func requestBudget(r *http.Request, normal, slow time.Duration) time.Duration {
	p := r.URL.Path
	switch {
	case p == "/api/v1/ws" || p == "/api/v1/ws/":
		return 0
	case strings.HasPrefix(p, "/api/v1/resumes/") && strings.HasSuffix(p, "/pdf"):
		return slow
	default:
		return normal
	}
}
