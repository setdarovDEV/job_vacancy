package report

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

type Handler struct{ Svc *Service }

// VacancyRoutes are mounted under /vacancies behind RequireAuth.
func (h *Handler) VacancyRoutes(r chi.Router) {
	r.Post("/{vacancy}/report", h.report)
}

// AdminRoutes are mounted under /admin/reports.
func (h *Handler) AdminRoutes(r chi.Router) {
	r.Get("/", h.queue)
	r.Post("/{report}/resolve", h.resolve)
}

func (h *Handler) report(w http.ResponseWriter, r *http.Request) {
	var in Input
	if !response.DecodeValid(w, r, &in) {
		return
	}
	d, err := h.Svc.Report(r.Context(), reqctx.MustPrincipal(r.Context()), chi.URLParam(r, "vacancy"), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, d)
}

type queueCursor struct {
	ID uuid.UUID `json:"i"`
}

func (h *Handler) queue(w http.ResponseWriter, r *http.Request) {
	qs := r.URL.Query()
	f := QueueFilter{Status: qs.Get("status"), Limit: 20}
	switch f.Status {
	case "", "open", "resolved", "dismissed":
	default:
		response.Error(w, r, apperr.Validation(map[string]string{"status": "oneof"}))
		return
	}
	if s := qs.Get("limit"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n < 1 || n > 100 {
			response.Error(w, r, apperr.Validation(map[string]string{"limit": "max=100"}))
			return
		}
		f.Limit = n
	}
	if s := qs.Get("vacancy_id"); s != "" {
		id, err := uuid.Parse(s)
		if err != nil {
			response.Error(w, r, apperr.Validation(map[string]string{"vacancy_id": "uuid"}))
			return
		}
		f.VacancyID = &id
	}
	if s := qs.Get("cursor"); s != "" {
		var c queueCursor
		if err := cursor.Decode(s, &c); err != nil {
			response.Error(w, r, apperr.BadRequest("invalid_cursor", "cursor is invalid"))
			return
		}
		f.After = &c.ID
	}
	items, next, err := h.Svc.Queue(r.Context(), f)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	meta := cursor.Meta{}
	if next != nil {
		c := cursor.Encode(queueCursor{ID: *next})
		meta.NextCursor = &c
	}
	w.Header().Set("Cache-Control", "no-store")
	response.List(w, items, meta)
}

type resolveRequest struct {
	Status string `json:"status" validate:"required,oneof=resolved dismissed"`
	Note   string `json:"note" validate:"max=1000"`
	// AllForObject closes every open report about the same vacancy.
	AllForObject bool `json:"all_for_object"`
}

func (h *Handler) resolve(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "report"))
	if err != nil {
		response.Error(w, r, ErrNotFound)
		return
	}
	var req resolveRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	n, err := h.Svc.Resolve(r.Context(), reqctx.MustPrincipal(r.Context()), id, req.Status, req.Note, req.AllForObject)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]int{"closed": n})
}
