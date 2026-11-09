// Package report implements reports ("shikoyat"): signed-in users flag a public vacancy
// or company, and admins handle them per target. Resolving or dismissing a target closes
// all of its open reports at once and tells the reporters. Acting on the target itself
// (taking a vacancy down, blocking a company) stays in the vacancy and company modules.
package report

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/cursor"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

const (
	maxCommentLen = 1000
	maxNoteLen    = 1000
	// How many of a target's newest reports the admin queue shows with their comments.
	latestPerTarget = 3
)

var (
	// Filing: the target isn't a public vacancy or company.
	ErrTargetNotFound = apperr.NotFound("report_target_not_found", "nothing to report with that id")
	// Admin (API-021): no reports were ever filed on that target, or it no longer exists.
	ErrReportedTargetNotFound = apperr.NotFound("reported_target_not_found", "no reports for that target")
	ErrOwnCompany             = apperr.Forbidden("cannot_report_own_company", "you can't report your own company or its vacancies")
	ErrAlreadyReported        = apperr.Conflict("already_reported", "you already have an open report on this")
	ErrNoOpenReports          = apperr.Conflict("no_open_reports", "this target has no open reports")
	ErrCommentForOther        = apperr.Validation(map[string]string{"comment": "required"})
)

// Store is the slice of the generated queries reports use (*gen.Queries).
type Store interface {
	GetReportableVacancyCompany(ctx context.Context, id uuid.UUID) (uuid.UUID, error)
	IsReportableCompany(ctx context.Context, id uuid.UUID) (bool, error)
	CreateReport(ctx context.Context, arg gen.CreateReportParams) (gen.Report, error)
	ListReportTargets(ctx context.Context, arg gen.ListReportTargetsParams) ([]gen.ListReportTargetsRow, error)
	ListReportedVacancies(ctx context.Context, ids []uuid.UUID) ([]gen.ListReportedVacanciesRow, error)
	ListReportedCompanies(ctx context.Context, ids []uuid.UUID) ([]gen.ListReportedCompaniesRow, error)
	ListLatestReports(ctx context.Context, arg gen.ListLatestReportsParams) ([]gen.ListLatestReportsRow, error)
	CloseOpenReports(ctx context.Context, arg gen.CloseOpenReportsParams) ([]uuid.UUID, error)
	TargetHasReports(ctx context.Context, arg gen.TargetHasReportsParams) (bool, error)
}

// Transactor runs fn against a Store inside one database transaction: if fn fails,
// nothing it wrote is kept.
type Transactor interface {
	InTx(ctx context.Context, fn func(Store) error) error
}

// PoolTx is the Postgres Transactor.
type PoolTx struct{ Pool *pgxpool.Pool }

func (t PoolTx) InTx(ctx context.Context, fn func(Store) error) error {
	return postgres.WithTx(ctx, t.Pool, func(q *gen.Queries) error { return fn(q) })
}

// CompanyTeam tells whether someone works for a company (company.Service): people can't
// report their own company or its vacancies. Lookup failures are returned, never read as
// "not a member" (OO-014), so the check can't fail open.
type CompanyTeam interface {
	HasMember(ctx context.Context, companyID, userID uuid.UUID) (bool, error)
}

// Notifier delivers in-app notifications (notification.Service).
type Notifier interface {
	Notify(ctx context.Context, users []uuid.UUID, typ string, p notification.Payload, store bool)
}

type Service struct {
	Store  Store
	Tx     Transactor
	Team   CompanyTeam
	Notify Notifier
}

// Target identifies what a report is about.
type Target struct {
	Type gen.ReportTarget
	ID   uuid.UUID
}

// Input is a new report.
type Input struct {
	Target  Target
	Reason  gen.ReportReason
	Comment string
}

// Create files a report on a public vacancy or company.
func (s *Service) Create(ctx context.Context, p reqctx.Principal, in Input) (gen.Report, error) {
	comment := strings.TrimSpace(in.Comment)
	if in.Reason == gen.ReportReasonOther && comment == "" {
		return gen.Report{}, ErrCommentForOther
	}
	if len([]rune(comment)) > maxCommentLen {
		return gen.Report{}, apperr.Validation(map[string]string{"comment": "max=1000"})
	}
	companyID, err := s.reportableCompany(ctx, in.Target)
	if err != nil {
		return gen.Report{}, err
	}
	member, err := s.Team.HasMember(ctx, companyID, p.UserID)
	if err != nil {
		return gen.Report{}, err
	}
	if member {
		return gen.Report{}, ErrOwnCompany
	}
	arg := gen.CreateReportParams{ReporterID: p.UserID, TargetType: in.Target.Type, Reason: in.Reason, Comment: optional(comment)}
	if in.Target.Type == gen.ReportTargetVacancy {
		arg.VacancyID = &in.Target.ID
	} else {
		arg.CompanyID = &in.Target.ID
	}
	r, err := s.Store.CreateReport(ctx, arg)
	if postgres.IsUniqueViolation(err) {
		return gen.Report{}, ErrAlreadyReported
	}
	return r, err
}

