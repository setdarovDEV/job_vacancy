package catalog

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

type Handler struct{ Svc *Service }

// Routes are public and mounted under /catalog.
func (h *Handler) Routes(r chi.Router) {
	r.Get("/categories", h.serve(func(s *snapshot) encoded { return s.categories }))
	r.Get("/regions", h.regions)
	r.Get("/regions/{region}/districts", h.districts)
	r.Get("/skills", h.skills)
}

// serve writes a pre-encoded snapshot body; unchanged data costs clients a 304.
func (h *Handler) serve(pick func(*snapshot) encoded) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) { write(w, r, pick(h.Svc.snap.Load())) }
}

func write(w http.ResponseWriter, r *http.Request, e encoded) {
	w.Header().Set("ETag", e.etag)
	w.Header().Set("Cache-Control", "public, max-age=300, stale-while-revalidate=86400")
	if r.Header.Get("If-None-Match") == e.etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write(e.body)
}

// regions is the region tree with every district; ?depth=1 leaves the districts out
// (they can be loaded per region, TZ FN-06).
func (h *Handler) regions(w http.ResponseWriter, r *http.Request) {
	s := h.Svc.snap.Load()
	if r.URL.Query().Get("depth") == "1" {
		write(w, r, s.regionsTop)
		return
	}
	write(w, r, s.regions)
}

var errRegion404 = apperr.NotFound("region_not_found", "region not found")

// districts lists one region's districts and cities (by region id or slug).
func (h *Handler) districts(w http.ResponseWriter, r *http.Request) {
	s := h.Svc.snap.Load()
	ref := chi.URLParam(r, "region")
	id, ok := s.regionSlugs[ref]
	if !ok {
		if n, err := strconv.ParseInt(ref, 10, 32); err == nil {
			id = int32(n)
		}
	}
	e, ok := s.districts[id]
	if !ok {
		response.Error(w, r, errRegion404)
		return
	}
	write(w, r, e)
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
