// Package company manages employer profiles and their team members.
package company

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/phone"
	"jobvacancy.uz/backend/internal/pkg/random"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/slug"
	"jobvacancy.uz/backend/internal/pkg/translit"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

var (
	ErrNotFound             = apperr.NotFound("company_not_found", "company not found")
	ErrForbidden            = apperr.Forbidden("company_forbidden", "you don't have access to this company")
	ErrEmployerOnly         = apperr.Forbidden("employer_only", "only employer accounts can create companies")
	ErrVerificationRequired = apperr.Forbidden("verification_required", "confirm your email or phone first")
	ErrBlocked              = apperr.Forbidden("company_blocked", "this company is blocked")
	ErrMemberNotFound       = apperr.NotFound("member_not_found", "user not found or not an employer account")
	ErrCannotRemoveOwner    = apperr.BadRequest("cannot_remove_owner", "the owner can't be removed")
)

// Role ranks: owner > admin > recruiter. Recruiters manage vacancies; admins also manage
// the profile and team; only the owner can hand out the admin role.
var rank = map[gen.CompanyMemberRole]int{
	gen.CompanyMemberRoleRecruiter: 1,
	gen.CompanyMemberRoleAdmin:     2,
	gen.CompanyMemberRoleOwner:     3,
}

type Service struct {
	Pool    *pgxpool.Pool
	Q       *gen.Queries
	Catalog *catalog.Service
	// Changed runs after a public-facing change (profile, logo, verification) committed,
	// to drop cached pages that show the company (TZ BE-05). Optional.
	Changed func(ctx context.Context, c gen.Company)
}

// changed reports c to Changed, if set.
func (s *Service) changed(ctx context.Context, c gen.Company) {
	if s.Changed != nil {
		s.Changed(ctx, c)
	}
}

type Input struct {
	Name        string  `json:"name" validate:"required,min=2,max=120"`
	IndustryID  *int32  `json:"industry_id"`
	Size        *string `json:"size" validate:"omitempty,oneof=1-10 11-50 51-200 201-500 501-1000 1000+"`
	Website     *string `json:"website" validate:"omitempty,max=200"`
	Email       *string `json:"email" validate:"omitempty,email,max=254"`
	Phone       *string `json:"phone" validate:"omitempty,max=32"`
	RegionID    *int32  `json:"region_id"`
	Address     *string `json:"address" validate:"omitempty,max=300"`
	About       string  `json:"about" validate:"max=5000"`
	FoundedYear *int16  `json:"founded_year" validate:"omitempty,min=1800,max=2100"`
}

// normalize cleans the input and checks references against the catalog.
func (s *Service) normalize(in *Input) error {
	in.Name = strings.Join(strings.Fields(in.Name), " ")
	in.About = strings.TrimSpace(in.About)
	in.Website = trimPtr(in.Website)
	in.Email = trimPtr(in.Email)
	in.Address = trimPtr(in.Address)
	if in.Website != nil {
		w := *in.Website
		if !strings.Contains(w, "://") {
			w = "https://" + w
		}
		u, err := url.Parse(w)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || !strings.Contains(u.Host, ".") {
			return apperr.Validation(map[string]string{"website": "url"})
		}
		in.Website = &w
	}
	if p := trimPtr(in.Phone); p != nil {
		n, err := phone.Normalize(*p)
		if err != nil {
			return apperr.Validation(map[string]string{"phone": "phone"})
		}
		in.Phone = &n
	} else {
		in.Phone = nil
	}
	if in.IndustryID != nil {
		if err := s.Catalog.ValidateCategory(*in.IndustryID); err != nil {
			return apperr.Validation(map[string]string{"industry_id": "exists"})
		}
	}
	if in.RegionID != nil {
		if err := s.Catalog.ValidateLocation(*in.RegionID, nil); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) Create(ctx context.Context, p reqctx.Principal, in Input) (gen.Company, error) {
	if p.Role != string(gen.UserRoleEmployer) && p.Role != string(gen.UserRoleAdmin) {
		return gen.Company{}, ErrEmployerOnly
	}
	if err := s.RequireVerifiedUser(ctx, p.UserID); err != nil {
		return gen.Company{}, err
	}
	if err := s.normalize(&in); err != nil {
		return gen.Company{}, err
	}
	// Retry once if a same-named company grabbed the slug between our check and insert.
	var c gen.Company
	for attempt := 0; ; attempt++ {
		sl, err := s.uniqueSlug(ctx, in.Name)
		if err != nil {
			return gen.Company{}, err
		}
		err = postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
			c, err = q.CreateCompany(ctx, gen.CreateCompanyParams{
				OwnerID: p.UserID, Name: in.Name, Slug: sl, IndustryID: in.IndustryID, Size: sizePtr(in.Size),
				Website: in.Website, Email: in.Email, Phone: in.Phone, RegionID: in.RegionID,
				Address: in.Address, About: in.About, FoundedYear: in.FoundedYear,
			})
			if err != nil {
				return err
			}
			return q.AddCompanyMember(ctx, gen.AddCompanyMemberParams{
				CompanyID: c.ID, UserID: p.UserID, Role: gen.CompanyMemberRoleOwner,
			})
		})
		if isUnique(err) && attempt == 0 {
			continue
		}
		return c, err
	}
}

