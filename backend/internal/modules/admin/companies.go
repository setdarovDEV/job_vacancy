package admin

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/audit"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

// CompanyFilter selects a page of the admin company list.
type CompanyFilter struct {
	Q        string
	Status   *gen.CompanyStatus
	Verified *bool
	Before   *uuid.UUID
	Limit    int
}

// ListCompanies lists companies of any status, newest first.
func (s *Service) ListCompanies(ctx context.Context, f CompanyFilter) ([]CompanyDTO, *uuid.UUID, error) {
	rows, err := postgres.PlanPerCall(s.Pool).AdminListCompanies(ctx, gen.AdminListCompaniesParams{
		Q: likeArg(f.Q), Status: f.Status, Verified: f.Verified, BeforeID: f.Before, MaxResults: int32(f.Limit + 1),
	})
	if err != nil {
		return nil, nil, err
	}
	var next *uuid.UUID
	if len(rows) > f.Limit {
		rows = rows[:f.Limit]
		next = &rows[len(rows)-1].Company.ID
	}
	out := make([]CompanyDTO, len(rows))
	for i, r := range rows {
		out[i] = companyOf(r.Company, r.OwnerName, r.OwnerEmail)
	}
	return out, next, nil
}

// BlockCompany hides a company: its page answers 404, it leaves the directory, and its
// published and pending vacancies are unpublished at once (their cached pages and every
// listing are invalidated after commit, so they leave search on the next request; TZ
// FN-01 asks for ≤ 1 minute). Members can no longer manage it.
func (s *Service) BlockCompany(ctx context.Context, admin reqctx.Principal, ref, reason string) (CompanyDTO, error) {
	reason = strings.TrimSpace(reason)
	if len([]rune(reason)) < 3 {
		return CompanyDTO{}, errReason
	}
	c, err := s.Companies.Resolve(ctx, ref)
	if err != nil {
		return CompanyDTO{}, err
	}
	var refs []gen.UnpublishCompanyVacanciesRow
	err = postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
		var err error
		c, err = q.SetCompanyStatus(ctx, gen.SetCompanyStatusParams{ID: c.ID, Status: gen.CompanyStatusBlocked, FromStatus: gen.CompanyStatusActive})
		if isNoRows(err) {
			return errUnchanged // already blocked (or closed)
		}
		if err != nil {
			return err
		}
		if refs, err = q.UnpublishCompanyVacancies(ctx, gen.UnpublishCompanyVacanciesParams{AdminID: &admin.UserID, CompanyID: c.ID}); err != nil {
			return err
		}
		ids := make([]uuid.UUID, len(refs))
		for i, r := range refs {
			ids[i] = r.ID
		}
		return audit.Write(ctx, q, audit.Entry{Action: "company.block", ObjectType: audit.ObjectCompany, ObjectID: c.ID.String(),
			Details: map[string]any{"name": c.Name, "reason": reason, "vacancies_unpublished": ids}})
	})
	if errors.Is(err, errUnchanged) {
		return s.companyDTO(ctx, c.ID)
	}
	if err != nil {
		return CompanyDTO{}, err
	}
	vrefs := make([]vacancy.VacancyRef, len(refs))
	for i, r := range refs {
		vrefs[i] = vacancy.VacancyRef{ID: r.ID, Slug: r.Slug, CompanyID: r.CompanyID, CompanySlug: r.CompanySlug}
	}
	s.afterCommit(ctx, nil, vrefs)
	s.Cache.CompanyChanged(ctx, s.Q, c)
	s.Log.InfoContext(ctx, "company blocked", "company_id", c.ID, "vacancies", len(refs))
	return s.companyDTO(ctx, c.ID)
}

// UnblockCompany makes a blocked company active again. Its unpublished vacancies stay
// archived until the company republishes them.
func (s *Service) UnblockCompany(ctx context.Context, ref string) (CompanyDTO, error) {
	c, err := s.Companies.Resolve(ctx, ref)
	if err != nil {
		return CompanyDTO{}, err
	}
	err = postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
		var err error
		c, err = q.SetCompanyStatus(ctx, gen.SetCompanyStatusParams{ID: c.ID, Status: gen.CompanyStatusActive, FromStatus: gen.CompanyStatusBlocked})
		if isNoRows(err) {
			return errUnchanged
		}
		if err != nil {
			return err
		}
		return audit.Write(ctx, q, audit.Entry{Action: "company.unblock", ObjectType: audit.ObjectCompany,
			ObjectID: c.ID.String(), Details: map[string]any{"name": c.Name}})
	})
	if err != nil && !errors.Is(err, errUnchanged) {
		return CompanyDTO{}, err
	}
	if err == nil {
		s.Cache.CompanyChanged(ctx, s.Q, c)
	}
	return s.companyDTO(ctx, c.ID)
}

func (s *Service) companyDTO(ctx context.Context, id uuid.UUID) (CompanyDTO, error) {
	c, err := s.Q.GetCompanyByID(ctx, id)
	if err != nil {
		return CompanyDTO{}, err
	}
	owner, err := s.Q.GetUserByID(ctx, c.OwnerID)
	if err != nil {
		return CompanyDTO{}, err
	}
	return companyOf(c, owner.FullName, owner.Email), nil
}
