package catalog

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"jobvacancy.uz/backend/internal/transport/http/response"
)

type Handler struct{ Svc *Service }

// Routes are public and mounted under /catalog.
func (h *Handler) Routes(r chi.Router) {
	r.Get("/categories", h.serve(func(s *snapshot) encoded { return s.categories }))
	r.Get("/regions", h.serve(func(s *snapshot) encoded { return s.regions }))
	r.Get("/skills", h.skills)
}

// serve writes a pre-encoded snapshot body; unchanged data costs clients a 304.
func (h *Handler) serve(pick func(*snapshot) encoded) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		e := pick(h.Svc.snap.Load())
		w.Header().Set("ETag", e.etag)
		w.Header().Set("Cache-Control", "public, max-age=300, stale-while-revalidate=86400")
		if r.Header.Get("If-None-Match") == e.etag {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write(e.body)
	}
}

func (h *Handler) skills(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 50 {
		limit = 15
	}
	out, err := h.Svc.SearchSkills(r.Context(), r.URL.Query().Get("q"), int32(limit))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	response.JSON(w, http.StatusOK, out)
}
