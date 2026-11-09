package admin

import (
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

const maxQueryLen = 100

// Deleted accounts are never listed, so they aren't a filter value either.
var listableUserStatuses = []gen.UserStatus{gen.UserStatusActive, gen.UserStatusBlocked}

type Handler struct{ Svc *Service }

// Routes are mounted inside /admin (admins only).
func (h *Handler) Routes(r chi.Router) {
	r.Get("/stats", h.stats)
	r.Get("/stats/activity", h.activity)
	r.Get("/stats/breakdown", h.breakdown)
}

// CompanyRoutes are mounted under /admin/companies. Flags use PUT (set) / DELETE (clear).
func (h *Handler) CompanyRoutes(r chi.Router) {
	r.Get("/", h.companies)
	r.Put("/{company}/verification", h.setCompanyVerified(true))
	r.Delete("/{company}/verification", h.setCompanyVerified(false))
	r.Put("/{company}/block", h.setCompanyBlocked(true))
	r.Delete("/{company}/block", h.setCompanyBlocked(false))
}

// UserRoutes are mounted under /admin/users.
func (h *Handler) UserRoutes(r chi.Router) {
	r.Get("/", h.users)
	r.Put("/{user}/role", h.setRole)
	r.Put("/{user}/block", h.setUserBlocked(true))
	r.Delete("/{user}/block", h.setUserBlocked(false))
}

func (h *Handler) activity(w http.ResponseWriter, r *http.Request) {
	p, ok := statsPeriod(w, r)
	if !ok {
		return
	}
	a, err := h.Svc.Activity(r.Context(), p)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, a)
}

func (h *Handler) breakdown(w http.ResponseWriter, r *http.Request) {
	p, ok := statsPeriod(w, r)
	if !ok {
		return
	}
	b, err := h.Svc.Breakdown(r.Context(), p)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, b)
}

// statsPeriod reads ?days= (default DefaultStatsPeriod).
func statsPeriod(w http.ResponseWriter, r *http.Request) (StatsPeriod, bool) {
	s := r.URL.Query().Get("days")
	if s == "" {
		return DefaultStatsPeriod, true
	}
	n, err := strconv.Atoi(s)
	if p := StatsPeriod(n); err == nil && p.Valid() {
		return p, true
	}
	response.Error(w, r, errStatsPeriod)
	return 0, false
}

func (h *Handler) stats(w http.ResponseWriter, r *http.Request) {
	s, err := h.Svc.Stats(r.Context())
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, statsDTO(s))
}

func (h *Handler) companies(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	after, limit, err := cursor.ParseAdminPage(r.URL.Query())
	if err != nil {
		response.Error(w, r, err)
		return
	}
	f := CompanyFilter{Query: searchText(q.Get("q")), After: after, Limit: limit}
	bad := map[string]string{}
	if s := q.Get("status"); s != "" {
		st := gen.CompanyStatus(s)
		if st.Valid() {
			f.Status = &st
		} else {
			bad["status"] = apperr.OneOf(gen.AllCompanyStatusValues())
		}
	}
	f.Verified = boolParam(q, "verified", bad)
	if len(bad) > 0 {
		response.Error(w, r, apperr.Validation(bad))
		return
	}
	rows, meta, err := h.Svc.ListCompanies(r.Context(), f)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.List(w, mapSlice(rows, companyDTO), meta)
}

func (h *Handler) setCompanyVerified(verified bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := h.Svc.SetCompanyVerified(r.Context(), chi.URLParam(r, "company"), verified)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		response.JSON(w, http.StatusOK, companyDTO(c))
	}
}

func (h *Handler) setCompanyBlocked(blocked bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := h.Svc.SetCompanyBlocked(r.Context(), chi.URLParam(r, "company"), blocked)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		response.JSON(w, http.StatusOK, companyDTO(c))
	}
}

func (h *Handler) users(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	after, limit, err := cursor.ParseAdminPage(r.URL.Query())
	if err != nil {
		response.Error(w, r, err)
		return
	}
	f := UserFilter{Query: searchText(q.Get("q")), After: after, Limit: limit}
	bad := map[string]string{}
	if s := q.Get("role"); s != "" {
		role := gen.UserRole(s)
		if role.Valid() {
			f.Role = &role
		} else {
			bad["role"] = apperr.OneOf(gen.AllUserRoleValues())
		}
	}
	if s := q.Get("status"); s != "" {
		st := gen.UserStatus(s)
		if slices.Contains(listableUserStatuses, st) {
			f.Status = &st
		} else {
			bad["status"] = apperr.OneOf(listableUserStatuses)
		}
	}
	if len(bad) > 0 {
		response.Error(w, r, apperr.Validation(bad))
		return
	}
	rows, meta, err := h.Svc.ListUsers(r.Context(), f)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.List(w, mapSlice(rows, userDTO), meta)
}

type roleRequest struct {
	Role string `json:"role" validate:"required,oneof=seeker employer admin"`
}

func (h *Handler) setRole(w http.ResponseWriter, r *http.Request) {
	id, ok := userID(w, r)
	if !ok {
		return
	}
	var req roleRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	u, err := h.Svc.SetUserRole(r.Context(), reqctx.MustPrincipal(r.Context()), id, gen.UserRole(req.Role))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, userDTO(u))
}

