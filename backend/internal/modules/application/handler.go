package application

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

type Handler struct{ Svc *Service }

// Routes are mounted under /applications behind RequireAuth.
func (h *Handler) Routes(r chi.Router) {
	r.Get("/{application}", h.get)
	r.Put("/{application}/status", h.setStatus)
	r.Put("/{application}/note", h.setNote)
	r.Post("/{application}/withdraw", h.withdraw)
}

// VacancyRoutes register on the /vacancies router (callers add RequireAuth).
func (h *Handler) VacancyRoutes(r chi.Router) {
	r.Post("/{vacancy}/applications", h.apply)
	r.Get("/{vacancy}/applications", h.forVacancy)
	r.Get("/{vacancy}/applications/stats", h.stats)
}

// ResumeRoutes register on the /resumes router (callers add RequireAuth).
func (h *Handler) ResumeRoutes(r chi.Router) {
	r.Post("/{resume}/invite", h.invite)
}

// MeRoutes are mounted under /me.
func (h *Handler) MeRoutes(r chi.Router) {
	r.Get("/applications", h.mine)
}

func (h *Handler) apply(w http.ResponseWriter, r *http.Request) {
	vid, ok := parseID(w, r, "vacancy")
	if !ok {
		return
	}
	var in ApplyInput
	if !response.DecodeValid(w, r, &in) {
		return
	}
	d, err := h.Svc.Apply(r.Context(), reqctx.MustPrincipal(r.Context()), vid, in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, d)
}

func (h *Handler) invite(w http.ResponseWriter, r *http.Request) {
	rid, ok := parseID(w, r, "resume")
	if !ok {
		return
	}
	var in InviteInput
	if !response.DecodeValid(w, r, &in) {
		return
	}
	d, err := h.Svc.Invite(r.Context(), reqctx.MustPrincipal(r.Context()), rid, in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, d)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r, "application")
	if !ok {
		return
	}
	d, err := h.Svc.Get(r.Context(), reqctx.MustPrincipal(r.Context()), id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

type statusRequest struct {
	Status string `json:"status" validate:"required,oneof=viewed invited interview hired rejected"`
	Note   string `json:"note" validate:"max=2000"`
}

func (h *Handler) setStatus(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r, "application")
	if !ok {
		return
	}
	var req statusRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	d, err := h.Svc.SetStatus(r.Context(), reqctx.MustPrincipal(r.Context()), id, gen.ApplicationStatus(req.Status), req.Note)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

type noteRequest struct {
	Note string `json:"note" validate:"max=5000"`
}

func (h *Handler) setNote(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r, "application")
	if !ok {
		return
	}
	var req noteRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	d, err := h.Svc.SetNote(r.Context(), reqctx.MustPrincipal(r.Context()), id, req.Note)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

func (h *Handler) withdraw(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r, "application")
	if !ok {
		return
	}
	d, err := h.Svc.Withdraw(r.Context(), reqctx.MustPrincipal(r.Context()), id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

func (h *Handler) mine(w http.ResponseWriter, r *http.Request) {
	status, pg, ok := listParams(w, r)
	if !ok {
		return
	}
	items, next, err := h.Svc.Mine(r.Context(), reqctx.MustPrincipal(r.Context()), status, pg)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.List(w, items, meta(next))
}

func (h *Handler) forVacancy(w http.ResponseWriter, r *http.Request) {
	vid, ok := parseID(w, r, "vacancy")
	if !ok {
		return
	}
	status, pg, ok := listParams(w, r)
	if !ok {
		return
	}
	items, next, err := h.Svc.ForVacancy(r.Context(), reqctx.MustPrincipal(r.Context()), vid, status, pg)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.List(w, items, meta(next))
}

func (h *Handler) stats(w http.ResponseWriter, r *http.Request) {
	vid, ok := parseID(w, r, "vacancy")
	if !ok {
		return
	}
	out, err := h.Svc.Stats(r.Context(), reqctx.MustPrincipal(r.Context()), vid)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, out)
}

// ---- parsing -----------------------------------------------------------------------------

func parseID(w http.ResponseWriter, r *http.Request, param string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, param))
	if err != nil {
		response.Error(w, r, apperr.NotFound(param+"_not_found", param+" not found"))
		return id, false
	}
	return id, true
}

func listParams(w http.ResponseWriter, r *http.Request) (*gen.ApplicationStatus, Page, bool) {
	q := r.URL.Query()
	pg := Page{Limit: 20}
	var status *gen.ApplicationStatus
	if s := q.Get("status"); s != "" {
		st := gen.ApplicationStatus(s)
		if !st.Valid() {
			response.Error(w, r, apperr.Validation(map[string]string{"status": "oneof"}))
			return nil, pg, false
		}
		status = &st
	}
	if s := q.Get("limit"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n < 1 || n > 50 {
			response.Error(w, r, apperr.Validation(map[string]string{"limit": "max=50"}))
			return nil, pg, false
		}
		pg.Limit = n
	}
	if s := q.Get("cursor"); s != "" {
		var k CursorKey
		if err := cursor.Decode(s, &k); err != nil {
			response.Error(w, r, apperr.BadRequest("invalid_cursor", "cursor is invalid"))
			return nil, pg, false
		}
		pg.After = &k
	}
	return status, pg, true
}

func meta(next *CursorKey) cursor.Meta {
	if next == nil {
		return cursor.Meta{}
	}
	c := cursor.Encode(next)
	return cursor.Meta{NextCursor: &c}
}
