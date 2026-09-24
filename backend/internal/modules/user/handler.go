package user

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/validate"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

var ErrNotFound = apperr.NotFound("user_not_found", "user not found")

// PresenceVisibility applies the "hide online status" setting to live presence at once
// (realtime.Hub).
type PresenceVisibility interface {
	SetHidden(ctx context.Context, id uuid.UUID, hidden bool)
}

type Handler struct {
	Q        *gen.Queries
	Presence PresenceVisibility // nil: the change shows on the next connection
}

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
	// HideOnline hides the online status from everyone (TZ SEC-05).
	HideOnline *bool `json:"hide_online"`
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
	params := gen.UpdateProfileParams{ID: p.UserID, FullName: req.FullName, HideOnline: req.HideOnline}
	if req.Locale != nil {
		l := gen.AppLocale(*req.Locale)
		params.Locale = &l
	}
	u, err := h.Q.UpdateProfile(r.Context(), params)
	if err != nil {
		response.Error(w, r, notFound(err))
		return
	}
	if req.HideOnline != nil && h.Presence != nil {
		ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 2*time.Second)
		h.Presence.SetHidden(ctx, u.ID, u.HideOnline)
		cancel()
	}
	response.JSON(w, http.StatusOK, ToDTO(u))
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}
