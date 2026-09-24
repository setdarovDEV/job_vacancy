package vacancy

import (
	"context"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/searchq"
	mw "jobvacancy.uz/backend/internal/transport/http/middleware"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

const (
	defaultLimit = 20
	maxLimit     = 50
)

type Handler struct{ Svc *Service }

// Routes are mounted under /vacancies.
func (h *Handler) Routes(r chi.Router, auth *mw.Authenticator) {
	r.Get("/", h.list)
	r.With(auth.Optional).Get("/{vacancy}", h.get)
	r.Group(func(r chi.Router) {
		r.Use(auth.Require)
		r.Put("/{vacancy}", h.update)
		r.Delete("/{vacancy}", h.delete)
		r.Post("/{vacancy}/submit", h.submit)
		r.Post("/{vacancy}/archive", h.archive)
	})
}

// CompanyRoutes are mounted under /companies/{company}/vacancies (employer dashboard).
func (h *Handler) CompanyRoutes(r chi.Router, auth *mw.Authenticator) {
	r.Use(auth.Require)
	r.Get("/", h.listForCompany)
	r.Post("/", h.create)
}

// SearchRoutes are mounted under /search.
func (h *Handler) SearchRoutes(r chi.Router) {
	r.Get("/suggest", h.suggest)
	r.Get("/popular", h.popular)
}

// AdminRoutes are mounted under /admin/vacancies.
func (h *Handler) AdminRoutes(r chi.Router) {
	r.Get("/moderation", h.moderationQueue)
	r.Post("/{vacancy}/approve", h.approve)
	r.Post("/{vacancy}/reject", h.reject)
}

// ---- public ----------------------------------------------------------------------------

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	f, err := parseFilter(r)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	res, err := h.Svc.Cache.Get(r.Context(), f, func(ctx context.Context) (ListResult, error) { return h.Svc.List(ctx, f) })
	if err != nil {
		response.Error(w, r, err)
		return
	}
	if !f.Query.Empty() && f.After == nil && len(res.Cards) > 0 {
		h.Svc.Cache.RecordSearch(r.Context(), r.URL.Query().Get("q"))
	}
	w.Header().Set("Cache-Control", "public, max-age=15")
	response.List(w, res.Cards, listMeta{NextCursor: res.NextCursor, Total: res.Total,
		TotalCapped: res.TotalCapped, Fuzzy: res.Fuzzy})
}

type listMeta struct {
	NextCursor  *string `json:"next_cursor"`
	Total       *int    `json:"total,omitempty"`
	TotalCapped bool    `json:"total_capped,omitempty"`
	Fuzzy       bool    `json:"fuzzy,omitempty"`
}

func (h *Handler) suggest(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if len(q) > 100 {
		q = q[:100]
	}
	out, err := h.Svc.Suggest(r.Context(), q)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	response.JSON(w, http.StatusOK, out)
}

func (h *Handler) popular(w http.ResponseWriter, r *http.Request) {
	out, err := h.Svc.Cache.Popular(r.Context(), 10)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=300")
	response.JSON(w, http.StatusOK, out)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	var viewer *reqctx.Principal
	if p, ok := reqctx.PrincipalFrom(r.Context()); ok {
		viewer = &p
	}
	d, err := h.Svc.Get(r.Context(), chi.URLParam(r, "vacancy"), viewer, reqctx.ClientIP(r.Context()).String())
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

// ---- employer ----------------------------------------------------------------------------

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in Input
	if !response.DecodeValid(w, r, &in) {
		return
	}
	d, err := h.Svc.Create(r.Context(), reqctx.MustPrincipal(r.Context()), chi.URLParam(r, "company"), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, d)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, ok := vacancyID(w, r)
	if !ok {
		return
	}
	var in Input
	if !response.DecodeValid(w, r, &in) {
		return
	}
	d, err := h.Svc.Update(r.Context(), reqctx.MustPrincipal(r.Context()), id, in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

func (h *Handler) submit(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, h.Svc.Submit)
}

func (h *Handler) archive(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, h.Svc.Archive)
}

func (h *Handler) approve(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, h.Svc.Approve)
}

type transitionFn func(ctx context.Context, p reqctx.Principal, id uuid.UUID) (Detail, error)