// reportableCompany returns the company a target belongs to, if the target is public.
func (s *Service) reportableCompany(ctx context.Context, t Target) (uuid.UUID, error) {
	switch t.Type {
	case gen.ReportTargetVacancy:
		id, err := s.Store.GetReportableVacancyCompany(ctx, t.ID)
		if errors.Is(err, pgx.ErrNoRows) {
			return id, ErrTargetNotFound
		}
		return id, err
	case gen.ReportTargetCompany:
		ok, err := s.Store.IsReportableCompany(ctx, t.ID)
		if err == nil && !ok {
			err = ErrTargetNotFound
		}
		return t.ID, err
	}
	return uuid.Nil, ErrTargetNotFound
}

// ---- admin -------------------------------------------------------------------------------

// Outcome is how an admin closes a target's reports (API-017: only these two exist).
type Outcome int

const (
	// Resolved: the report was right and action was taken.
	Resolved Outcome = iota + 1
	// Dismissed: no violation was found.
	Dismissed
)

func (o Outcome) status() gen.ReportStatus {
	switch o {
	case Resolved:
		return gen.ReportStatusResolved
	case Dismissed:
		return gen.ReportStatusDismissed
	}
	panic("report: unknown outcome")
}

func (o Outcome) notificationType() string {
	switch o {
	case Resolved:
		return notification.TypeReportResolved
	case Dismissed:
		return notification.TypeReportDismissed
	}
	panic("report: unknown outcome")
}

// QueueFilter selects a page of reported targets. Status is required (the handler
// defaults it to open); a nil TargetType means both kinds.
type QueueFilter struct {
	Status     gen.ReportStatus
	TargetType *gen.ReportTarget
	After      *cursor.TimeID
	Limit      int
}

// Queue lists targets with reports in the filter's status, newest report first.
func (s *Service) Queue(ctx context.Context, f QueueFilter) ([]TargetReports, cursor.Meta, error) {
	p := gen.ListReportTargetsParams{Status: f.Status, TargetType: f.TargetType, MaxResults: int32(f.Limit + 1)}
	if f.After != nil {
		p.AfterT, p.AfterID = &f.After.T, &f.After.ID
	}
	rows, err := s.Store.ListReportTargets(ctx, p)
	if err != nil {
		return nil, cursor.Meta{}, err
	}
	rows, meta := cursor.Page(rows, f.Limit, func(r gen.ListReportTargetsRow) any {
		return cursor.TimeID{T: r.LastReportedAt, ID: r.TargetID}
	})
	out, err := describe(ctx, s.Store, f.Status, rows)
	return out, meta, err
}

// Close resolves or dismisses every open report of a target and notifies the reporters.
// It answers with the target as the queue shows it in its new status.
//
// Closing and re-reading the target happen in one transaction (CA-009 / OO-015 / API-016):
// if the re-read fails, or the target vanished meanwhile, the close is rolled back, so a
// retry can finish the job instead of meeting 409 no_open_reports, and the response is
// never a zero value. Reporters are notified only after the commit.
func (s *Service) Close(ctx context.Context, admin reqctx.Principal, t Target, outcome Outcome, note string) (TargetReports, error) {
	note = strings.TrimSpace(note)
	if len([]rune(note)) > maxNoteLen {
		return TargetReports{}, apperr.Validation(map[string]string{"note": "max=1000"})
	}
	status := outcome.status()
	var closed TargetReports
	var reporters []uuid.UUID
	err := s.Tx.InTx(ctx, func(st Store) error {
		var err error
		reporters, err = st.CloseOpenReports(ctx, gen.CloseOpenReportsParams{
			Status: status, Note: optional(note), AdminID: &admin.UserID, TargetType: t.Type, TargetID: t.ID,
		})
		if err != nil {
			return err
		}
		if len(reporters) == 0 {
			return nothingOpen(ctx, st, t)
		}
		rows, err := st.ListReportTargets(ctx, gen.ListReportTargetsParams{Status: status, TargetType: &t.Type, TargetID: &t.ID, MaxResults: 1})
		if err != nil {
			return err
		}
		out, err := describe(ctx, st, status, rows)
		if err != nil {
			return err
		}
		if len(out) == 0 {
			return ErrReportedTargetNotFound // deleted between the close and the read
		}
		closed = out[0]
		return nil
	})
	if err != nil {
		return TargetReports{}, err
	}
	s.Notify.Notify(ctx, reporters, outcome.notificationType(),
		notification.Payload{TargetType: string(t.Type), TargetName: closed.Name()}, true)
	return closed, nil
}

