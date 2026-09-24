package company

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/file"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/respcache"
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
	// Cache serves the public profile page as cached bytes with an ETag (TZ BE-05);
	// Service.Changed invalidates it. Nil serves it uncached.
	Cache *respcache.Cache
	// Directory serves GET /companies; nil builds an uncached one (tests).
	Directory *Directory
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
	r.With(auth.Require).Patch("/{company}/members/{user}", h.setMemberRole)
	r.With(auth.Require).Get("/{company}/invites", h.invites)
	r.With(auth.Require).Post("/{company}/invites", h.invite)
	r.With(auth.Require).Delete("/{company}/invites/{invite}", h.revokeInvite)
	r.With(auth.Require).Post("/{company}/owner", h.transferOwnership)
}

// MeRoutes are mounted under /me.
func (h *Handler) MeRoutes(r chi.Router) {
	r.Get("/companies", h.mine)
	r.Get("/invites", h.myInvites)
	r.Post("/invites/{invite}/accept", h.acceptInvite)
	r.Post("/invites/{invite}/decline", h.declineInvite)
}

// AdminRoutes are mounted under /admin/companies.
func (h *Handler) AdminRoutes(r chi.Router) {
	r.Put("/{company}/verification", h.setVerified(true))
	r.Delete("/{company}/verification", h.setVerified(false))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	ref := chi.URLParam(r, "company")
	if h.Cache == nil {
		d, err := h.profile(r.Context(), ref)
		if err != nil {
			response.Error(w, r, err)
			return
		}
		response.JSON(w, http.StatusOK, d)
		return
	}
	e, st, err := h.Cache.Get(r.Context(), cacheKey(ref), func(ctx context.Context) (respcache.Loaded, error) {
		d, err := h.profile(ctx, ref)
		if err != nil {
			return respcache.Loaded{}, err
		}
		body, err := response.Encode(d, nil)
		return respcache.Loaded{Body: body}, err
	})
	if err != nil {
		response.Error(w, r, err)
		return
	}
	h.Cache.Serve(w, r, e, st, "public, max-age=60")
}

// cacheKey matches vacancy.RefKey: uuid and slug spellings are cached apart and
// invalidated together.
func cacheKey(ref string) string {
	if id, err := uuid.Parse(ref); err == nil {
		return "id:" + id.String()
	}
	return "slug:" + strings.ToLower(ref)
}

// profile is the public company page: the profile plus its open vacancy count.
func (h *Handler) profile(ctx context.Context, ref string) (DTO, error) {
	c, err := h.Svc.Resolve(ctx, ref)
	if err != nil {
		return DTO{}, err
	}
	if c.Status != gen.CompanyStatusActive { // blocked or closed
		return DTO{}, ErrNotFound
	}
	d := ToDTO(c)
	n := int64(c.OpenVacancies) // kept by a trigger on vacancies (TZ BE-03)
	d.OpenVacancies = &n
	return d, nil
}

