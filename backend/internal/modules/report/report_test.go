package report

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
)

// ---- fakes -------------------------------------------------------------------------------

type fakeStore struct {
	Store // unused methods panic if called

	publicVacancies map[uuid.UUID]uuid.UUID // vacancy -> company
	activeCompanies map[uuid.UUID]bool
	created         []gen.CreateReportParams
	duplicate       bool
	openReporters   []uuid.UUID // returned (and cleared) by CloseOpenReports
	hasReports      bool
	vacancyTitle    string
	vacancyGone     bool  // the target was deleted after the close
	listErr         error // ListReportTargets fails
}

func (f *fakeStore) GetReportableVacancyCompany(_ context.Context, id uuid.UUID) (uuid.UUID, error) {
	c, ok := f.publicVacancies[id]
	if !ok {
		return uuid.Nil, pgx.ErrNoRows
	}
	return c, nil
}

func (f *fakeStore) IsReportableCompany(_ context.Context, id uuid.UUID) (bool, error) {
	return f.activeCompanies[id], nil
}

func (f *fakeStore) CreateReport(_ context.Context, arg gen.CreateReportParams) (gen.Report, error) {
	if f.duplicate {
		return gen.Report{}, &pgconn.PgError{Code: "23505"}
	}
	f.created = append(f.created, arg)
	return gen.Report{ID: uuid.New(), ReporterID: arg.ReporterID, TargetType: arg.TargetType, Reason: arg.Reason, Comment: arg.Comment}, nil
}

func (f *fakeStore) CloseOpenReports(_ context.Context, _ gen.CloseOpenReportsParams) ([]uuid.UUID, error) {
	r := f.openReporters
	f.openReporters = nil
	return r, nil
}

func (f *fakeStore) TargetHasReports(_ context.Context, _ gen.TargetHasReportsParams) (bool, error) {
	return f.hasReports, nil
}

func (f *fakeStore) ListReportTargets(_ context.Context, arg gen.ListReportTargetsParams) ([]gen.ListReportTargetsRow, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	return []gen.ListReportTargetsRow{{TargetType: *arg.TargetType, TargetID: *arg.TargetID, StatusReportCount: 2, LastReportedAt: time.Now()}}, nil
}

func (f *fakeStore) ListReportedVacancies(_ context.Context, ids []uuid.UUID) ([]gen.ListReportedVacanciesRow, error) {
	out := []gen.ListReportedVacanciesRow{}
	if f.vacancyGone {
		return out, nil
	}
	for _, id := range ids {
		out = append(out, gen.ListReportedVacanciesRow{ID: id, Title: f.vacancyTitle, Status: gen.VacancyStatusPublished})
	}
	return out, nil
}

func (f *fakeStore) ListReportedCompanies(_ context.Context, _ []uuid.UUID) ([]gen.ListReportedCompaniesRow, error) {
	return nil, nil
}

func (f *fakeStore) ListLatestReports(_ context.Context, _ gen.ListLatestReportsParams) ([]gen.ListLatestReportsRow, error) {
	return nil, nil
}

type fakeTeam struct {
	members map[uuid.UUID]uuid.UUID // user -> company
	err     error
}

func (f fakeTeam) HasMember(_ context.Context, companyID, userID uuid.UUID) (bool, error) {
	return f.err == nil && f.members[userID] == companyID, f.err
}

// fakeTx runs fn on the store and reports whether the transaction would commit.
type fakeTx struct {
	store              *fakeStore
	commits, rollbacks int
}

func (t *fakeTx) InTx(_ context.Context, fn func(Store) error) error {
	if err := fn(t.store); err != nil {
		t.rollbacks++
		return err
	}
	t.commits++
	return nil
}

type sent struct {
	users []uuid.UUID
	typ   string
	p     notification.Payload
}

type fakeNotifier struct{ sent []sent }

func (f *fakeNotifier) Notify(_ context.Context, users []uuid.UUID, typ string, p notification.Payload, _ bool) {
	f.sent = append(f.sent, sent{users, typ, p})
}

type fixture struct {
	svc                       *Service
	store                     *fakeStore
	tx                        *fakeTx
	notes                     *fakeNotifier
	reporter, employer, admin reqctx.Principal
	vacancy, company          uuid.UUID
}

