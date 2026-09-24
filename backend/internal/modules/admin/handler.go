package admin

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/respcache"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

type Handler struct {
	Svc *Service
	// StatsCache holds the dashboard statistics for a few minutes (they scan a month of
	// sign-ups, vacancies and applications); nil computes them on every request.
	StatsCache *respcache.Cache
}

// NewStatsCache is the dashboard statistics cache: 5 minutes, then served stale for
// another 5 while one request refreshes it.
func NewStatsCache(rdb *redis.Client, log *slog.Logger) *respcache.Cache {
	return &respcache.Cache{RDB: rdb, Log: log, Name: "admin_stats", TTL: 5 * time.Minute, Stale: 5 * time.Minute}
}

// Routes are mounted under /admin (behind RequireRole("admin")).
func (h *Handler) Routes(r chi.Router) {
	r.Get("/users", h.users)
	r.Get("/users/{user}", h.user)
	r.Post("/users/{user}/block", h.blockUser)
	r.Post("/users/{user}/unblock", h.unblockUser)
	r.Get("/skills", h.skills)
	r.Put("/skills/{skill}/verification", h.setSkillVerified(true))
	r.Delete("/skills/{skill}/verification", h.setSkillVerified(false))
	r.Post("/skills/{skill}/merge", h.mergeSkill)
	r.Get("/stats", h.stats)
	r.Get("/audit-log", h.auditLog)
}

// CompanyRoutes are mounted under /admin/companies.
func (h *Handler) CompanyRoutes(r chi.Router) {
	r.Get("/", h.companies)
	r.Post("/{company}/block", h.blockCompany)
	r.Post("/{company}/unblock", h.unblockCompany)
}

// idCursor is the keyset position of the uuid-ordered admin lists.
type idCursor struct {
	ID uuid.UUID `json:"i"`
}

type intCursor struct {
	ID int32 `json:"n"`
}

var (
	errCursor = apperr.BadRequest("invalid_cursor", "cursor is invalid")
	noStore   = func(w http.ResponseWriter) { w.Header().Set("Cache-Control", "no-store") }
)

// page reads limit (1..100, default 20) and an optional cursor into c.
func page(r *http.Request, c any) (limit int, hasCursor bool, err error) {
	limit = 20
	q := r.URL.Query()
	if s := q.Get("limit"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n < 1 || n > 100 {
			return 0, false, apperr.Validation(map[string]string{"limit": "max=100"})
		}
		limit = n
	}
	if s := q.Get("cursor"); s != "" {
		if err := cursor.Decode(s, c); err != nil {
			return 0, false, errCursor
		}
		hasCursor = true
	}
	return limit, hasCursor, nil
}

func nextMeta(c any) cursor.Meta {
	if c == nil {
		return cursor.Meta{}
	}
	s := cursor.Encode(c)
	return cursor.Meta{NextCursor: &s}
}

// ---- users -------------------------------------------------------------------------------

func (h *Handler) users(w http.ResponseWriter, r *http.Request) {
	var c idCursor
	limit, has, err := page(r, &c)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	q := r.URL.Query()
	f := UserFilter{Q: q.Get("q"), Limit: limit}
	if has {
		f.Before = &c.ID
	}
	if s := q.Get("role"); s != "" {
		role := gen.UserRole(s)
		if !role.Valid() {
			response.Error(w, r, apperr.Validation(map[string]string{"role": "oneof"}))
			return
		}
		f.Role = &role
	}
	if s := q.Get("status"); s != "" {
		st := gen.UserStatus(s)
		if !st.Valid() {
			response.Error(w, r, apperr.Validation(map[string]string{"status": "oneof"}))
			return
		}
		f.Status = &st
	}
	out, next, err := h.Svc.Users(r.Context(), f)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	var nc any
	if next != nil {
		nc = idCursor{ID: *next}
	}
	noStore(w)
	response.List(w, out, nextMeta(nc))
}

func userID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "user"))
	if err != nil {
		response.Error(w, r, ErrUserNotFound)
		return id, false
	}
	return id, true
}

func (h *Handler) user(w http.ResponseWriter, r *http.Request) {
	id, ok := userID(w, r)
	if !ok {
		return
	}
	d, err := h.Svc.User(r.Context(), id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	noStore(w)
	response.JSON(w, http.StatusOK, d)
}

type blockRequest struct {
	Reason string `json:"reason" validate:"required,max=500"`
}

func (h *Handler) blockUser(w http.ResponseWriter, r *http.Request) {
	id, ok := userID(w, r)
	if !ok {
		return
	}
	var req blockRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	u, err := h.Svc.BlockUser(r.Context(), reqctx.MustPrincipal(r.Context()), id, req.Reason)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, u)
}

func (h *Handler) unblockUser(w http.ResponseWriter, r *http.Request) {
	id, ok := userID(w, r)
	if !ok {
		return
	}
	u, err := h.Svc.UnblockUser(r.Context(), id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, u)
}

// ---- companies ---------------------------------------------------------------------------