func (h *Handler) setUserBlocked(blocked bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := userID(w, r)
		if !ok {
			return
		}
		u, err := h.Svc.SetUserBlocked(r.Context(), reqctx.MustPrincipal(r.Context()), id, blocked)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		response.JSON(w, http.StatusOK, userDTO(u))
	}
}

// SkillRoutes are mounted under /admin/skills. The verification flag uses PUT / DELETE;
// a rename edits the resource (PATCH); a merge is a one-way action with a payload (POST).
func (h *Handler) SkillRoutes(r chi.Router) {
	r.Get("/", h.skills)
	r.Post("/verification", h.verifySkills) // bulk: verify many in one transaction
	r.Put("/{skill}/verification", h.setSkillVerified(true))
	r.Delete("/{skill}/verification", h.setSkillVerified(false))
	r.Patch("/{skill}", h.renameSkill)
	r.Post("/{skill}/merge", h.mergeSkill)
	r.Delete("/{skill}", h.deleteSkill)
}

func (h *Handler) skills(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	bad := map[string]string{}
	f := SkillFilter{Query: searchText(q.Get("q")), Sort: SkillSorts[0]}
	if s := q.Get("sort"); s != "" {
		if slices.Contains(SkillSorts, SkillSort(s)) {
			f.Sort = SkillSort(s)
		} else {
			bad["sort"] = apperr.OneOf(SkillSorts)
		}
	}
	f.Verified = boolParam(q, "verified", bad)
	limit, err := cursor.ParseLimit(q.Get("limit"), cursor.AdminDefaultLimit, cursor.AdminMaxLimit)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	if len(bad) > 0 {
		response.Error(w, r, apperr.Validation(bad))
		return
	}
	if f.After, err = cursor.ParseAfter[SkillCursor](q.Get("cursor")); err != nil {
		response.Error(w, r, err)
		return
	}
	f.Limit = limit
	rows, meta, err := h.Svc.ListSkills(r.Context(), f)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.List(w, mapSlice(rows, skillDTO), meta)
}

func (h *Handler) setSkillVerified(verified bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := skillID(w, r)
		if !ok {
			return
		}
		sk, err := h.Svc.SetSkillVerified(r.Context(), id, verified)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		response.JSON(w, http.StatusOK, skillDTO(sk))
	}
}

// The max must equal catalog.MaxSkillNameLen (tags can't reference constants; a test
// keeps them in sync).
type renameSkillRequest struct {
	Name string `json:"name" validate:"required,max=50"`
}

type verifySkillsRequest struct {
	IDs []int32 `json:"ids" validate:"required,min=1,max=100,unique,dive,min=1"`
}

func (h *Handler) verifySkills(w http.ResponseWriter, r *http.Request) {
	var req verifySkillsRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	rows, err := h.Svc.VerifySkills(r.Context(), req.IDs)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, mapSlice(rows, skillDTO))
}

func (h *Handler) renameSkill(w http.ResponseWriter, r *http.Request) {
	id, ok := skillID(w, r)
	if !ok {
		return
	}
	var req renameSkillRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	sk, err := h.Svc.RenameSkill(r.Context(), id, req.Name)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, skillDTO(sk))
}

type mergeSkillRequest struct {
	Into int32 `json:"into" validate:"required,min=1"`
}

func (h *Handler) mergeSkill(w http.ResponseWriter, r *http.Request) {
	id, ok := skillID(w, r)
	if !ok {
		return
	}
	var req mergeSkillRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	sk, err := h.Svc.MergeSkill(r.Context(), id, req.Into)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, skillDTO(sk))
}

func (h *Handler) deleteSkill(w http.ResponseWriter, r *http.Request) {
	id, ok := skillID(w, r)
	if !ok {
		return
	}
	if err := h.Svc.DeleteSkill(r.Context(), id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

// ---- parsing -----------------------------------------------------------------------------

// skillID parses {skill}; a malformed id is reported like an unknown one (404 skill_not_found).
func skillID(w http.ResponseWriter, r *http.Request) (int32, bool) {
	n, err := strconv.ParseInt(chi.URLParam(r, "skill"), 10, 32)
	if err != nil || n < 1 {
		response.Error(w, r, catalog.ErrSkillNotFound)
		return 0, false
	}
	return int32(n), true
}

// userID parses {user}; a malformed id is reported like an unknown one (404 user_not_found).
func userID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "user"))
	if err != nil {
		response.Error(w, r, ErrUserNotFound)
		return id, false
	}
	return id, true
}

// boolParam reads an optional true/false query parameter; a bad value is recorded in bad.
func boolParam(q url.Values, name string, bad map[string]string) *bool {
	s := q.Get(name)
	if s == "" {
		return nil
	}
	v, err := strconv.ParseBool(s)
	if err != nil {
		bad[name] = "boolean"
		return nil
	}
	return &v
}

func searchText(s string) string {
	s = strings.TrimSpace(s)
	if r := []rune(s); len(r) > maxQueryLen {
		s = string(r[:maxQueryLen])
	}
	return s
}
