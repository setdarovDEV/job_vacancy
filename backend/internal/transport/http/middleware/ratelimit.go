package middleware

import (
	"log/slog"
	"math"
	"net/http"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/ratelimit"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

// KeyByIP limits per client address.
func KeyByIP(r *http.Request) string { return reqctx.ClientIP(r.Context()).String() }

// KeyByUser limits per authenticated user, falling back to IP.
func KeyByUser(r *http.Request) string {
	if p, ok := reqctx.PrincipalFrom(r.Context()); ok {
		return "u:" + p.UserID.String()
	}
	return KeyByIP(r)
}

func RateLimit(l *ratelimit.Limiter, rule ratelimit.Rule, key func(*http.Request) string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ok, retry, err := l.Allow(r.Context(), rule, key(r))
			if err != nil {
				slog.WarnContext(r.Context(), "rate limiter unavailable", "err", err)
			}
			if !ok {
				response.Error(w, r, apperr.TooManyRequests(int(math.Ceil(retry.Seconds()))))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