func (s *Service) Update(ctx context.Context, p reqctx.Principal, ref string, in Input) (gen.Company, error) {
	c, _, err := s.Authorize(ctx, p, ref, gen.CompanyMemberRoleAdmin)
	if err != nil {
		return gen.Company{}, err
	}
	if err := s.normalize(&in); err != nil {
		return gen.Company{}, err
	}
	// The slug stays fixed after creation so shared links keep working.
	var updated gen.Company
	err = postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
		updated, err = q.UpdateCompany(ctx, gen.UpdateCompanyParams{
			ID: c.ID, Name: in.Name, IndustryID: in.IndustryID, Size: sizePtr(in.Size),
			Website: in.Website, Email: in.Email, Phone: in.Phone, RegionID: in.RegionID,
			Address: in.Address, About: in.About, FoundedYear: in.FoundedYear,
		})
		if err != nil || updated.Name == c.Name {
			return err
		}
		// Vacancies are searchable by company name.
		return q.SetVacancySearchCompany(ctx, gen.SetVacancySearchCompanyParams{
			CompanyID: c.ID, Company: translit.Fold(updated.Name),
		})
	})
	if err == nil {
		s.changed(ctx, updated)
	}
	return updated, err
}

// Resolve finds a company by UUID or slug.
func (s *Service) Resolve(ctx context.Context, ref string) (gen.Company, error) {
	var c gen.Company
	var err error
	if id, perr := uuid.Parse(ref); perr == nil {
		c, err = s.Q.GetCompanyByID(ctx, id)
	} else {
		c, err = s.Q.GetCompanyBySlug(ctx, strings.ToLower(ref))
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return c, ErrNotFound
	}
	return c, err
}

// Authorize loads the company and checks the caller's membership role. Platform admins
// pass every check.
func (s *Service) Authorize(ctx context.Context, p reqctx.Principal, ref string, min gen.CompanyMemberRole) (gen.Company, gen.CompanyMemberRole, error) {
	c, err := s.Resolve(ctx, ref)
	if err != nil {
		return c, "", err
	}
	if p.Role == string(gen.UserRoleAdmin) {
		return c, gen.CompanyMemberRoleOwner, nil
	}
	role, err := s.Q.GetMemberRole(ctx, gen.GetMemberRoleParams{CompanyID: c.ID, UserID: p.UserID})
	if errors.Is(err, pgx.ErrNoRows) {
		return c, "", ErrForbidden
	}
	if err != nil {
		return c, "", err
	}
	if rank[role] < rank[min] {
		return c, role, ErrForbidden
	}
	if c.Status == gen.CompanyStatusBlocked {
		return c, role, ErrBlocked
	}
	return c, role, nil
}

// IsMember reports membership without failing (used for "can see drafts" checks).
func (s *Service) IsMember(ctx context.Context, p reqctx.Principal, companyID uuid.UUID) bool {
	if p.Role == string(gen.UserRoleAdmin) {
		return true
	}
	_, err := s.Q.GetMemberRole(ctx, gen.GetMemberRoleParams{CompanyID: companyID, UserID: p.UserID})
	return err == nil
}