func setup() fixture {
	f := fixture{
		reporter: reqctx.Principal{UserID: uuid.New(), Role: "seeker"},
		employer: reqctx.Principal{UserID: uuid.New(), Role: "employer"},
		admin:    reqctx.Principal{UserID: uuid.New(), Role: "admin"},
		vacancy:  uuid.New(), company: uuid.New(),
	}
	f.store = &fakeStore{
		publicVacancies: map[uuid.UUID]uuid.UUID{f.vacancy: f.company},
		activeCompanies: map[uuid.UUID]bool{f.company: true},
		vacancyTitle:    "Kassir",
	}
	f.notes = &fakeNotifier{}
	f.tx = &fakeTx{store: f.store}
	f.svc = &Service{Store: f.store, Tx: f.tx, Team: fakeTeam{members: map[uuid.UUID]uuid.UUID{f.employer.UserID: f.company}}, Notify: f.notes}
	return f
}

// ---- filing ------------------------------------------------------------------------------

func TestCreateReportsAPublicVacancy(t *testing.T) {
	f := setup()
	r, err := f.svc.Create(context.Background(), f.reporter, Input{Target: Target{gen.ReportTargetVacancy, f.vacancy}, Reason: gen.ReportReasonFraud, Comment: "  pul so'rashdi  "})
	if err != nil {
		t.Fatal(err)
	}
	got := f.store.created[0]
	if got.VacancyID == nil || *got.VacancyID != f.vacancy || got.CompanyID != nil || *got.Comment != "pul so'rashdi" || r.Reason != gen.ReportReasonFraud {
		t.Fatalf("created %+v", got)
	}
}

func TestOtherNeedsAComment(t *testing.T) {
	f := setup()
	_, err := f.svc.Create(context.Background(), f.reporter, Input{Target: Target{gen.ReportTargetCompany, f.company}, Reason: gen.ReportReasonOther, Comment: "   "})
	if !errors.Is(err, ErrCommentForOther) || len(f.store.created) != 0 {
		t.Fatalf("got %v, created %d", err, len(f.store.created))
	}
}

func TestOnlyPublicTargetsCanBeReported(t *testing.T) {
	f := setup()
	for _, target := range []Target{{gen.ReportTargetVacancy, uuid.New()}, {gen.ReportTargetCompany, uuid.New()}} {
		if _, err := f.svc.Create(context.Background(), f.reporter, Input{Target: target, Reason: gen.ReportReasonSpam}); !errors.Is(err, ErrTargetNotFound) {
			t.Errorf("%s: got %v", target.Type, err)
		}
	}
}

func TestTeamMembersCantReportTheirOwnCompany(t *testing.T) {
	f := setup()
	for _, target := range []Target{{gen.ReportTargetVacancy, f.vacancy}, {gen.ReportTargetCompany, f.company}} {
		if _, err := f.svc.Create(context.Background(), f.employer, Input{Target: target, Reason: gen.ReportReasonSpam}); !errors.Is(err, ErrOwnCompany) {
			t.Errorf("%s: got %v", target.Type, err)
		}
	}
}

func TestSecondOpenReportIsAConflict(t *testing.T) {
	f := setup()
	f.store.duplicate = true
	if _, err := f.svc.Create(context.Background(), f.reporter, Input{Target: Target{gen.ReportTargetCompany, f.company}, Reason: gen.ReportReasonSpam}); !errors.Is(err, ErrAlreadyReported) {
		t.Fatalf("got %v", err)
	}
}

// ---- closing -----------------------------------------------------------------------------

func TestResolveClosesAndNotifiesReporters(t *testing.T) {
	f := setup()
	a, b := uuid.New(), uuid.New()
	f.store.openReporters = []uuid.UUID{a, b}
	res, err := f.svc.Close(context.Background(), f.admin, Target{gen.ReportTargetVacancy, f.vacancy}, Resolved, "olib tashlandi")
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != gen.ReportStatusResolved || res.Vacancy == nil || res.Name() != "Kassir" {
		t.Fatalf("response %+v", res)
	}
	if len(f.notes.sent) != 1 {
		t.Fatalf("sent %d notifications", len(f.notes.sent))
	}
	n := f.notes.sent[0]
	if n.typ != notification.TypeReportResolved || len(n.users) != 2 || n.p.TargetName != "Kassir" || n.p.TargetType != "vacancy" {
		t.Fatalf("notification %+v", n)
	}
}

func TestDismissUsesTheDismissedNotification(t *testing.T) {
	f := setup()
	f.store.openReporters = []uuid.UUID{uuid.New()}
	if _, err := f.svc.Close(context.Background(), f.admin, Target{gen.ReportTargetVacancy, f.vacancy}, Dismissed, ""); err != nil {
		t.Fatal(err)
	}
	if f.notes.sent[0].typ != notification.TypeReportDismissed {
		t.Fatalf("type %s", f.notes.sent[0].typ)
	}
}