func (h *Handler) transition(w http.ResponseWriter, r *http.Request, fn transitionFn) {
	id, ok := vacancyID(w, r)
	if !ok {
		return
	}
	d, err := fn(r.Context(), reqctx.MustPrincipal(r.Context()), id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id, ok := vacancyID(w, r)
	if !ok {
		return
	}
	if err := h.Svc.Delete(r.Context(), reqctx.MustPrincipal(r.Context()), id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (h *Handler) listForCompany(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var status *gen.VacancyStatus
	if s := q.Get("status"); s != "" {
		st := gen.VacancyStatus(s)
		if !st.Valid() {
			response.Error(w, r, apperr.Validation(map[string]string{"status": "oneof"}))
			return
		}
		status = &st
	}
	after, limit, err := paging(r)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	cards, next, err := h.Svc.ListForCompany(r.Context(), reqctx.MustPrincipal(r.Context()),
		chi.URLParam(r, "company"), status, after, limit)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.List(w, cards, cursor.Meta{NextCursor: next})
}

// ---- admin -------------------------------------------------------------------------------

type rejectRequest struct {
	Reason string `json:"reason" validate:"required,max=1000"`
}

func (h *Handler) reject(w http.ResponseWriter, r *http.Request) {
	id, ok := vacancyID(w, r)
	if !ok {
		return
	}
	var req rejectRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	d, err := h.Svc.Reject(r.Context(), reqctx.MustPrincipal(r.Context()), id, req.Reason)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

func (h *Handler) moderationQueue(w http.ResponseWriter, r *http.Request) {
	after, limit, err := paging(r)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	cards, next, err := h.Svc.ModerationQueue(r.Context(), after, limit)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.List(w, cards, cursor.Meta{NextCursor: next})
}

// ---- parsing -----------------------------------------------------------------------------

func vacancyID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "vacancy"))
	if err != nil {
		response.Error(w, r, ErrNotFound)
		return id, false
	}
	return id, true
}

var errCursor = apperr.BadRequest("invalid_cursor", "cursor is invalid")

func parseLimit(r *http.Request) (int, error) {
	if s := r.URL.Query().Get("limit"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n < 1 || n > maxLimit {
			return 0, apperr.Validation(map[string]string{"limit": "max=50"})
		}
		return n, nil
	}
	return defaultLimit, nil
}

func paging(r *http.Request) (*cursorKey, int, error) {
	q := r.URL.Query()
	limit, err := parseLimit(r)
	if err != nil {
		return nil, 0, err
	}
	var after *cursorKey
	if s := q.Get("cursor"); s != "" {
		var k cursorKey
		if err := cursor.Decode(s, &k); err != nil {
			return nil, 0, errCursor
		}
		after = &k
	}
	return after, limit, nil
}

var enumValues = map[string][]string{
	"employment_type": {"full_time", "part_time", "project", "internship", "volunteer"},
	"work_format":     {"office", "remote", "hybrid"},
	"experience":      {"none", "1_3", "3_6", "6_plus"},
	"schedule":        {"full_day", "shift", "flexible", "rotation"},
}

// parseFilter reads query params. Multi-value filters accept either repeated params
// (?work_format=remote&work_format=hybrid) or a comma list (?work_format=remote,hybrid).
func parseFilter(r *http.Request) (Filter, error) { return ParseFilter(r.URL.Query()) }

// ParseFilter builds a listing filter from query parameters (also used to replay
// saved searches).
func ParseFilter(q url.Values) (Filter, error) {
	var f Filter
	bad := map[string]string{}

	intParam := func(name string) *int32 {
		s := q.Get(name)
		if s == "" {
			return nil
		}
		n, err := strconv.ParseInt(s, 10, 32)
		if err != nil || n <= 0 {
			bad[name] = "numeric"
			return nil
		}
		v := int32(n)
		return &v
	}
	multi := func(name string) []string {
		var out []string
		for _, raw := range q[name] {
			for _, v := range strings.Split(raw, ",") {
				if v = strings.TrimSpace(v); v == "" {
					continue
				}
				if !slices.Contains(enumValues[name], v) {
					bad[name] = "oneof"
					continue
				}
				if !slices.Contains(out, v) {
					out = append(out, v)
				}
			}
		}
		slices.Sort(out) // canonical order → stable cache keys
		return out
	}

	if raw := q.Get("q"); raw != "" {
		if len([]rune(raw)) > 200 {
			bad["q"] = "max=200"
		}
		f.Query = searchq.Parse(raw)
	}
	switch f.Sort = q.Get("sort"); f.Sort {
	case "", SortNewest, SortRelevance:
	default:
		bad["sort"] = "oneof"
	}
	f.CategoryID = intParam("category_id")
	f.RegionID = intParam("region_id")
	f.DistrictID = intParam("district_id")
	f.EmploymentTypes = multi("employment_type")
	f.WorkFormats = multi("work_format")
	f.Experiences = multi("experience")
	f.Schedules = multi("schedule")
	f.WithSalary = q.Get("with_salary") == "true"

	if s := q.Get("company_id"); s != "" {
		id, err := uuid.Parse(s)
		if err != nil {
			bad["company_id"] = "uuid"
		} else {
			f.CompanyID = &id
		}
	}
	if s := q.Get("salary_from"); s != "" {
		n, err := strconv.ParseInt(s, 10, 64)
		if err != nil || n < 0 {
			bad["salary_from"] = "numeric"
		} else {
			f.SalaryFrom = &n
			f.Currency = strings.ToUpper(q.Get("currency"))
			if f.Currency == "" {
				f.Currency = "UZS"
			}
			if f.Currency != "UZS" && f.Currency != "USD" {
				bad["currency"] = "oneof"
			}
		}
	}
	if len(bad) > 0 {
		return f, apperr.Validation(bad)
	}

	f.Limit = defaultLimit
	if s := q.Get("limit"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n < 1 || n > maxLimit {
			return f, apperr.Validation(map[string]string{"limit": "max=50"})
		}
		f.Limit = n
	}
	if c := q.Get("cursor"); c != "" {
		var lc listCursor
		if err := cursor.Decode(c, &lc); err != nil || lc.Sort == "" {
			return f, errCursor
		}
		f.After = &lc
	}
	return f, nil
}
