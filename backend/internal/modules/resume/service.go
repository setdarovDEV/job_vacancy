// Package resume implements the seeker's resume builder, resume visibility rules,
// candidate search for employers and PDF export.
package resume

import (
	"context"
	"errors"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/translit"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

const MaxPerUser = 5

var (
	ErrNotFound     = apperr.NotFound("resume_not_found", "resume not found")
	ErrSeekerOnly   = apperr.Forbidden("seeker_only", "only job seeker accounts have resumes")
	ErrEmployerOnly = apperr.Forbidden("employer_only", "candidate search is for employers")
	ErrLimit        = apperr.Conflict("resume_limit", "you can have at most 5 resumes")
	ErrInUse        = apperr.Conflict("resume_in_use", "this resume was sent with applications; hide it instead of deleting")
)

type Service struct {
	Pool    *pgxpool.Pool
	Q       *gen.Queries
	Catalog *catalog.Service
}

// ---- writes ------------------------------------------------------------------------------

// experience is one validated work experience row.
type experience struct {
	Company, Position string
	StartDate         time.Time
	EndDate           *time.Time
	Description       string
	SortOrder         int32
}

// parsed holds validated section data ready for insertion.
type parsed struct {
	in          Input
	experiences []experience
	months      int32
	skills      []catalog.Skill
}

func (s *Service) parse(ctx context.Context, in Input) (parsed, error) {
	in.Title = strings.Join(strings.Fields(in.Title), " ")
	in.About = strings.TrimSpace(in.About)
	if in.Currency == "" {
		in.Currency = string(gen.CurrencyUZS)
	}
	if in.Visibility == "" {
		in.Visibility = string(gen.ResumeVisibilityPublic)
	}
	in.EmploymentTypes = uniq(in.EmploymentTypes)
	in.WorkFormats = uniq(in.WorkFormats)
	if in.CategoryID != nil {
		if err := s.Catalog.ValidateCategory(*in.CategoryID); err != nil {
			return parsed{}, err
		}
	}
	if in.RegionID != nil {
		if err := s.Catalog.ValidateLocation(*in.RegionID, nil); err != nil {
			return parsed{}, err
		}
	}

	p := parsed{in: in}
	now := time.Now()
	var spans [][2]int // month indexes, inclusive
	for i, e := range in.Experiences {
		start, _ := time.Parse(monthLayout, e.Start)
		var end *time.Time
		endIdx := monthIndex(now)
		if e.End != nil {
			t, _ := time.Parse(monthLayout, *e.End)
			end, endIdx = &t, monthIndex(t)
		}
		if monthIndex(start) > monthIndex(now) || endIdx < monthIndex(start) {
			return parsed{}, apperr.Validation(map[string]string{"experiences": "date_range"})
		}
		spans = append(spans, [2]int{monthIndex(start), endIdx})
		p.experiences = append(p.experiences, experience{
			Company: strings.TrimSpace(e.Company), Position: strings.TrimSpace(e.Position),
			StartDate: start, EndDate: end, Description: strings.TrimSpace(e.Description), SortOrder: int32(i),
		})
	}
	p.months = totalMonths(spans)

	seenLang := map[string]bool{}
	for _, l := range in.Languages {
		if seenLang[l.Language] {
			return parsed{}, apperr.Validation(map[string]string{"languages": "unique"})
		}
		seenLang[l.Language] = true
	}
	for _, e := range in.Educations {
		if e.StartYear != nil && e.EndYear != nil && *e.EndYear < *e.StartYear {
			return parsed{}, apperr.Validation(map[string]string{"educations": "date_range"})
		}
	}
	skills, err := s.Catalog.ResolveSkills(ctx, in.Skills)
	if err != nil {
		return parsed{}, err
	}
	p.skills = skills
	return p, nil
}

func (s *Service) Create(ctx context.Context, pr reqctx.Principal, in Input) (Detail, error) {
	if pr.Role != string(gen.UserRoleSeeker) {
		return Detail{}, ErrSeekerOnly
	}
	n, err := s.Q.CountUserResumes(ctx, pr.UserID)
	if err != nil {
		return Detail{}, err
	}
	if n >= MaxPerUser {
		return Detail{}, ErrLimit
	}
	p, err := s.parse(ctx, in)
	if err != nil {
		return Detail{}, err
	}
	var r gen.Resume
	err = postgres.WithPgxTx(ctx, s.Pool, func(tx pgx.Tx) error {
		q := gen.New(tx)
		r, err = q.CreateResume(ctx, gen.CreateResumeParams{
			UserID: pr.UserID, Title: p.in.Title, About: p.in.About, CategoryID: p.in.CategoryID,
			RegionID: p.in.RegionID, Relocate: p.in.Relocate, DesiredSalary: p.in.DesiredSalary,
			Currency: gen.Currency(p.in.Currency), EmploymentTypes: p.in.EmploymentTypes,
			WorkFormats: p.in.WorkFormats, Visibility: gen.ResumeVisibility(p.in.Visibility),
			ExperienceMonths: p.months,
		})
		if err != nil {
			return err
		}
		if err := s.writeSections(ctx, tx, r.ID, p, false); err != nil {
			return err
		}
		return q.UpsertResumeSearch(ctx, s.searchDoc(r, p))
	})
	if err != nil {
		return Detail{}, err
	}
	return s.detail(ctx, r, pr)
}

func (s *Service) Update(ctx context.Context, pr reqctx.Principal, id uuid.UUID, in Input) (Detail, error) {
	r, err := s.owned(ctx, pr, id)
	if err != nil {
		return Detail{}, err
	}
	p, err := s.parse(ctx, in)
	if err != nil {
		return Detail{}, err
	}
	err = postgres.WithPgxTx(ctx, s.Pool, func(tx pgx.Tx) error {
		q := gen.New(tx)
		r, err = q.UpdateResume(ctx, gen.UpdateResumeParams{
			ID: r.ID, Title: p.in.Title, About: p.in.About, CategoryID: p.in.CategoryID,
			RegionID: p.in.RegionID, Relocate: p.in.Relocate, DesiredSalary: p.in.DesiredSalary,
			Currency: gen.Currency(p.in.Currency), EmploymentTypes: p.in.EmploymentTypes,
			WorkFormats: p.in.WorkFormats, Visibility: gen.ResumeVisibility(p.in.Visibility),
			ExperienceMonths: p.months,
		})
		if err != nil {
			return err
		}
		if err := s.writeSections(ctx, tx, r.ID, p, true); err != nil {
			return err
		}
		return q.UpsertResumeSearch(ctx, s.searchDoc(r, p))
	})
	if err != nil {
		return Detail{}, err
	}
	return s.detail(ctx, r, pr)
}

func (s *Service) SetVisibility(ctx context.Context, pr reqctx.Principal, id uuid.UUID, v string) (Detail, error) {
	r, err := s.owned(ctx, pr, id)
	if err != nil {
		return Detail{}, err
	}
	err = postgres.WithTx(ctx, s.Pool, func(q *gen.Queries) error {
		r, err = q.SetResumeVisibility(ctx, gen.SetResumeVisibilityParams{ID: r.ID, Visibility: gen.ResumeVisibility(v)})
		if err != nil {
			return err
		}
		return q.SetResumeSearchVisibility(ctx, gen.SetResumeSearchVisibilityParams{
			ResumeID: r.ID, IsPublic: r.Visibility == gen.ResumeVisibilityPublic,
		})
	})
	if err != nil {
		return Detail{}, err
	}
	return s.detail(ctx, r, pr)
}

func (s *Service) Delete(ctx context.Context, pr reqctx.Principal, id uuid.UUID) error {
	r, err := s.owned(ctx, pr, id)
	if err != nil {
		return err
	}
	used, err := s.Q.ResumeHasApplications(ctx, r.ID)
	if err != nil {
		return err
	}
	if used {
		return ErrInUse
	}
	_, err = s.Q.DeleteResume(ctx, gen.DeleteResumeParams{ID: r.ID, UserID: pr.UserID})
	return err
}

// ---- reads -------------------------------------------------------------------------------

func (s *Service) Mine(ctx context.Context, pr reqctx.Principal) ([]Card, error) {
	rows, err := s.Q.ListUserResumes(ctx, pr.UserID)
	if err != nil {
		return nil, err
	}
	u, err := s.Q.GetUserByID(ctx, pr.UserID)
	if err != nil {
		return nil, err
	}
	sec, err := s.loadSections(ctx, ids(rows))
	if err != nil {
		return nil, err
	}
	out := make([]Card, len(rows))
	for i, r := range rows {
		out[i] = cardOf(r, personOf(u), sec, true)
	}
	return out, nil
}

// Access decides what a viewer may see of a resume.
type Access struct {
	Visible, Contacts, Owner bool
}

// Access rules:
//   - the owner and platform admins see everything;
//   - a company the seeker applied to (or invited them) sees the resume that was sent,
//     whatever its visibility, with contact details;
//   - other employers see public resumes; contacts only if the seeker is linked to one of
//     their companies through another application; applied_only resumes only when linked;
//   - nobody else sees resumes at all.
func (s *Service) Access(ctx context.Context, viewer reqctx.Principal, r gen.Resume) (Access, error) {
	if viewer.UserID == r.UserID {
		return Access{Visible: true, Contacts: true, Owner: true}, nil
	}
	switch viewer.Role {
	case string(gen.UserRoleAdmin):
		return Access{Visible: true, Contacts: true}, nil
	case string(gen.UserRoleEmployer):
	default:
		return Access{}, nil
	}
	shared, err := s.Q.ResumeSharedWithMember(ctx, gen.ResumeSharedWithMemberParams{ResumeID: r.ID, MemberID: viewer.UserID})
	if err != nil {
		return Access{}, err
	}
	if shared {
		return Access{Visible: true, Contacts: true}, nil
	}
	if r.Visibility == gen.ResumeVisibilityHidden {
		return Access{}, nil
	}
	linked, err := s.Q.SeekerLinkedToMemberCompanies(ctx, gen.SeekerLinkedToMemberCompaniesParams{
		SeekerID: r.UserID, MemberID: viewer.UserID,
	})
	if err != nil {
		return Access{}, err
	}
	return Access{Visible: linked || r.Visibility == gen.ResumeVisibilityPublic, Contacts: linked}, nil
}

func (s *Service) Get(ctx context.Context, viewer reqctx.Principal, id uuid.UUID) (Detail, error) {
	r, err := s.Q.GetResume(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Detail{}, ErrNotFound
	}
	if err != nil {
		return Detail{}, err
	}
	return s.detail(ctx, r, viewer)
}

func (s *Service) detail(ctx context.Context, r gen.Resume, viewer reqctx.Principal) (Detail, error) {
	acc, err := s.Access(ctx, viewer, r)
	if err != nil {
		return Detail{}, err
	}
	if !acc.Visible {
		return Detail{}, ErrNotFound
	}
	u, err := s.Q.GetUserByID(ctx, r.UserID)
	if err != nil {
		return Detail{}, err
	}
	sec, err := s.loadSections(ctx, []uuid.UUID{r.ID})
	if err != nil {
		return Detail{}, err
	}
	var contacts *Contacts
	if acc.Contacts {
		contacts = &Contacts{Email: u.Email, Phone: u.Phone}
	}
	return detailOf(r, personOf(u), sec, contacts, acc.Owner), nil
}

func (s *Service) loadSections(ctx context.Context, ids []uuid.UUID) (sections, error) {
	sec := sections{
		experiences: map[uuid.UUID][]gen.ResumeExperience{}, educations: map[uuid.UUID][]gen.ResumeEducation{},
		skills: map[uuid.UUID][]catalog.Skill{}, languages: map[uuid.UUID][]gen.ResumeLanguage{},
	}
	if len(ids) == 0 {
		return sec, nil
	}
	exps, err := s.Q.ListResumeExperiences(ctx, ids)
	if err != nil {
		return sec, err
	}
	for _, e := range exps {
		sec.experiences[e.ResumeID] = append(sec.experiences[e.ResumeID], e)
	}
	edus, err := s.Q.ListResumeEducations(ctx, ids)
	if err != nil {
		return sec, err
	}
	for _, e := range edus {
		sec.educations[e.ResumeID] = append(sec.educations[e.ResumeID], e)
	}
	sks, err := s.Q.ListResumeSkills(ctx, ids)
	if err != nil {
		return sec, err
	}
	for _, k := range sks {
		sec.skills[k.ResumeID] = append(sec.skills[k.ResumeID], catalog.Skill{ID: k.ID, Name: k.Name})
	}
	langs, err := s.Q.ListResumeLanguages(ctx, ids)
	if err != nil {
		return sec, err
	}
	for _, l := range langs {
		sec.languages[l.ResumeID] = append(sec.languages[l.ResumeID], l)
	}
	return sec, nil
}

// owned loads a resume that must belong to the caller.
func (s *Service) owned(ctx context.Context, pr reqctx.Principal, id uuid.UUID) (gen.Resume, error) {
	r, err := s.Q.GetResume(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && r.UserID != pr.UserID) {
		return r, ErrNotFound
	}
	return r, err
}

// OwnedBy checks that a resume belongs to userID (used when applying).
func (s *Service) OwnedBy(ctx context.Context, id, userID uuid.UUID) (gen.Resume, error) {
	return s.owned(ctx, reqctx.Principal{UserID: userID}, id)
}

// ---- search index ------------------------------------------------------------------------

func (s *Service) searchDoc(r gen.Resume, p parsed) gen.UpsertResumeSearchParams {
	var tags, body, meta, langs []string
	for _, sk := range p.skills {
		tags = append(tags, sk.Name)
	}
	body = append(body, r.About)
	for _, e := range p.experiences {
		body = append(body, e.Position, e.Company, e.Description)
	}
	for _, e := range p.in.Educations {
		body = append(body, e.Institution, e.Field)
	}
	var cat int32
	if r.CategoryID != nil {
		cat = *r.CategoryID
	}
	var reg int32
	if r.RegionID != nil {
		reg = *r.RegionID
	}
	for _, n := range s.Catalog.Names(cat, reg, nil) {
		meta = append(meta, n.Uz, n.UzCyrl, n.Ru, n.En)
	}
	for _, l := range p.in.Languages {
		langs = append(langs, l.Language)
	}
	return gen.UpsertResumeSearchParams{
		ID:        r.ID,
		Languages: append([]string{}, langs...),
		Title:     translit.Fold(r.Title),
		Tags:      translit.Fold(strings.Join(tags, " ")),
		Meta:      dedupe(translit.Fold(strings.Join(meta, " "))),
		Body:      translit.Fold(strings.Join(body, " ")),
	}
}

// ---- helpers -----------------------------------------------------------------------------

func monthIndex(t time.Time) int { return t.Year()*12 + int(t.Month()) - 1 }

// totalMonths is the size of the union of inclusive month spans, so overlapping jobs
// (a day job plus freelance) aren't counted twice.
func totalMonths(spans [][2]int) int32 {
	slices.SortFunc(spans, func(a, b [2]int) int { return a[0] - b[0] })
	total, curStart, curEnd := 0, -1, -2
	for _, s := range spans {
		if s[0] > curEnd+1 {
			if curEnd >= curStart && curStart >= 0 {
				total += curEnd - curStart + 1
			}
			curStart, curEnd = s[0], s[1]
		} else if s[1] > curEnd {
			curEnd = s[1]
		}
	}
	if curStart >= 0 {
		total += curEnd - curStart + 1
	}
	return int32(total)
}

func personOf(u gen.User) Person {
	return Person{ID: u.ID, FullName: u.FullName, AvatarURL: u.AvatarUrl}
}

func ids(rs []gen.Resume) []uuid.UUID {
	out := make([]uuid.UUID, len(rs))
	for i, r := range rs {
		out[i] = r.ID
	}
	return out
}

func uniq(ss []string) []string {
	out := []string{}
	for _, s := range ss {
		if !slices.Contains(out, s) {
			out = append(out, s)
		}
	}
	return out
}

func dedupe(s string) string {
	seen := map[string]bool{}
	var out []string
	for _, w := range strings.Fields(s) {
		if !seen[w] {
			seen[w] = true
			out = append(out, w)
		}
	}
	return strings.Join(out, " ")
}
