// Package savedsearch stores vacancy searches and alerts their owners about new matches.
package savedsearch

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

const (
	MaxPerUser  = 10
	CheckEvery  = 30 * time.Minute
	alertSample = 3 // vacancy titles shown in the alert
)

var (
	ErrNotFound = apperr.NotFound("saved_search_not_found", "saved search not found")
	ErrLimit    = apperr.Conflict("saved_search_limit", "you can save at most 10 searches")
	ErrExists   = apperr.Conflict("saved_search_exists", "this search is already saved")
)

type DTO struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Params    string    `json:"params"` // append to /vacancies? to run it
	Notify    bool      `json:"notify"`
	CreatedAt time.Time `json:"created_at"`
}

func toDTO(s gen.SavedSearch) DTO {
	return DTO{ID: s.ID, Name: s.Name, Params: s.Params, Notify: s.Notify, CreatedAt: s.CreatedAt}
}

type Service struct {
	Q         *gen.Queries
	Vacancies *vacancy.Service
	Notify    *notification.Service
	Log       *slog.Logger
}

// canonical validates params with the listing parser and normalizes them (sorted keys,
// no paging) so the same search isn't saved twice.
func canonical(raw string) (string, error) {
	q, err := url.ParseQuery(strings.TrimPrefix(raw, "?"))
	if err != nil {
		return "", apperr.Validation(map[string]string{"params": "query_string"})
	}
	q.Del("cursor")
	q.Del("limit")
	q.Del("sort")
	if _, err := vacancy.ParseFilter(q); err != nil {
		return "", err
	}
	if len(q) == 0 {
		return "", apperr.Validation(map[string]string{"params": "required"})
	}
	keys := make([]string, 0, len(q))
	for k := range q {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	for _, k := range keys {
		// "remote,hybrid" and "hybrid&…=remote" are the same filter: split, dedupe, sort.
		var vals []string
		for _, v := range q[k] {
			parts := []string{v}
			if multiValue[k] {
				parts = strings.Split(v, ",")
			}
			for _, part := range parts {
				if part = strings.TrimSpace(part); part != "" && !slices.Contains(vals, part) {
					vals = append(vals, part)
				}
			}
		}
		sort.Strings(vals)
		for _, v := range vals {
			if b.Len() > 0 {
				b.WriteByte('&')
			}
			b.WriteString(url.QueryEscape(k) + "=" + url.QueryEscape(v))
		}
	}
	return b.String(), nil
}

// Filters that accept comma lists (see vacancy.ParseFilter).
var multiValue = map[string]bool{"employment_type": true, "work_format": true, "experience": true, "schedule": true}

type Input struct {
	Name   string `json:"name" validate:"required,min=1,max=100"`
	Params string `json:"params" validate:"required,max=1000"`
	Notify *bool  `json:"notify"`
}

func (s *Service) Create(ctx context.Context, p reqctx.Principal, in Input) (DTO, error) {
	params, err := canonical(in.Params)
	if err != nil {
		return DTO{}, err
	}
	n, err := s.Q.CountSavedSearches(ctx, p.UserID)
	if err != nil {
		return DTO{}, err
	}
	if n >= MaxPerUser {
		return DTO{}, ErrLimit
	}
	notify := in.Notify == nil || *in.Notify
	row, err := s.Q.CreateSavedSearch(ctx, gen.CreateSavedSearchParams{
		UserID: p.UserID, Name: strings.TrimSpace(in.Name), Params: params, Notify: notify,
	})
	var pe *pgconn.PgError
	if errors.As(err, &pe) && pe.Code == "23505" {
		return DTO{}, ErrExists
	}
	return toDTO(row), err
}

// ---- alerts (worker) ---------------------------------------------------------------------

// RunAlerts checks due saved searches for vacancies published since their last check.
// Claiming moves last_checked_at forward first, so a crash never causes repeated alerts.
func (s *Service) RunAlerts(ctx context.Context) (checked, alerted int, err error) {
	for {
		due, err := s.Q.ClaimDueSavedSearches(ctx, gen.ClaimDueSavedSearchesParams{
			MinAgeSecs: int32(CheckEvery.Seconds()), MaxResults: 200,
		})
		if err != nil || len(due) == 0 {
			return checked, alerted, err
		}
		for _, d := range due {
			checked++
			if ok := s.check(ctx, d); ok {
				alerted++
			}
		}
	}
}

func (s *Service) check(ctx context.Context, d gen.ClaimDueSavedSearchesRow) bool {
	q, _ := url.ParseQuery(d.Params)
	f, err := vacancy.ParseFilter(q)
	if err != nil { // filters that became invalid (e.g. removed category): skip quietly
		return false
	}
	since := d.Since
	f.PublishedAfter, f.Sort, f.Limit = &since, vacancy.SortNewest, alertSample
	res, err := s.Vacancies.List(ctx, f)
	if err != nil {
		s.Log.WarnContext(ctx, "saved search alert", "search_id", d.ID, "err", err)
		return false
	}
	if len(res.Cards) == 0 {
		return false
	}
	count := len(res.Cards)
	if res.Total != nil {
		count = *res.Total
	}
	titles := make([]string, len(res.Cards))
	for i, c := range res.Cards {
		titles[i] = "• " + c.Title + " — " + c.Company.Name
	}
	s.Notify.Notify(ctx, []uuid.UUID{d.UserID}, notification.TypeSearchAlert, notification.Payload{
		SearchID: d.ID.String(), SearchName: d.Name, Count: count, Preview: strings.Join(titles, "\n"),
	}, true)
	return true
}

// ---- HTTP --------------------------------------------------------------------------------

type Handler struct{ Svc *Service }

// MeRoutes are mounted under /me behind RequireAuth.
func (h *Handler) MeRoutes(r chi.Router) {
	r.Get("/saved-searches", h.list)
	r.Post("/saved-searches", h.create)
	r.Put("/saved-searches/{id}", h.update)
	r.Delete("/saved-searches/{id}", h.delete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Svc.Q.ListSavedSearches(r.Context(), reqctx.MustPrincipal(r.Context()).UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	out := make([]DTO, len(rows))
	for i, s := range rows {
		out[i] = toDTO(s)
	}
	response.JSON(w, http.StatusOK, out)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in Input
	if !response.DecodeValid(w, r, &in) {
		return
	}
	d, err := h.Svc.Create(r.Context(), reqctx.MustPrincipal(r.Context()), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, d)
}

type updateRequest struct {
	Name   string `json:"name" validate:"required,min=1,max=100"`
	Notify bool   `json:"notify"`
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, r, ErrNotFound)
		return
	}
	var req updateRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	row, err := h.Svc.Q.UpdateSavedSearch(r.Context(), gen.UpdateSavedSearchParams{
		ID: id, UserID: reqctx.MustPrincipal(r.Context()).UserID, Name: strings.TrimSpace(req.Name), Notify: req.Notify,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		response.Error(w, r, ErrNotFound)
		return
	}
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, toDTO(row))
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		response.Error(w, r, ErrNotFound)
		return
	}
	n, err := h.Svc.Q.DeleteSavedSearch(r.Context(), gen.DeleteSavedSearchParams{ID: id, UserID: reqctx.MustPrincipal(r.Context()).UserID})
	if err != nil {
		response.Error(w, r, err)
		return
	}
	if n == 0 {
		response.Error(w, r, ErrNotFound)
		return
	}
	response.NoContent(w)
}
