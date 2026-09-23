// Package vacancy implements the vacancy lifecycle:
//
//	draft ──submit──► moderation ──approve──► published ──archive──► archived
//	  │                   │ reject                │ (30 days)
//	  │                   ▼                       ▼
//	  └─ (verified company: submit publishes directly)   expired ──submit──► …
//
// Verified companies skip moderation. When an unverified company edits a published
// vacancy, it goes back to moderation.
package vacancy

import (
	"context"
	"errors"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/random"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/slug"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

const PublishDays = 30

var (
	ErrNotFound       = apperr.NotFound("vacancy_not_found", "vacancy not found")
	ErrTransition     = apperr.Conflict("invalid_status_transition", "this action isn't allowed in the vacancy's current status")
	ErrOnlyDrafts     = apperr.Conflict("only_drafts_deletable", "only drafts can be deleted; archive the vacancy instead")
	ErrSalaryRange    = apperr.Validation(map[string]string{"salary_max": "gtefield=salary_min"})
	ErrRejectReason   = apperr.Validation(map[string]string{"reason": "min=5"})
	resubmittable     = []string{"draft", "rejected", "archived", "expired"}
	fromModerationSet = []string{"moderation"}
)

type Service struct {
	Pool      *pgxpool.Pool
	Q         *gen.Queries
	Companies *company.Service
	Catalog   *catalog.Service
	Views     *ViewCounter
	Cache     *ListCache
	Notify    *notification.Service
	Log       *slog.Logger
}

func (s *Service) normalize(in *Input) error {
	in.Title = strings.Join(strings.Fields(in.Title), " ")
	in.Description = strings.TrimSpace(in.Description)
	if in.Address != nil {
		a := strings.TrimSpace(*in.Address)
		if a == "" {
			in.Address = nil
		} else {
			in.Address = &a
		}
	}
	if in.Currency == "" {
		in.Currency = string(gen.CurrencyUZS)
	}
	if in.SalaryMin != nil && in.SalaryMax != nil && *in.SalaryMin > *in.SalaryMax {
		return ErrSalaryRange
	}
	if err := s.Catalog.ValidateCategory(in.CategoryID); err != nil {
		return err
	}
	return s.Catalog.ValidateLocation(in.RegionID, in.DistrictID)
}

// ---- writes ----------------------------------------------------------------------------

func (s *Service) Create(ctx context.Context, p reqctx.Principal, companyRef string, in Input) (Detail, error) {
	c, _, err := s.Companies.Authorize(ctx, p, companyRef, gen.CompanyMemberRoleRecruiter)
	if err != nil {
		return Detail{}, err
	}
	if err := s.normalize(&in); err != nil {
		return Detail{}, err
	}
	skills, err := s.Catalog.ResolveSkills(ctx, in.Skills)
	if err != nil {
		return Detail{}, err
	}

	var v gen.Vacancy
	for attempt := 0; ; attempt++ {
		err = postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
			v, err = q.CreateVacancy(ctx, gen.CreateVacancyParams{
				CompanyID: c.ID, CreatedBy: p.UserID, Title: in.Title, Slug: newSlug(in.Title),
				Description: in.Description, CategoryID: in.CategoryID, RegionID: in.RegionID,
				DistrictID: in.DistrictID, Address: in.Address, SalaryMin: in.SalaryMin, SalaryMax: in.SalaryMax,
				Currency: gen.Currency(in.Currency), EmploymentType: gen.EmploymentType(in.EmploymentType),
				WorkFormat: gen.WorkFormat(in.WorkFormat), Experience: gen.ExperienceLevel(in.Experience),
				Schedule: gen.WorkSchedule(in.Schedule),
			})
			if err != nil {
				return err
			}
			if err := q.AddVacancySkills(ctx, gen.AddVacancySkillsParams{VacancyID: v.ID, SkillIds: skillIDs(skills)}); err != nil {
				return err
			}
			return q.UpsertVacancySearch(ctx, s.searchDoc(v, c.Name, skills))
		})
		if isUnique(err) && attempt == 0 { // slug suffix collision, astronomically rare
			continue
		}
		break
	}
	if err != nil {
		return Detail{}, err
	}
	return detailOf(v, c, skills, true), nil
}

