// Package application connects seekers and employers: applying with a resume, employer
// invitations, the hiring pipeline (kanban) with its history, and withdrawal.
package application

import (
	"context"
	"errors"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/modules/resume"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

var (
	ErrNotFound       = apperr.NotFound("application_not_found", "application not found")
	ErrSeekerOnly     = apperr.Forbidden("seeker_only", "only job seekers can apply")
	ErrVacancyClosed  = apperr.Conflict("vacancy_closed", "this vacancy is not accepting applications")
	ErrAlreadyApplied = apperr.Conflict("already_applied", "there is already an application for this vacancy")
	ErrTransition     = apperr.Conflict("invalid_status_transition", "this status change isn't allowed")
	ErrOwnVacancy     = apperr.Conflict("own_vacancy", "you can't apply to your own company's vacancy")
)

// Statuses the employer can move a card to, and from which ones. Withdrawn is final:
// the candidate left. "viewed" is set automatically when the employer opens it.
var (
	employerTargets = []gen.ApplicationStatus{
		gen.ApplicationStatusViewed, gen.ApplicationStatusInvited, gen.ApplicationStatusInterview,
		gen.ApplicationStatusHired, gen.ApplicationStatusRejected,
	}
	employerFrom = []string{"sent", "viewed", "invited", "interview", "hired", "rejected"}
	withdrawFrom = []string{"sent", "viewed", "invited", "interview"}
)

type Service struct {
	Pool      *pgxpool.Pool
	Q         *gen.Queries
	Companies *company.Service
	Resumes   *resume.Service
	Vacancies *vacancy.Service
	Notify    *notification.Service
	Log       *slog.Logger
}

type ApplyInput struct {
	ResumeID    uuid.UUID `json:"resume_id" validate:"required"`
	CoverLetter string    `json:"cover_letter" validate:"max=3000"`
}

type InviteInput struct {
	VacancyID uuid.UUID `json:"vacancy_id" validate:"required"`
	Message   string    `json:"message" validate:"max=2000"`
}

// Invite lets an employer who found a resume in candidate search invite its owner to
// one of the company's published vacancies.
func (s *Service) Invite(ctx context.Context, p reqctx.Principal, resumeID uuid.UUID, in InviteInput) (Detail, error) {
	v, err := s.Q.GetVacancyByID(ctx, in.VacancyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Detail{}, vacancy.ErrNotFound
	}
	if err != nil {
		return Detail{}, err
	}
	if _, _, err := s.Companies.Authorize(ctx, p, v.CompanyID.String(), gen.CompanyMemberRoleRecruiter); err != nil {
		return Detail{}, err
	}
	if v.Status != gen.VacancyStatusPublished {
		return Detail{}, ErrVacancyClosed
	}
	r, err := s.Resumes.Q.GetResume(ctx, resumeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Detail{}, resume.ErrNotFound
	}
	if err != nil {
		return Detail{}, err
	}
	acc, err := s.Resumes.Access(ctx, p, r)
	if err != nil {
		return Detail{}, err
	}
	if !acc.Visible {
		return Detail{}, resume.ErrNotFound
	}
	a, err := s.create(ctx, gen.CreateApplicationParams{
		VacancyID: v.ID, CompanyID: v.CompanyID, SeekerID: r.UserID, ResumeID: r.ID,
		Source: gen.ApplicationSourceInvite, Status: gen.ApplicationStatusInvited,
	}, p.UserID, strings.TrimSpace(in.Message), notification.TypeApplicationInvited)
	if err != nil {
		return Detail{}, err
	}
	return s.detail(ctx, a, p, true)
}

// notifySeekerTx tells the candidate about their application inside the transaction that
// changed it (TZ BE-08).
func (s *Service) notifySeekerTx(ctx context.Context, tx pgx.Tx, a gen.Application, typ string) (notification.Sent, error) {
	info, err := gen.New(tx).GetVacancyNoticeInfo(ctx, a.VacancyID)
	if err != nil {
		return notification.Sent{}, err
	}
	return s.Notify.NotifyTx(ctx, tx, typ, []notification.Recipient{{UserID: a.SeekerID, Payload: notification.Payload{
		ApplicationID: a.ID.String(), VacancyID: a.VacancyID.String(), VacancyTitle: info.Title,
		CompanyName: info.CompanyName, Status: string(a.Status),
	}}}, true)
}

// create inserts an application with its first event and the seeker's notification of
// type notify, in one transaction.
func (s *Service) create(ctx context.Context, params gen.CreateApplicationParams, actor uuid.UUID, note, notify string) (gen.Application, error) {
	var a gen.Application
	var sent notification.Sent
	err := postgres.WithPgxTx(ctx, s.Pool, func(tx pgx.Tx) error {
		q := gen.New(tx)
		var err error
		a, err = q.CreateApplication(ctx, params)
		if err != nil {
			return err
		}
		if err := q.IncrementVacancyApplications(ctx, a.VacancyID); err != nil {
			return err
		}
		if err := q.AddApplicationEvent(ctx, gen.AddApplicationEventParams{
			ApplicationID: a.ID, ActorID: &actor, ToStatus: a.Status, Note: note,
		}); err != nil {
			return err
		}
		sent, err = s.notifySeekerTx(ctx, tx, a, notify)
		return err
	})
	if isUniqueViolation(err) {
		return a, ErrAlreadyApplied
	}
	if err == nil {
		sent.Publish(ctx)
	}
	return a, err
}

// ---- pipeline ----------------------------------------------------------------------------

// Get returns an application to its seeker or to a member of the hiring company. The
// first time an employer opens a new application it becomes "viewed".
func (s *Service) Get(ctx context.Context, p reqctx.Principal, id uuid.UUID) (Detail, error) {
	a, employer, err := s.load(ctx, p, id)
	if err != nil {
		return Detail{}, err
	}
	if employer && a.Status == gen.ApplicationStatusSent {
		if next, err := s.transition(ctx, a, gen.ApplicationStatusViewed, []string{"sent"}, p.UserID, "",
			notification.TypeApplicationStatus); err == nil {
			a = next
		} else if !errors.Is(err, ErrTransition) { // lost a race to another viewer: fine
			return Detail{}, err
		}
	}
	return s.detail(ctx, a, p, employer)
}

func (s *Service) SetStatus(ctx context.Context, p reqctx.Principal, id uuid.UUID, to gen.ApplicationStatus, note string) (Detail, error) {
	a, employer, err := s.load(ctx, p, id)
	if err != nil {
		return Detail{}, err
	}
	if !employer {
		return Detail{}, ErrNotFound
	}
	if !slices.Contains(employerTargets, to) {
		return Detail{}, ErrTransition
	}
	if a.Status == to {
		return s.detail(ctx, a, p, true)
	}
	a, err = s.transition(ctx, a, to, employerFrom, p.UserID, strings.TrimSpace(note), notification.TypeApplicationStatus)
	if err != nil {
		return Detail{}, err
	}
	return s.detail(ctx, a, p, true)
}

func (s *Service) Withdraw(ctx context.Context, p reqctx.Principal, id uuid.UUID) (Detail, error) {
	a, employer, err := s.load(ctx, p, id)
	if err != nil {
		return Detail{}, err
	}
	if employer || a.SeekerID != p.UserID {
		return Detail{}, ErrNotFound
	}
	a, err = s.transition(ctx, a, gen.ApplicationStatusWithdrawn, withdrawFrom, p.UserID, "", "")
	if err != nil {
		return Detail{}, err
	}
	return s.detail(ctx, a, p, false)
}

func (s *Service) SetNote(ctx context.Context, p reqctx.Principal, id uuid.UUID, note string) (Detail, error) {
	a, employer, err := s.load(ctx, p, id)
	if err != nil {
		return Detail{}, err
	}
	if !employer {
		return Detail{}, ErrNotFound
	}
	a, err = s.Q.SetApplicationNote(ctx, gen.SetApplicationNoteParams{ID: a.ID, EmployerNote: strings.TrimSpace(note)})
	if err != nil {
		return Detail{}, err
	}
	return s.detail(ctx, a, p, true)
}

// transition moves an application to another status with its history event and, when
// notify is set, the seeker's notification, all in one transaction.
func (s *Service) transition(ctx context.Context, a gen.Application, to gen.ApplicationStatus, from []string,
	actor uuid.UUID, note, notify string) (gen.Application, error) {
	var next gen.Application
	var sent notification.Sent
	err := postgres.WithPgxTx(ctx, s.Pool, func(tx pgx.Tx) error {
		q := gen.New(tx)
		var err error
		next, err = q.SetApplicationStatus(ctx, gen.SetApplicationStatusParams{ID: a.ID, Status: to, FromStatuses: from})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrTransition
		}
		if err != nil {
			return err
		}
		prev := a.Status
		if err := q.AddApplicationEvent(ctx, gen.AddApplicationEventParams{
			ApplicationID: a.ID, ActorID: &actor, FromStatus: &prev, ToStatus: to, Note: note,
		}); err != nil {
			return err
		}
		if notify != "" {
			sent, err = s.notifySeekerTx(ctx, tx, next, notify)
		}
		return err
	})
	if err == nil {
		sent.Publish(ctx)
	}
	return next, err
}