// directory lists active companies, verified first, then by open vacancies (TZ BE-03).
// Two ways to page, both keyset: ?cursor= (from meta.next_cursor) or ?page=N, which seeks
// from a cached page anchor. meta also carries total and page_count for numbered pages.
func (h *Handler) directory(w http.ResponseWriter, r *http.Request) {
	qs := r.URL.Query()
	var q *string
	if s := strings.TrimSpace(qs.Get("q")); s != "" {
		if len([]rune(s)) > 100 {
			s = string([]rune(s)[:100])
		}
		p := likePattern(s)
		q = &p
	}
	page, _ := strconv.ParseInt(qs.Get("page"), 10, 64)
	page = max(page, 1)
	var after *DirKey
	if c := qs.Get("cursor"); c != "" {
		var k DirKey
		if err := cursor.Decode(c, &k); err != nil {
			response.Error(w, r, apperr.BadRequest("invalid_cursor", "cursor is invalid"))
			return
		}
		after = &k
	}
	dir := h.dir()
	anchors, err := dir.Anchors(r.Context(), q, page)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	meta := directoryMeta{Total: anchors.Total, PageCount: anchors.PageCount()}
	if after == nil {
		meta.Page = &page
		start, ok := anchors.Start(page)
		if !ok { // past the last page
			w.Header().Set("Cache-Control", "public, max-age=60")
			response.List(w, []DTO{}, meta)
			return
		}
		after = &start
	}
	res, err := dir.List(r.Context(), q, *after)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	if res.Next != nil {
		c := cursor.Encode(*res.Next)
		meta.NextCursor = &c
		if meta.Page != nil {
			n := page + 1
			meta.NextPage = &n
		}
	}
	out := make([]DTO, len(res.Companies))
	for i, c := range res.Companies {
		out[i] = ToDTO(c)
		n := int64(c.OpenVacancies)
		out[i].OpenVacancies = &n
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	response.List(w, out, meta)
}

type directoryMeta struct {
	// Page is the requested page number (null when paging by cursor).
	Page       *int64  `json:"page"`
	NextPage   *int64  `json:"next_page"`
	NextCursor *string `json:"next_cursor"`
	// Total and PageCount come from the cached page anchors and may lag new companies or
	// ranking changes by a few minutes.
	Total     int64 `json:"total"`
	PageCount int64 `json:"page_count"`
}

func (h *Handler) dir() *Directory {
	if h.Directory != nil {
		return h.Directory
	}
	return &Directory{Q: h.Svc.Q}
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
	c, err = h.Svc.SetLogo(r.Context(), c.ID, url)
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

// ---- invites, roles, ownership (TZ FN-05, FN-03) ------------------------------------------

func (h *Handler) invite(w http.ResponseWriter, r *http.Request) {
	var req addMemberRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	inv, err := h.Svc.Invite(r.Context(), reqctx.MustPrincipal(r.Context()), chi.URLParam(r, "company"),
		req.Email, gen.CompanyMemberRole(req.Role))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, inv)
}

func (h *Handler) invites(w http.ResponseWriter, r *http.Request) {
	out, err := h.Svc.Invites(r.Context(), reqctx.MustPrincipal(r.Context()), chi.URLParam(r, "company"))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, http.StatusOK, out)
}

func inviteID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "invite"))
	if err != nil {
		response.Error(w, r, ErrInviteNotFound)
		return id, false
	}
	return id, true
}

func (h *Handler) revokeInvite(w http.ResponseWriter, r *http.Request) {
	id, ok := inviteID(w, r)
	if !ok {
		return
	}
	if err := h.Svc.RevokeInvite(r.Context(), reqctx.MustPrincipal(r.Context()), chi.URLParam(r, "company"), id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

func (h *Handler) myInvites(w http.ResponseWriter, r *http.Request) {
	out, err := h.Svc.MyInvites(r.Context(), reqctx.MustPrincipal(r.Context()).UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	response.JSON(w, http.StatusOK, out)
}

func (h *Handler) acceptInvite(w http.ResponseWriter, r *http.Request) {
	id, ok := inviteID(w, r)
	if !ok {
		return
	}
	d, err := h.Svc.AcceptInvite(r.Context(), reqctx.MustPrincipal(r.Context()), id)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}

func (h *Handler) declineInvite(w http.ResponseWriter, r *http.Request) {
	id, ok := inviteID(w, r)
	if !ok {
		return
	}
	if err := h.Svc.DeclineInvite(r.Context(), reqctx.MustPrincipal(r.Context()), id); err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

type roleRequest struct {
	Role string `json:"role" validate:"required,oneof=admin recruiter"`
}

func (h *Handler) setMemberRole(w http.ResponseWriter, r *http.Request) {
	uid, err := uuid.Parse(chi.URLParam(r, "user"))
	if err != nil {
		response.Error(w, r, ErrMemberNotFound)
		return
	}
	var req roleRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	err = h.Svc.SetMemberRole(r.Context(), reqctx.MustPrincipal(r.Context()), chi.URLParam(r, "company"), uid,
		gen.CompanyMemberRole(req.Role))
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.NoContent(w)
}

type ownerRequest struct {
	UserID uuid.UUID `json:"user_id" validate:"required"`
}

func (h *Handler) transferOwnership(w http.ResponseWriter, r *http.Request) {
	var req ownerRequest
	if !response.DecodeValid(w, r, &req) {
		return
	}
	d, err := h.Svc.TransferOwnership(r.Context(), reqctx.MustPrincipal(r.Context()), chi.URLParam(r, "company"), req.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, d)
}
