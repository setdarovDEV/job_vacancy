package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
)

type gateFunc func(context.Context, reqctx.Principal) error

func (f gateFunc) AdminAccess(ctx context.Context, p reqctx.Principal) error { return f(ctx, p) }

func TestRequireSecondFactor(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	for name, c := range map[string]struct {
		err  error
		want int
	}{
		"allowed":               {nil, 204},
		"refused":               {apperr.Forbidden("two_factor_session_required", "x"), 403},
		"lookup failure closes": {errors.New("db down"), 500},
	} {
		t.Run(name, func(t *testing.T) {
			h := RequireSecondFactor(gateFunc(func(context.Context, reqctx.Principal) error { return c.err }))(ok)
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			req = req.WithContext(reqctx.WithPrincipal(req.Context(), reqctx.Principal{UserID: uuid.New()}))
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			if rec.Code != c.want {
				t.Fatalf("status %d, want %d", rec.Code, c.want)
			}
		})
	}
}