// load fetches an application visible to p and reports whether p sees it as the employer.
// Anyone else gets 404, so application ids can't be probed.
func (s *Service) load(ctx context.Context, p reqctx.Principal, id uuid.UUID) (gen.Application, bool, error) {
	a, err := s.Q.GetApplication(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return a, false, ErrNotFound
	}
	if err != nil {
		return a, false, err
	}
	if a.SeekerID == p.UserID {
		return a, false, nil
	}
	if _, _, err := s.Companies.Authorize(ctx, p, a.CompanyID.String(), gen.CompanyMemberRoleRecruiter); err != nil {
		if errors.Is(err, company.ErrForbidden) {
			return a, false, ErrNotFound
		}
		return a, false, err
	}
	return a, true, nil
}

// ---- lists -------------------------------------------------------------------------------

type Page struct {
	After *CursorKey
	Limit int
}

type CursorKey struct {
	T  time.Time `json:"t"`
	ID uuid.UUID `json:"i"`
}

func (s *Service) Mine(ctx context.Context, p reqctx.Principal, status *gen.ApplicationStatus, pg Page) ([]SeekerItem, *CursorKey, error) {
	params := gen.ListSeekerApplicationsParams{SeekerID: p.UserID, Status: status, MaxResults: int32(pg.Limit + 1)}
	if pg.After != nil {
		params.BeforeCreated, params.BeforeID = &pg.After.T, &pg.After.ID
	}
	rows, err := s.Q.ListSeekerApplications(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	var next *CursorKey
	if len(rows) > pg.Limit {
		rows = rows[:pg.Limit]
		last := rows[len(rows)-1]
		next = &CursorKey{T: last.CreatedAt, ID: last.ID}
	}
	ids := make([]uuid.UUID, len(rows))
	for i, a := range rows {
		ids[i] = a.VacancyID
	}
	cards, err := s.Vacancies.CardsByIDs(ctx, ids)
	if err != nil {
		return nil, nil, err
	}
	out := make([]SeekerItem, len(rows))
	for i, a := range rows {
		out[i] = SeekerItem{Summary: summaryOf(a), Vacancy: cards[a.VacancyID]}
	}
	return out, next, nil
}

func (s *Service) ForVacancy(ctx context.Context, p reqctx.Principal, vacancyID uuid.UUID, status *gen.ApplicationStatus, pg Page) ([]EmployerItem, *CursorKey, error) {
	if err := s.authorizeVacancy(ctx, p, vacancyID); err != nil {
		return nil, nil, err
	}
	params := gen.ListVacancyApplicationsParams{VacancyID: vacancyID, Status: status, MaxResults: int32(pg.Limit + 1)}
	if pg.After != nil {
		params.BeforeCreated, params.BeforeID = &pg.After.T, &pg.After.ID
	}
	rows, err := s.Q.ListVacancyApplications(ctx, params)
	if err != nil {
		return nil, nil, err
	}
	var next *CursorKey
	if len(rows) > pg.Limit {
		rows = rows[:pg.Limit]
		last := rows[len(rows)-1].Application
		next = &CursorKey{T: last.CreatedAt, ID: last.ID}
	}
	out := make([]EmployerItem, len(rows))
	for i, r := range rows {
		out[i] = EmployerItem{
			Summary: summaryOf(r.Application), EmployerNote: r.Application.EmployerNote,
			Candidate: candidateOf(r.Application, r.FullName, r.AvatarUrl, r.ResumeTitle,
				r.ExperienceMonths, r.DesiredSalary, r.Currency, r.RegionID),
		}
	}
	return out, next, nil
}

// Stats returns the number of applications per pipeline column.
func (s *Service) Stats(ctx context.Context, p reqctx.Principal, vacancyID uuid.UUID) (map[string]int64, error) {
	if err := s.authorizeVacancy(ctx, p, vacancyID); err != nil {
		return nil, err
	}
	rows, err := s.Q.CountVacancyApplicationsByStatus(ctx, vacancyID)
	if err != nil {
		return nil, err
	}
	out := map[string]int64{}
	for _, st := range gen.AllApplicationStatusValues() {
		out[string(st)] = 0
	}
	for _, r := range rows {
		out[string(r.Status)] = r.N
	}
	return out, nil
}

func (s *Service) authorizeVacancy(ctx context.Context, p reqctx.Principal, vacancyID uuid.UUID) error {
	v, err := s.Q.GetVacancyByID(ctx, vacancyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return vacancy.ErrNotFound
	}
	if err != nil {
		return err
	}
	_, _, err = s.Companies.Authorize(ctx, p, v.CompanyID.String(), gen.CompanyMemberRoleRecruiter)
	if errors.Is(err, company.ErrForbidden) {
		return vacancy.ErrNotFound
	}
	return err
}

func (s *Service) detail(ctx context.Context, a gen.Application, p reqctx.Principal, employer bool) (Detail, error) {
	events, err := s.Q.ListApplicationEvents(ctx, a.ID)
	if err != nil {
		return Detail{}, err
	}
	d := Detail{Summary: summaryOf(a), Events: make([]Event, 0, len(events))}
	for _, e := range events {
		ev := Event{To: string(e.ToStatus), At: e.CreatedAt}
		if e.FromStatus != nil {
			f := string(*e.FromStatus)
			ev.From = &f
		}
		// Internal notes from the hiring team stay internal; the invitation message
		// (the first event of an invite) is meant for the candidate.
		if employer || (e.FromStatus == nil && a.Source == gen.ApplicationSourceInvite) {
			ev.Note = e.Note
		}
		d.Events = append(d.Events, ev)
	}
	cards, err := s.Vacancies.CardsByIDs(ctx, []uuid.UUID{a.VacancyID})
	if err != nil {
		return Detail{}, err
	}
	c := cards[a.VacancyID]
	d.Vacancy = &c
	if employer {
		d.EmployerNote = &a.EmployerNote
		r, err := s.Resumes.Q.GetResume(ctx, a.ResumeID)
		if err != nil {
			return Detail{}, err
		}
		u, err := s.Q.GetUserByID(ctx, a.SeekerID)
		if err != nil {
			return Detail{}, err
		}
		cand := candidateOf(a, u.FullName, u.AvatarUrl, r.Title, r.ExperienceMonths, r.DesiredSalary, r.Currency, r.RegionID)
		d.Candidate = &cand
	}
	return d, nil
}
