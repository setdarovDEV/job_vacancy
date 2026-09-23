package file

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/user"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

type Handler struct{ Svc *Service }

// Routes are mounted under /files behind RequireAuth.
//
// Upload flow: POST /files → multipart POST to upload.url with upload.fields and the file
// → POST /files/{id}/complete → use file.id (avatar, logo, chat message).
func (h *Handler) Routes(r chi.Router) {
	r.Post("/", h.create)
	r.Post("/{file}/complete", h.complete)
}

// MeRoutes are mounted under /me.
func (h *Handler) MeRoutes(r chi.Router) {
	r.Put("/avatar", h.setAvatar)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in CreateInput
	if !response.DecodeValid(w, r, &in) {
		return
	}
	d, up, err := h.Svc.Create(r.Context(), reqctx.MustPrincipal(r.Context()).UserID, in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, map[string]any{"file": d, "upload": up})
}

func (h *Handler) complete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "file"))
	if err != nil {
		response.Error(w, r, ErrNotFound)
		return
	}
	d, err := h.Svc.Complete(r.Context(), reqctx.MustPrincipal(r.Context()).UserID, id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

// FileRef is the body of "attach this uploaded file" requests.
type FileRef struct {
	FileID *uuid.UUID `json:"file_id"` // null removes
}

func (h *Handler) setAvatar(w http.ResponseWriter, r *http.Request) {
	p := reqctx.MustPrincipal(r.Context())
	var req FileRef
	if !response.DecodeValid(w, r, &req) {
		return
	}
	var url *string
	if req.FileID != nil {
		f, err := h.Svc.Use(r.Context(), p.UserID, *req.FileID, gen.FilePurposeAvatar)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		u := h.Svc.Storage.PublicURL(f.ObjectKey)
		url = &u
	}
	u, err := h.Svc.Q.SetUserAvatar(r.Context(), gen.SetUserAvatarParams{ID: p.UserID, AvatarUrl: url})
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, user.ToDTO(u))
}