func (h *Handler) companies(w http.ResponseWriter, r *http.Request) {
	var c idCursor
	limit, has, err := page(r, &c)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	q := r.URL.Query()
	f := CompanyFilter{Q: q.Get("q"), Limit: limit}
	if has {
		f.Before = &c.ID
	}
	if s := q.Get("status"); s != "" {
		st := gen.CompanyStatus(s)
		if !st.Valid() {
			response.Error(w, r, apperr.Validation(map[string]string{"status": "oneof"}))
			return
		}
		f.Status = &st
	}
	if s := q.Get("verified"); s != "" {
		v, err := strconv.ParseBool(s)
		if err != nil {
			response.Error(w, r, apperr.Validation(map[string]string{"verified": "boolean"}))
			return
		}
		f.Verified = &v
	}
	out, next, err := h.Svc.ListCompanies(r.Context(), f)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	var nc any
	if next != nil {
		nc = idCursor{ID: *next}
	}
	noStore(w)
	response.List(w, out, nextMeta(nc))
}

func (h *Handler) blockCompany(w http.ResponseWriter, r *http.Request) {
	var req blockRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	c, err := h.Svc.BlockCompany(r.Context(), reqctx.MustPrincipal(r.Context()), chi.URLParam(r, "company"), req.Reason)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

func (h *Handler) unblockCompany(w http.ResponseWriter, r *http.Request) {
	c, err := h.Svc.UnblockCompany(r.Context(), chi.URLParam(r, "company"))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

// ---- skills ------------------------------------------------------------------------------

func (h *Handler) skills(w http.ResponseWriter, r *http.Request) {
	var c intCursor
	limit, has, err := page(r, &c)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	q := r.URL.Query()
	f := SkillFilter{Q: q.Get("q"), Limit: limit}
	if has {
		f.Before = &c.ID
	}
	if s := q.Get("verified"); s != "" {
		v, err := strconv.ParseBool(s)
		if err != nil {
			response.Error(w, r, apperr.Validation(map[string]string{"verified": "boolean"}))
			return
		}
		f.Verified = &v
	}
	out, next, err := h.Svc.Skills(r.Context(), f)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	var nc any
	if next != nil {
		nc = intCursor{ID: *next}
	}
	noStore(w)
	response.List(w, out, nextMeta(nc))
}

func skillID(w http.ResponseWriter, r *http.Request) (int32, bool) {
	n, err := strconv.ParseInt(chi.URLParam(r, "skill"), 10, 32)
	if err != nil || n <= 0 {
		response.Error(w, r, ErrSkillNotFound)
		return 0, false
	}
	return int32(n), true
}

func (h *Handler) setSkillVerified(v bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := skillID(w, r)
		if !ok {
			return
		}
		s, err := h.Svc.SetSkillVerified(r.Context(), id, v)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		response.JSON(w, http.StatusOK, s)
	}
}

type mergeRequest struct {
	IntoID int32 `json:"into_id" validate:"required,min=1"`
}

func (h *Handler) mergeSkill(w http.ResponseWriter, r *http.Request) {
	id, ok := skillID(w, r)
	if !ok {
		return
	}
	var req mergeRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	res, err := h.Svc.MergeSkill(r.Context(), id, req.IntoID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, res)
}

// ---- stats & audit -------------------------------------------------------------------------

func (h *Handler) stats(w http.ResponseWriter, r *http.Request) {
	days := 30
	if s := r.URL.Query().Get("days"); s != "" {
		n, err := strconv.Atoi(s)
		if err != nil || n < 1 || n > MaxStatsDays {
			response.Error(w, r, apperr.Validation(map[string]string{"days": "max=90"}))
			return
		}
		days = n
	}
	load := func(ctx context.Context) (respcache.Loaded, error) {
		st, err := h.Svc.Stats(ctx, days)
		if err != nil {
			return respcache.Loaded{}, err
		}
		body, err := response.Encode(st, nil)
		return respcache.Loaded{Body: body}, err
	}
	if h.StatsCache == nil {
		l, err := load(r.Context())
		if err != nil {
			response.Error(w, r, err)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "private, no-cache")
		_, _ = w.Write(l.Body)
		return
	}
	e, st, err := h.StatsCache.Get(r.Context(), "days:"+strconv.Itoa(days), load)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	h.StatsCache.Serve(w, r, e, st, "private, no-cache")
}

func (h *Handler) auditLog(w http.ResponseWriter, r *http.Request) {
	var c idCursor
	limit, has, err := page(r, &c)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	q := r.URL.Query()
	f := AuditFilter{Limit: limit}
	if has {
		f.Before = &c.ID
	}
	if s := q.Get("object_type"); s != "" {
		f.ObjectType = &s
	}
	if s := q.Get("object_id"); s != "" {
		f.ObjectID = &s
	}
	if s := q.Get("admin_id"); s != "" {
		id, err := uuid.Parse(s)
		if err != nil {
			response.Error(w, r, apperr.Validation(map[string]string{"admin_id": "uuid"}))
			return
		}
		f.AdminID = &id
	}
	out, next, err := h.Svc.AuditLog(r.Context(), f)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	var nc any
	if next != nil {
		nc = idCursor{ID: *next}
	}
	noStore(w)
	response.List(w, out, nextMeta(nc))
}