// nothingOpen explains why no report was closed: the target was never reported (404) or
// all its reports are already closed (409).
func nothingOpen(ctx context.Context, st Store, t Target) error {
	known, err := st.TargetHasReports(ctx, gen.TargetHasReportsParams{TargetType: t.Type, TargetID: t.ID})
	switch {
	case err != nil:
		return err
	case !known:
		return ErrReportedTargetNotFound
	default:
		return ErrNoOpenReports
	}
}

// ResolveVacancyReports closes a vacancy's open reports as resolved after it was taken
// down (vacancy.ReportResolver). Having nothing open is fine: not every takedown follows
// a report.
func (s *Service) ResolveVacancyReports(ctx context.Context, admin reqctx.Principal, vacancyID uuid.UUID, note string) error {
	_, err := s.Close(ctx, admin, Target{Type: gen.ReportTargetVacancy, ID: vacancyID}, Resolved, note)
	if errors.Is(err, ErrNoOpenReports) || errors.Is(err, ErrReportedTargetNotFound) {
		return nil
	}
	return err
}

// describe adds each target's summary and its newest reports to the aggregated rows.
// Targets deleted meanwhile are left out.
func describe(ctx context.Context, st Store, status gen.ReportStatus, rows []gen.ListReportTargetsRow) ([]TargetReports, error) {
	if len(rows) == 0 {
		return []TargetReports{}, nil
	}
	var vacancyIDs, companyIDs, all []uuid.UUID
	for _, r := range rows {
		all = append(all, r.TargetID)
		if r.TargetType == gen.ReportTargetVacancy {
			vacancyIDs = append(vacancyIDs, r.TargetID)
		} else {
			companyIDs = append(companyIDs, r.TargetID)
		}
	}
	vacancies, err := st.ListReportedVacancies(ctx, vacancyIDs)
	if err != nil {
		return nil, err
	}
	companies, err := st.ListReportedCompanies(ctx, companyIDs)
	if err != nil {
		return nil, err
	}
	latest, err := st.ListLatestReports(ctx, gen.ListLatestReportsParams{TargetIds: all, Status: status, PerTarget: latestPerTarget})
	if err != nil {
		return nil, err
	}
	vByID := byID(vacancies, func(v gen.ListReportedVacanciesRow) uuid.UUID { return v.ID })
	cByID := byID(companies, func(c gen.ListReportedCompaniesRow) uuid.UUID { return c.ID })
	latestBy := map[uuid.UUID][]gen.ListLatestReportsRow{}
	for _, l := range latest {
		latestBy[l.TargetID] = append(latestBy[l.TargetID], l)
	}
	out := make([]TargetReports, 0, len(rows))
	for _, r := range rows {
		t := TargetReports{Summary: r, Status: status, Latest: latestBy[r.TargetID]}
		if v, ok := vByID[r.TargetID]; ok {
			t.Vacancy = &v
		} else if c, ok := cByID[r.TargetID]; ok {
			t.Company = &c
		} else {
			continue
		}
		out = append(out, t)
	}
	return out, nil
}

// TargetReports is one row of the admin queue: a target and its reports in one status.
// Exactly one of Vacancy / Company is set.
type TargetReports struct {
	Summary gen.ListReportTargetsRow
	Status  gen.ReportStatus
	Vacancy *gen.ListReportedVacanciesRow
	Company *gen.ListReportedCompaniesRow
	Latest  []gen.ListLatestReportsRow
}

// Name is the vacancy title or the company name.
func (t TargetReports) Name() string {
	if t.Vacancy != nil {
		return t.Vacancy.Title
	}
	return t.Company.Name
}

func byID[T any](rows []T, id func(T) uuid.UUID) map[uuid.UUID]T {
	m := make(map[uuid.UUID]T, len(rows))
	for _, r := range rows {
		m[id(r)] = r
	}
	return m
}

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
