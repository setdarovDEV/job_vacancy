package vacancy

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

// Bookmarks. Listings are cached for everyone, so they never carry "is_saved"; clients
// fetch /me/saved-vacancies/ids once and mark cards themselves.

// SavedRoutes register on the /vacancies router (callers add RequireAuth).
func (h *Handler) SavedRoutes(r chi.Router) {
	r.Put("/{vacancy}/save", h.save)
	r.Delete("/{vacancy}/save", h.unsave)
}

// SavedMeRoutes are mounted under /me.
func (h *Handler) SavedMeRoutes(r chi.Router) {
	r.Get("/saved-vacancies", h.listSaved)
	r.Get("/saved-vacancies/ids", h.savedIDs)
}

func (h *Handler) save(w http.ResponseWriter, r *http.Request) {
	id, ok := vacancyID(w, r)
	if !ok {
		return
	}
	v, err := h.Svc.Q.GetVacancyByID(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && v.Status != gen.VacancyStatusPublished) {
		response.Error(w, r, ErrNotFound)
		return
	}
	if err != nil {
		response.Error(w, r, err)
		return
	}
	p := reqctx.MustPrincipal(r.Context())
	if err := h.Svc.Q.SaveVacancy(r.Context(), gen.SaveVacancyParams{UserID: p.UserID, VacancyID: id}); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (h *Handler) unsave(w http.ResponseWriter, r *http.Request) {
	id, ok := vacancyID(w, r)
	if !ok {
		return
	}
	p := reqctx.MustPrincipal(r.Context())
	if err := h.Svc.Q.UnsaveVacancy(r.Context(), gen.UnsaveVacancyParams{UserID: p.UserID, VacancyID: id}); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (h *Handler) savedIDs(w http.ResponseWriter, r *http.Request) {
	ids, err := h.Svc.Q.ListSavedVacancyIDs(r.Context(), reqctx.MustPrincipal(r.Context()).UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, ids)
}

func (h *Handler) listSaved(w http.ResponseWriter, r *http.Request) {
	after, limit, err := paging(r)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	params := gen.ListSavedVacanciesParams{UserID: reqctx.MustPrincipal(r.Context()).UserID, MaxResults: int32(limit + 1)}
	if after != nil {
		params.BeforeCreated, params.BeforeID = &after.T, &after.ID
	}
	rows, err := h.Svc.Q.ListSavedVacancies(r.Context(), params)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	var next *string
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1]
		c := cursor.Encode(cursorKey{T: last.CreatedAt, ID: last.VacancyID})
		next = &c
	}
	ids := make([]uuid.UUID, len(rows))
	for i, row := range rows {
		ids[i] = row.VacancyID
	}
	cards, err := h.Svc.CardsByIDs(r.Context(), ids)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	out := make([]Card, 0, len(ids))
	for _, id := range ids {
		if c, ok := cards[id]; ok {
			out = append(out, c)
		}
	}
	response.List(w, out, cursor.Meta{NextCursor: next})
}
