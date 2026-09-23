package company

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/file"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	mw "jobvacancy.uz/backend/internal/transport/http/middleware"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

// DTO is the public company profile.
type DTO struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	LogoURL     *string   `json:"logo_url"`
	CoverURL    *string   `json:"cover_url"`
	IndustryID  *int32    `json:"industry_id"`
	Size        *string   `json:"size"`
	Website     *string   `json:"website"`
	Email       *string   `json:"email"`
	Phone       *string   `json:"phone"`
	RegionID    *int32    `json:"region_id"`
	Address     *string   `json:"address"`
	About       string    `json:"about"`
	FoundedYear *int16    `json:"founded_year"`
	Verified    bool      `json:"verified"`
	CreatedAt   time.Time `json:"created_at"`
	// Set on the public profile page.
	OpenVacancies *int64 `json:"open_vacancies,omitempty"`
	// Set in "my companies".
	MyRole string `json:"my_role,omitempty"`
}

// Summary is embedded in vacancy cards.
type Summary struct {
	ID       uuid.UUID `json:"id"`
	Name     string    `json:"name"`
	Slug     string    `json:"slug"`
	LogoURL  *string   `json:"logo_url"`
	Verified bool      `json:"verified"`
}

func ToDTO(c gen.Company) DTO {
	d := DTO{
		ID: c.ID, Name: c.Name, Slug: c.Slug, LogoURL: c.LogoUrl, CoverURL: c.CoverUrl,
		IndustryID: c.IndustryID, Website: c.Website, Email: c.Email, Phone: c.Phone,
		RegionID: c.RegionID, Address: c.Address, About: c.About, FoundedYear: c.FoundedYear,
		Verified: c.VerifiedAt != nil, CreatedAt: c.CreatedAt,
	}
	if c.Size != nil {
		s := string(*c.Size)
		d.Size = &s
	}
	return d
}

type memberDTO struct {
	UserID    uuid.UUID `json:"user_id"`
	FullName  string    `json:"full_name"`
	Email     *string   `json:"email"`
	AvatarURL *string   `json:"avatar_url"`
	Role      string    `json:"role"`
	JoinedAt  time.Time `json:"joined_at"`
}

type addMemberRequest struct {
	Email string `json:"email" validate:"required,email"`
	Role  string `json:"role" validate:"required,oneof=admin recruiter"`
}

type Handler struct {
	Svc   *Service
	Files *file.Service
}

// Routes are mounted under /companies. Reads are public; writes need a signed-in employer.
func (h *Handler) Routes(r chi.Router, auth *mw.Authenticator) {
	r.Get("/", h.directory)
	r.Get("/{company}", h.get)
	r.With(auth.Require).Post("/", h.create)
	r.With(auth.Require).Put("/{company}", h.update)
	r.With(auth.Require).Put("/{company}/logo", h.setLogo)
	r.With(auth.Require).Get("/{company}/members", h.members)
	r.With(auth.Require).Post("/{company}/members", h.addMember)
	r.With(auth.Require).Delete("/{company}/members/{user}", h.removeMember)
}

// MeRoutes are mounted under /me.
func (h *Handler) MeRoutes(r chi.Router) {
	r.Get("/companies", h.mine)
}

