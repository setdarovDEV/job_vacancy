package middleware

import (
	"context"
	"net/http"

	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

// SecondFactorGate decides whether a signed-in caller may use an area that needs a second
// factor (auth.SecondFactor.AdminAccess).
type SecondFactorGate interface {
	AdminAccess(ctx context.Context, p reqctx.Principal) error
}

// RequireSecondFactor runs the gate after authentication; its errors (including lookup
// failures) refuse the request.
func RequireSecondFactor(g SecondFactorGate) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if err := g.AdminAccess(r.Context(), reqctx.MustPrincipal(r.Context())); err != nil {
				response.Error(w, r, err)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