func (s *Service) RequireVerifiedUser(ctx context.Context, userID uuid.UUID) error {
	u, err := s.Q.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	if u.EmailVerifiedAt == nil && u.PhoneVerifiedAt == nil {
		return ErrVerificationRequired
	}
	return nil
}

func (s *Service) Mine(ctx context.Context, userID uuid.UUID) ([]gen.ListUserCompaniesRow, error) {
	return s.Q.ListUserCompanies(ctx, userID)
}

// ---- members -----------------------------------------------------------------------------

func (s *Service) Members(ctx context.Context, p reqctx.Principal, ref string) ([]gen.ListCompanyMembersRow, error) {
	c, _, err := s.Authorize(ctx, p, ref, gen.CompanyMemberRoleRecruiter)
	if err != nil {
		return nil, err
	}
	return s.Q.ListCompanyMembers(ctx, c.ID)
}

// AddMember adds (or re-roles) an existing employer account by e-mail.
func (s *Service) AddMember(ctx context.Context, p reqctx.Principal, ref, email string, role gen.CompanyMemberRole) error {
	c, myRole, err := s.Authorize(ctx, p, ref, gen.CompanyMemberRoleAdmin)
	if err != nil {
		return err
	}
	if role == gen.CompanyMemberRoleOwner || rank[role] >= rank[myRole] && myRole != gen.CompanyMemberRoleOwner {
		return ErrForbidden
	}
	email = strings.ToLower(strings.TrimSpace(email))
	u, err := s.Q.GetUserByEmail(ctx, &email)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && u.Role != gen.UserRoleEmployer) {
		return ErrMemberNotFound
	}
	if err != nil {
		return err
	}
	if u.ID == c.OwnerID {
		return ErrCannotRemoveOwner
	}
	return s.Q.AddCompanyMember(ctx, gen.AddCompanyMemberParams{CompanyID: c.ID, UserID: u.ID, Role: role})
}

func (s *Service) RemoveMember(ctx context.Context, p reqctx.Principal, ref string, userID uuid.UUID) error {
	// Anyone may leave a company; removing others needs the admin role.
	min := gen.CompanyMemberRoleAdmin
	if userID == p.UserID {
		min = gen.CompanyMemberRoleRecruiter
	}
	c, _, err := s.Authorize(ctx, p, ref, min)
	if err != nil {
		return err
	}
	if userID == c.OwnerID {
		return ErrCannotRemoveOwner
	}
	n, err := s.Q.RemoveCompanyMember(ctx, gen.RemoveCompanyMemberParams{CompanyID: c.ID, UserID: userID})
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrMemberNotFound
	}
	return nil
}

// ---- admin -------------------------------------------------------------------------------

func (s *Service) SetVerified(ctx context.Context, ref string, verified bool) (gen.Company, error) {
	c, err := s.Resolve(ctx, ref)
	if err != nil {
		return c, err
	}
	c, err = s.Q.SetCompanyVerified(ctx, gen.SetCompanyVerifiedParams{ID: c.ID, Verified: verified})
	if err == nil {
		s.changed(ctx, c)
	}
	return c, err
}

// SetLogo stores the logo URL (nil removes it).
func (s *Service) SetLogo(ctx context.Context, id uuid.UUID, url *string) (gen.Company, error) {
	c, err := s.Q.SetCompanyLogoURL(ctx, gen.SetCompanyLogoURLParams{ID: id, LogoUrl: url})
	if err == nil {
		s.changed(ctx, c)
	}
	return c, err
}

// ---- helpers -----------------------------------------------------------------------------

func (s *Service) uniqueSlug(ctx context.Context, name string) (string, error) {
	base := slug.Make(name)
	if base == "" {
		base = "company"
	}
	for i := range 5 {
		candidate := base
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d", base, i+1)
		}
		taken, err := s.Q.CompanySlugExists(ctx, candidate)
		if err != nil {
			return "", err
		}
		if !taken {
			return candidate, nil
		}
	}
	return base + "-" + strings.ToLower(random.Token(4)), nil
}

func trimPtr(s *string) *string {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return &t
}

func sizePtr(s *string) *gen.CompanySize {
	if s == nil {
		return nil
	}
	v := gen.CompanySize(*s)
	return &v
}

func isUnique(err error) bool {
	var pe *pgconn.PgError
	return errors.As(err, &pe) && pe.Code == "23505"
}