func (s *Service) Update(ctx context.Context, p reqctx.Principal, id uuid.UUID, in Input) (Detail, error) {
	v, c, err := s.authorize(ctx, p, id)
	if err != nil {
		return Detail{}, err
	}
	if err := s.normalize(&in); err != nil {
		return Detail{}, err
	}
	skills, err := s.Catalog.ResolveSkills(ctx, in.Skills)
	if err != nil {
		return Detail{}, err
	}
	err = postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
		v, err = q.UpdateVacancy(ctx, gen.UpdateVacancyParams{
			ID: v.ID, Title: in.Title, Description: in.Description, CategoryID: in.CategoryID,
			RegionID: in.RegionID, DistrictID: in.DistrictID, Address: in.Address,
			SalaryMin: in.SalaryMin, SalaryMax: in.SalaryMax, Currency: gen.Currency(in.Currency),
			EmploymentType: gen.EmploymentType(in.EmploymentType), WorkFormat: gen.WorkFormat(in.WorkFormat),
			Experience: gen.ExperienceLevel(in.Experience), Schedule: gen.WorkSchedule(in.Schedule),
		})
		if err != nil {
			return err
		}
		if err := q.DeleteVacancySkills(ctx, v.ID); err != nil {
			return err
		}
		if err := q.AddVacancySkills(ctx, gen.AddVacancySkillsParams{VacancyID: v.ID, SkillIds: skillIDs(skills)}); err != nil {
			return err
		}
		if err := q.UpsertVacancySearch(ctx, s.searchDoc(v, c.Name, skills)); err != nil {
			return err
		}
		// Unverified companies can't silently change a live vacancy: it's re-reviewed.
		if v.Status == gen.VacancyStatusPublished && c.VerifiedAt == nil {
			v, err = q.SubmitVacancy(ctx, gen.SubmitVacancyParams{ID: v.ID, FromStatuses: []string{"published"}})
		}
		return err
	})
	if err != nil {
		return Detail{}, err
	}
	return detailOf(v, c, skills, true), nil
}

// Submit sends a vacancy to moderation, or publishes it right away for verified companies.
func (s *Service) Submit(ctx context.Context, p reqctx.Principal, id uuid.UUID) (Detail, error) {
	v, c, err := s.authorize(ctx, p, id)
	if err != nil {
		return Detail{}, err
	}
	if err := s.Companies.RequireVerifiedUser(ctx, p.UserID); err != nil {
		return Detail{}, err
	}
	if c.VerifiedAt != nil {
		v, err = s.publish(ctx, v.ID, resubmittable, nil)
	} else {
		v, err = s.Q.SubmitVacancy(ctx, gen.SubmitVacancyParams{ID: v.ID, FromStatuses: resubmittable})
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return Detail{}, ErrTransition
	}
	if err != nil {
		return Detail{}, err
	}
	return s.detail(ctx, v, c, true)
}

func (s *Service) Archive(ctx context.Context, p reqctx.Principal, id uuid.UUID) (Detail, error) {
	v, c, err := s.authorize(ctx, p, id)
	if err != nil {
		return Detail{}, err
	}
	v, err = s.Q.ArchiveVacancy(ctx, v.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Detail{}, ErrTransition
	}
	if err != nil {
		return Detail{}, err
	}
	return s.detail(ctx, v, c, true)
}

func (s *Service) Delete(ctx context.Context, p reqctx.Principal, id uuid.UUID) error {
	v, _, err := s.authorize(ctx, p, id)
	if err != nil {
		return err
	}
	n, err := s.Q.DeleteDraftVacancy(ctx, v.ID)
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrOnlyDrafts
	}
	return nil
}

// ---- moderation (platform admins) --------------------------------------------------------

func (s *Service) Approve(ctx context.Context, admin reqctx.Principal, id uuid.UUID) (Detail, error) {
	v, err := s.publish(ctx, id, fromModerationSet, &admin.UserID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Detail{}, s.missingOr(ctx, id, ErrTransition)
	}
	if err != nil {
		return Detail{}, err
	}
	s.Notify.Notify(ctx, []uuid.UUID{v.CreatedBy}, notification.TypeVacancyApproved,
		notification.Payload{VacancyID: v.ID.String(), VacancyTitle: v.Title}, true)
	return s.detailLoadCompany(ctx, v)
}