func TestClosingWithNothingOpen(t *testing.T) {
	f := setup()
	target := Target{gen.ReportTargetVacancy, f.vacancy}
	if _, err := f.svc.Close(context.Background(), f.admin, target, Resolved, ""); !errors.Is(err, ErrReportedTargetNotFound) {
		t.Errorf("never reported: got %v", err)
	}
	f.store.hasReports = true
	if _, err := f.svc.Close(context.Background(), f.admin, target, Resolved, ""); !errors.Is(err, ErrNoOpenReports) {
		t.Errorf("already closed: got %v", err)
	}
	if len(f.notes.sent) != 0 {
		t.Errorf("notified %d times", len(f.notes.sent))
	}
}

// OO-014: a failed membership lookup must not let someone report their own company.
func TestMembershipLookupFailureIsNotIgnored(t *testing.T) {
	f := setup()
	boom := errors.New("db down")
	f.svc.Team = fakeTeam{err: boom}
	if _, err := f.svc.Create(context.Background(), f.reporter, Input{Target: Target{gen.ReportTargetCompany, f.company}, Reason: gen.ReportReasonSpam}); !errors.Is(err, boom) {
		t.Fatalf("got %v", err)
	}
	if len(f.store.created) != 0 {
		t.Fatal("report filed despite the failed check")
	}
}

// CA-009 / OO-015 / API-016: if reading the target back fails after the close, the close
// is rolled back (so a retry works) and nobody is told anything yet.
func TestCloseRollsBackWhenTheReReadFails(t *testing.T) {
	f := setup()
	f.store.openReporters = []uuid.UUID{uuid.New()}
	f.store.listErr = errors.New("read failed")
	if _, err := f.svc.Close(context.Background(), f.admin, Target{gen.ReportTargetVacancy, f.vacancy}, Resolved, ""); !errors.Is(err, f.store.listErr) {
		t.Fatalf("got %v", err)
	}
	if f.tx.rollbacks != 1 || f.tx.commits != 0 || len(f.notes.sent) != 0 {
		t.Fatalf("rollbacks=%d commits=%d notified=%d", f.tx.rollbacks, f.tx.commits, len(f.notes.sent))
	}
}

// A target deleted between the close and the read answers 404, never a zero-value row.
func TestCloseOnAVanishedTargetIsNotFound(t *testing.T) {
	f := setup()
	f.store.openReporters = []uuid.UUID{uuid.New()}
	f.store.vacancyGone = true
	res, err := f.svc.Close(context.Background(), f.admin, Target{gen.ReportTargetVacancy, f.vacancy}, Resolved, "")
	if !errors.Is(err, ErrReportedTargetNotFound) || res.Vacancy != nil || res.Company != nil {
		t.Fatalf("got %+v, %v", res, err)
	}
	if f.tx.rollbacks != 1 || len(f.notes.sent) != 0 {
		t.Fatalf("rollbacks=%d notified=%d", f.tx.rollbacks, len(f.notes.sent))
	}
}

// Notifications go out only after the commit.
func TestReportersAreNotifiedAfterCommit(t *testing.T) {
	f := setup()
	f.store.openReporters = []uuid.UUID{uuid.New()}
	if _, err := f.svc.Close(context.Background(), f.admin, Target{gen.ReportTargetVacancy, f.vacancy}, Resolved, ""); err != nil {
		t.Fatal(err)
	}
	if f.tx.commits != 1 || len(f.notes.sent) != 1 {
		t.Fatalf("commits=%d notified=%d", f.tx.commits, len(f.notes.sent))
	}
}

// API-020: a takedown resolves the vacancy's reports; having none open is not an error.
func TestResolveVacancyReports(t *testing.T) {
	f := setup()
	f.store.openReporters = []uuid.UUID{uuid.New(), uuid.New()}
	if err := f.svc.ResolveVacancyReports(context.Background(), f.admin, f.vacancy, "pul so'ralgan"); err != nil {
		t.Fatal(err)
	}
	if len(f.notes.sent) != 1 || f.notes.sent[0].typ != notification.TypeReportResolved {
		t.Fatalf("sent %+v", f.notes.sent)
	}
	if err := f.svc.ResolveVacancyReports(context.Background(), f.admin, uuid.New(), "hech narsa"); err != nil {
		t.Fatalf("nothing open: %v", err)
	}
}
