package user

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/validate"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

var ErrNotFound = apperr.NotFound("user_not_found", "user not found")

type Handler struct{ Q *gen.Queries }

// Routes are mounted under /me behind RequireAuth.
func (h *Handler) Routes(r chi.Router) {
	r.Get("/", h.get)
	r.Patch("/", h.update)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	p := reqctx.MustPrincipal(r.Context())
	u, err := h.Q.GetUserByID(r.Context(), p.UserID)
	if err != nil {
		response.Error(w, r, notFound(err))
		return
	}
	response.JSON(w, http.StatusOK, ToDTO(u))
}

type updateRequest struct {
	FullName *string `json:"full_name" validate:"omitempty,min=2,max=100"`
	Locale   *string `json:"locale" validate:"omitempty,oneof=uz uz-Cyrl ru en"`
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	p := reqctx.MustPrincipal(r.Context())
	var req updateRequest
	if err := response.Decode(r, &req); err != nil {
		response.Error(w, r, err)
		return
	}
	if req.FullName != nil {
		name := strings.Join(strings.Fields(*req.FullName), " ")
		req.FullName = &name
	}
	if err := validate.Struct(req); err != nil {
		response.Error(w, r, err)
		return
	}
	params := gen.UpdateProfileParams{ID: p.UserID, FullName: req.FullName}
	if req.Locale != nil {
		l := gen.AppLocale(*req.Locale)
		params.Locale = &l
	}
	u, err := h.Q.UpdateProfile(r.Context(), params)
	if err != nil {
		response.Error(w, r, notFound(err))
		return
	}
	response.JSON(w, http.StatusOK, ToDTO(u))
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}