// AdminRoutes are mounted under /admin/companies.
func (h *Handler) AdminRoutes(r chi.Router) {
	r.Put("/{company}/verification", h.setVerified(true))
	r.Delete("/{company}/verification", h.setVerified(false))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	c, err := h.Svc.Resolve(r.Context(), chi.URLParam(r, "company"))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	if c.Status == gen.CompanyStatusBlocked {
		response.Error(w, r, ErrNotFound)
		return
	}
	n, err := h.Svc.Q.CountPublishedVacancies(r.Context(), c.ID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	d := ToDTO(c)
	d.OpenVacancies = &n
	response.JSON(w, http.StatusOK, d)
}

// directory lists active companies (?q=name, ?page=1…), 24 per page.
func (h *Handler) directory(w http.ResponseWriter, r *http.Request) {
	const per = 24
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	page = max(page, 1)
	var q *string
	if s := strings.TrimSpace(r.URL.Query().Get("q")); s != "" {
		if len([]rune(s)) > 100 {
			s = string([]rune(s)[:100])
		}
		q = &s
	}
	rows, err := h.Svc.Q.ListCompaniesDirectory(r.Context(), gen.ListCompaniesDirectoryParams{
		Q: q, MaxResults: per + 1, Skip: int32((page - 1) * per),
	})
	if err != nil {
		response.Error(w, r, err)
		return
	}
	var next *int
	if len(rows) > per {
		rows = rows[:per]
		n := page + 1
		next = &n
	}
	out := make([]DTO, len(rows))
	for i, row := range rows {
		out[i] = ToDTO(row.Company)
		n := int64(row.OpenVacancies)
		out[i].OpenVacancies = &n
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	response.List(w, out, map[string]any{"next_page": next})
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in Input
	if !response.DecodeValid(w, r, &in) {
		return
	}
	c, err := h.Svc.Create(r.Context(), reqctx.MustPrincipal(r.Context()), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	d := ToDTO(c)
	d.MyRole = string(gen.CompanyMemberRoleOwner)
	response.JSON(w, http.StatusCreated, d)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	var in Input
	if !response.DecodeValid(w, r, &in) {
		return
	}
	c, err := h.Svc.Update(r.Context(), reqctx.MustPrincipal(r.Context()), chi.URLParam(r, "company"), in)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, ToDTO(c))
}

func (h *Handler) setLogo(w http.ResponseWriter, r *http.Request) {
	p := reqctx.MustPrincipal(r.Context())
	var req file.FileRef
	if !response.DecodeValid(w, r, &req) {
		return
	}
	c, _, err := h.Svc.Authorize(r.Context(), p, chi.URLParam(r, "company"), gen.CompanyMemberRoleAdmin)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	var url *string
	if req.FileID != nil {
		f, err := h.Files.Use(r.Context(), p.UserID, *req.FileID, gen.FilePurposeCompanyLogo)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		u := h.Files.Storage.PublicURL(f.ObjectKey)
		url = &u
	}
	c, err = h.Svc.Q.SetCompanyLogoURL(r.Context(), gen.SetCompanyLogoURLParams{ID: c.ID, LogoUrl: url})
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, ToDTO(c))
}

func (h *Handler) mine(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Svc.Mine(r.Context(), reqctx.MustPrincipal(r.Context()).UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	out := make([]DTO, len(rows))
	for i, row := range rows {
		out[i] = ToDTO(row.Company)
		out[i].MyRole = string(row.Role)
	}
	response.JSON(w, http.StatusOK, out)
}

func (h *Handler) members(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Svc.Members(r.Context(), reqctx.MustPrincipal(r.Context()), chi.URLParam(r, "company"))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	out := make([]memberDTO, len(rows))
	for i, m := range rows {
		out[i] = memberDTO{UserID: m.ID, FullName: m.FullName, Email: m.Email,
			AvatarURL: m.AvatarUrl, Role: string(m.Role), JoinedAt: m.CreatedAt}
	}
	response.JSON(w, http.StatusOK, out)
}

func (h *Handler) addMember(w http.ResponseWriter, r *http.Request) {
	var req addMemberRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	err := h.Svc.AddMember(r.Context(), reqctx.MustPrincipal(r.Context()), chi.URLParam(r, "company"),
		req.Email, gen.CompanyMemberRole(req.Role))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (h *Handler) removeMember(w http.ResponseWriter, r *http.Request) {
	uid, err := uuid.Parse(chi.URLParam(r, "user"))
	if err != nil {
		response.Error(w, r, ErrMemberNotFound)
		return
	}
	if err := h.Svc.RemoveMember(r.Context(), reqctx.MustPrincipal(r.Context()), chi.URLParam(r, "company"), uid); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (h *Handler) setVerified(v bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := h.Svc.SetVerified(r.Context(), chi.URLParam(r, "company"), v)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		response.JSON(w, http.StatusOK, ToDTO(c))
	}
}
