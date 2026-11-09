package admin

import (
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
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
	if s := q.Get("verified"); s != "" {
		v, err := strconv.ParseBool(s)
		if err == nil {
			f.Verified = &v
		} else {
			bad["verified"] = "boolean"
		}
	}
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

// ---- parsing -----------------------------------------------------------------------------

// userID parses {user}; a malformed id is reported like an unknown one (404 user_not_found).
func userID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "user"))
	if err != nil {
		response.Error(w, r, ErrUserNotFound)
		return id, false
	}
	return id, true
}

func searchText(s string) string {
	s = strings.TrimSpace(s)
	if r := []rune(s); len(r) > maxQueryLen {
		s = string(r[:maxQueryLen])
	}
	return s
}
