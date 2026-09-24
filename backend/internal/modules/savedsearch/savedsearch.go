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
	// List overrides Vacancies for the alert query (tests).
	List   Lister
	Notify Notifier
	Log    *slog.Logger
}

// Notifier sends the alerts of a group (a payload per user) in one transaction;
// *notification.Service implements it.
type Notifier interface {
	NotifyEach(ctx context.Context, typ string, to []notification.Recipient, store bool)
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

// Lister runs the alert query; *vacancy.Service implements it (ListNew).
type Lister interface {
	ListNew(ctx context.Context, f vacancy.Filter) (vacancy.ListResult, error)
}

// alertFetch caps the new vacancies read per group of identical searches: the alert
// shows 3 titles and a count, and "50 new vacancies" is plenty for a 30-minute window.
const alertFetch = 50

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
		for _, group := range groupByParams(due) {
			checked += len(group)
			alerted += s.checkGroup(ctx, group)
		}
	}
}

// groupByParams puts saved searches with identical (canonical) params together: popular
// searches ("dasturchi", "Toshkent") are saved by many users and need one query, not one
// per user (TZ BE-11). Order follows the first appearance.
func groupByParams(due []gen.ClaimDueSavedSearchesRow) [][]gen.ClaimDueSavedSearchesRow {
	idx := map[string]int{}
	var groups [][]gen.ClaimDueSavedSearchesRow
	for _, d := range due {
		i, ok := idx[d.Params]
		if !ok {
			i = len(groups)
			idx[d.Params] = i
			groups = append(groups, nil)
		}
		groups[i] = append(groups[i], d)
	}
	return groups
}

// checkGroup runs one query for a group of identical searches, from the oldest "since"
// of the group, and alerts every member about the vacancies newer than its own last
// check. It returns how many members were alerted.
func (s *Service) checkGroup(ctx context.Context, group []gen.ClaimDueSavedSearchesRow) int {
	q, _ := url.ParseQuery(group[0].Params)
	f, err := vacancy.ParseFilter(q)
	if err != nil { // filters that became invalid (e.g. removed category): skip quietly
		return 0
	}
	since := group[0].Since
	for _, d := range group[1:] {
		if d.Since.Before(since) {
			since = d.Since
		}
	}
	f.PublishedAfter, f.Limit = &since, alertFetch
	res, err := s.lister().ListNew(ctx, f)
	if err != nil {
		s.Log.WarnContext(ctx, "saved search alert", "search_id", group[0].ID, "group", len(group), "err", err)
		return 0
	}
	var to []notification.Recipient
	for _, d := range group {
		// Cards are newest first: this member's new vacancies are a prefix.
		n := 0
		for n < len(res.Cards) && res.Cards[n].PublishedAt != nil && res.Cards[n].PublishedAt.After(d.Since) {
			n++
		}
		if n == 0 {
			continue
		}
		sample := res.Cards[:min(n, alertSample)]
		titles := make([]string, len(sample))
		for i, c := range sample {
			titles[i] = "• " + c.Title + " — " + c.Company.Name
		}
		to = append(to, notification.Recipient{UserID: d.UserID, Payload: notification.Payload{
			SearchID: d.ID.String(), SearchName: d.Name, Count: n, Preview: strings.Join(titles, "\n"),
		}})
	}
	// One transaction for the whole group: the stored alerts and their delivery jobs
	// (only for channels each user has) commit together (TZ BE-08).
	if len(to) > 0 {
		s.Notify.NotifyEach(ctx, notification.TypeSearchAlert, to, true)
	}
	return len(to)
}

func (s *Service) lister() Lister {
	if s.List != nil {
		return s.List
	}
	return s.Vacancies
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
