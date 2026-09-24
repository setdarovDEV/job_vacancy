package account

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"jobvacancy.uz/backend/internal/modules/auth"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

type Handler struct {
	Svc    *Service
	Cookie auth.CookieConfig
}

// Routes are mounted under /me behind RequireAuth.
func (h *Handler) Routes(r chi.Router) {
	r.Delete("/", h.delete)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	var in DeleteInput
	if r.ContentLength != 0 && !response.DecodeValid(w, r, &in) {
		return
	}
	if err := h.Svc.Delete(r.Context(), reqctx.MustPrincipal(r.Context()), in); err != nil {
		response.Error(w, r, err)
		return
	}
	auth.ClearRefreshCookie(w, h.Cookie)
	response.NoContent(w)
}