func (s *Service) Reject(ctx context.Context, admin reqctx.Principal, id uuid.UUID, reason string) (Detail, error) {
	reason = strings.TrimSpace(reason)
	if len([]rune(reason)) < 5 {
		return Detail{}, ErrRejectReason
	}
	v, err := s.Q.RejectVacancy(ctx, gen.RejectVacancyParams{ID: id, RejectReason: &reason, ModeratedBy: &admin.UserID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Detail{}, s.missingOr(ctx, id, ErrTransition)
	}
	if err != nil {
		return Detail{}, err
	}
	s.Notify.Notify(ctx, []uuid.UUID{v.CreatedBy}, notification.TypeVacancyRejected,
		notification.Payload{VacancyID: v.ID.String(), VacancyTitle: v.Title, Reason: reason}, true)
	return s.detailLoadCompany(ctx, v)
}

func (s *Service) publish(ctx context.Context, id uuid.UUID, from []string, moderator *uuid.UUID) (gen.Vacancy, error) {
	var v gen.Vacancy
	err := postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
		var err error
		v, err = q.PublishVacancy(ctx, gen.PublishVacancyParams{
			ID: id, FromStatuses: from, TtlDays: PublishDays, ModeratedBy: moderator,
		})
		if err != nil {
			return err
		}
		rows, err := q.ListVacancySkills(ctx, []uuid.UUID{id})
		if err != nil {
			return err
		}
		ids := make([]int32, len(rows))
		for i, r := range rows {
			ids[i] = r.ID
		}
		return q.IncrementSkillUsage(ctx, ids)
	})
	return v, err
}

// ---- reads -------------------------------------------------------------------------------

// Get returns a vacancy by id or slug. Unpublished vacancies are visible only to company
// members and admins; everyone else gets 404, so drafts can't be probed.
func (s *Service) Get(ctx context.Context, ref string, viewer *reqctx.Principal, viewerIP string) (Detail, error) {
	v, err := s.resolve(ctx, ref)
	if err != nil {
		return Detail{}, err
	}
	c, err := s.Q.GetCompanyByID(ctx, v.CompanyID)
	if err != nil {
		return Detail{}, err
	}
	member := viewer != nil && s.Companies.IsMember(ctx, *viewer, c.ID)
	if !member && (v.Status != gen.VacancyStatusPublished || c.Status != gen.CompanyStatusActive) {
		return Detail{}, ErrNotFound
	}
	if !member {
		key := "ip:" + viewerIP
		if viewer != nil {
			key = "u:" + viewer.UserID.String()
		}
		if err := s.Views.Hit(ctx, v.ID, key); err != nil {
			s.Log.WarnContext(ctx, "view count failed", "err", err)
		}
	}
	return s.detail(ctx, v, c, member)
}

