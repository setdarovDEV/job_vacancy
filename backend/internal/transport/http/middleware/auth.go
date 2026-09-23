package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"slices"
	"strings"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/token"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

// RevocationChecker reports whether a session was revoked after its access token was
// issued (logout, password change, block). Backed by a Redis set, so it's one fast lookup.
type RevocationChecker interface {
	IsRevoked(ctx context.Context, sessionID uuid.UUID) (bool, error)
}

var errUnauthorized = apperr.Unauthorized("unauthorized", "missing or invalid access token")

type Authenticator struct {
	Tokens  *token.Manager
	Revoked RevocationChecker
}

func (a *Authenticator) principal(r *http.Request) (reqctx.Principal, bool) {
	raw, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok || raw == "" {
		return reqctx.Principal{}, false
	}
	c, err := a.Tokens.Parse(raw)
	if err != nil {
		return reqctx.Principal{}, false
	}
	revoked, err := a.Revoked.IsRevoked(r.Context(), c.SessionID)
	if err != nil {
		// Redis unavailable: the token is still cryptographically valid and short-lived.
		slog.WarnContext(r.Context(), "revocation check failed", "err", err)
	}
	if revoked {
		return reqctx.Principal{}, false
	}
	return reqctx.Principal{UserID: c.UserID, SessionID: c.SessionID, Role: c.Role}, true
}

// Require rejects requests without a valid access token.
func (a *Authenticator) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p, ok := a.principal(r)
		if !ok {
			response.Error(w, r, errUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(reqctx.WithPrincipal(r.Context(), p)))
	})
}

// Optional attaches the principal when a valid token is present (e.g. public vacancy
// pages that show "saved" state for logged-in users).
func (a *Authenticator) Optional(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if p, ok := a.principal(r); ok {
			r = r.WithContext(reqctx.WithPrincipal(r.Context(), p))
		}
		next.ServeHTTP(w, r)
	})
}

// RequireRole must be mounted after Require.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			p := reqctx.MustPrincipal(r.Context())
			if !slices.Contains(roles, p.Role) {
				response.Error(w, r, apperr.Forbidden("forbidden", "insufficient role"))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