func (s *Service) ListForCompany(ctx context.Context, p reqctx.Principal, companyRef string, status *gen.VacancyStatus, after *cursorKey, limit int) ([]Card, *string, error) {
	c, _, err := s.Companies.Authorize(ctx, p, companyRef, gen.CompanyMemberRoleRecruiter)
	if err != nil {
		return nil, nil, err
	}
	params := gen.ListCompanyVacanciesParams{CompanyID: c.ID, Status: status, MaxResults: int32(limit + 1)}
	if after != nil {
		params.BeforeCreated, params.BeforeID = &after.T, &after.ID
	}
	rows, err := s.Q.ListCompanyVacancies(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	sum := summaryOf(c)
	return s.cards(ctx, rows, limit, func(v gen.Vacancy) (company.Summary, any) {
		return sum, cursorKey{T: v.CreatedAt, ID: v.ID}
	})
}

func (s *Service) ModerationQueue(ctx context.Context, after *cursorKey, limit int) ([]Card, *string, error) {
	params := gen.ListModerationQueueParams{MaxResults: int32(limit + 1)}
	if after != nil {
		params.AfterSubmitted, params.AfterID = &after.T, &after.ID
	}
	rows, err := s.Q.ListModerationQueue(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	vs := make([]gen.Vacancy, len(rows))
	companies := make(map[uuid.UUID]company.Summary, len(rows))
	for i, r := range rows {
		vs[i] = r.Vacancy
		companies[r.Vacancy.ID] = company.Summary{ID: r.Vacancy.CompanyID, Name: r.CompanyName,
			Slug: r.CompanySlug, Verified: r.CompanyVerifiedAt != nil}
	}
	return s.cards(ctx, vs, limit, func(v gen.Vacancy) (company.Summary, any) {
		return companies[v.ID], cursorKey{T: *v.SubmittedAt, ID: v.ID}
	})
}

// cards attaches skills to a page of vacancies (fetched with limit+1) and builds the cursor.
func (s *Service) cards(ctx context.Context, rows []gen.Vacancy, limit int,
	meta func(gen.Vacancy) (company.Summary, any)) ([]Card, *string, error) {
	var next *string
	if len(rows) > limit {
		rows = rows[:limit]
		_, k := meta(rows[len(rows)-1])
		c := encodeCursor(k)
		next = &c
	}
	skills, err := s.skillsFor(ctx, rows)
	if err != nil {
		return nil, nil, err
	}
	out := make([]Card, len(rows))
	for i, v := range rows {
		sum, _ := meta(v)
		out[i] = cardOf(v, sum, skills[v.ID])
	}
	return out, next, nil
}

func (s *Service) skillsFor(ctx context.Context, vs []gen.Vacancy) (map[uuid.UUID][]catalog.Skill, error) {
	ids := make([]uuid.UUID, len(vs))
	for i, v := range vs {
		ids[i] = v.ID
	}
	return s.skillsByID(ctx, ids)
}

func (s *Service) skillsByID(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID][]catalog.Skill, error) {
	out := make(map[uuid.UUID][]catalog.Skill, len(ids))
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := s.Q.ListVacancySkills(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.VacancyID] = append(out[r.VacancyID], catalog.Skill{ID: r.ID, Name: r.Name})
	}
	return out, nil
}

func (s *Service) detail(ctx context.Context, v gen.Vacancy, c gen.Company, member bool) (Detail, error) {
	sk, err := s.skillsByID(ctx, []uuid.UUID{v.ID})
	if err != nil {
		return Detail{}, err
	}
	return detailOf(v, c, sk[v.ID], member), nil
}

func (s *Service) detailLoadCompany(ctx context.Context, v gen.Vacancy) (Detail, error) {
	c, err := s.Q.GetCompanyByID(ctx, v.CompanyID)
	if err != nil {
		return Detail{}, err
	}
	return s.detail(ctx, v, c, true)
}

// ---- helpers -----------------------------------------------------------------------------

// authorize loads a vacancy for modification by a member of its company.
func (s *Service) authorize(ctx context.Context, p reqctx.Principal, id uuid.UUID) (gen.Vacancy, gen.Company, error) {
	v, err := s.Q.GetVacancyByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return v, gen.Company{}, ErrNotFound
	}
	if err != nil {
		return v, gen.Company{}, err
	}
	c, _, err := s.Companies.Authorize(ctx, p, v.CompanyID.String(), gen.CompanyMemberRoleRecruiter)
	if errors.Is(err, company.ErrForbidden) {
		return v, c, ErrNotFound // don't reveal other companies' vacancies
	}
	return v, c, err
}

func (s *Service) resolve(ctx context.Context, ref string) (gen.Vacancy, error) {
	var v gen.Vacancy
	var err error
	if id, perr := uuid.Parse(ref); perr == nil {
		v, err = s.Q.GetVacancyByID(ctx, id)
	} else {
		v, err = s.Q.GetVacancyBySlug(ctx, strings.ToLower(ref))
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return v, ErrNotFound
	}
	return v, err
}

func (s *Service) missingOr(ctx context.Context, id uuid.UUID, fallback error) error {
	if _, err := s.Q.GetVacancyByID(ctx, id); errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return fallback
}

// newSlug makes "backend-dasturchi-k3x9q2": readable, unique, and stable across edits.
func newSlug(title string) string {
	base := slug.Make(title)
	if len(base) > 60 {
		base = strings.TrimRight(base[:60], "-")
	}
	if base == "" {
		base = "vacancy"
	}
	return base + "-" + random.Base36(6)
}

func skillIDs(sk []catalog.Skill) []int32 {
	ids := make([]int32, len(sk))
	for i, s := range sk {
		ids[i] = s.ID
	}
	return ids
}

func isUnique(err error) bool {
	var pe *pgconn.PgError
	return errors.As(err, &pe) && pe.Code == "23505"
}
