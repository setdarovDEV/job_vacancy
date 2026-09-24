package report_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/modules/report"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/ratelimit"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/realtime"
	"jobvacancy.uz/backend/internal/testutil/fixture"
)

type env struct {
	*fixture.World
	svc  *report.Service
	jobs *fixture.Jobs
}

func newEnv(t *testing.T) *env {
	t.Helper()
	w := fixture.New(t)
	_, rdb := fixture.Redis(t)
	cat := &catalog.Service{Q: w.Q, Log: w.Log}
	w.Must(cat.Reload(context.Background()))
	jobs := &fixture.Jobs{}
	companies := &company.Service{Pool: w.Pool, Q: w.Q, Catalog: cat}
	vac := &vacancy.Service{Pool: w.Pool, Q: w.Q, Companies: companies, Catalog: cat, Cache: vacancy.NewPublicCache(rdb, w.Log), Log: w.Log}
	notify := &notification.Service{Pool: w.Pool, Q: w.Q, Publisher: &realtime.Publisher{RDB: rdb}, Jobs: jobs, Log: w.Log}
	return &env{World: w, jobs: jobs, svc: &report.Service{Pool: w.Pool, Q: w.Q, Limiter: ratelimit.New(rdb),
		Vacancies: vac, Notify: notify, Threshold: 3, Log: w.Log}}
}

func code(err error) string {
	if ae, ok := apperr.As(err); ok {
		return ae.Code
	}
	return fmt.Sprint(err)
}

func (e *env) status(v gen.Vacancy) string {
	var s string
	e.Must(e.Pool.QueryRow(context.Background(), `SELECT status FROM vacancies WHERE id = $1`, v.ID).Scan(&s))
	return s
}

// TZ FN-02: the third open report (each from a different user) sends a published vacancy
// back to moderation and tells its author, in the report's transaction.
func TestReportsSendVacancyBackToModeration(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	emp := e.User(gen.UserRoleEmployer, true)
	c := e.Company(emp.ID, false)
	v := e.Vacancy(c.ID, emp.ID, gen.VacancyStatusPublished)

	for i := 1; i <= 3; i++ {
		s := fixture.Principal(e.User(gen.UserRoleSeeker, true))
		r, err := e.svc.Report(ctx, s, v.Slug, report.Input{Reason: "fraud", Comment: "asks for a deposit"})
		if err != nil || r.Status != "open" {
			t.Fatalf("report %d: %+v %v", i, r, err)
		}
		want := "published"
		if i == 3 {
			want = "moderation"
		}
		if got := e.status(v); got != want {
			t.Fatalf("after %d reports the vacancy is %s, want %s", i, got, want)
		}
	}
	if n := e.Int(`SELECT count(*) FROM notifications WHERE user_id = $1 AND type = 'vacancy.reported'`, emp.ID); n != 1 {
		t.Fatalf("%d author notifications", n)
	}
	// The vacancy is out of the public site while under review: new reports are 404.
	late := fixture.Principal(e.User(gen.UserRoleSeeker, true))
	if _, err := e.svc.Report(ctx, late, v.ID.String(), report.Input{Reason: "spam"}); code(err) != "vacancy_not_found" {
		t.Fatalf("report on a vacancy under review: %v", err)
	}

	// The admin sees the three open reports, oldest first, and closes them in one go.
	items, next, err := e.svc.Queue(ctx, report.QueueFilter{VacancyID: &v.ID, Limit: 2})
	if err != nil || len(items) != 2 || next == nil || items[0].OpenReports != 3 || items[0].Vacancy.Title != v.Title {
		t.Fatalf("queue: %+v next=%v %v", items, next, err)
	}
	rest, _, _ := e.svc.Queue(ctx, report.QueueFilter{VacancyID: &v.ID, After: next, Limit: 2})
	if len(rest) != 1 || !items[0].CreatedAt.Before(rest[0].CreatedAt.Add(time.Nanosecond)) {
		t.Fatalf("second page %+v", rest)
	}
	adm := e.Session(e.User(gen.UserRoleAdmin, true), 0)
	actx := reqctx.WithPrincipal(ctx, adm)
	n, err := e.svc.Resolve(actx, adm, items[0].ID, "resolved", "Rejected the vacancy", true)
	if err != nil || n != 3 {
		t.Fatalf("resolve all: %d %v", n, err)
	}
	if left, _, _ := e.svc.Queue(ctx, report.QueueFilter{VacancyID: &v.ID, Limit: 10}); len(left) != 0 {
		t.Fatalf("%d still open", len(left))
	}
	closed, _, _ := e.svc.Queue(ctx, report.QueueFilter{Status: "resolved", VacancyID: &v.ID, Limit: 10})
	if len(closed) != 3 || closed[0].ResolutionNote != "Rejected the vacancy" || closed[0].ResolvedBy == nil {
		t.Fatalf("resolved: %+v", closed)
	}
	if _, err := e.svc.Resolve(actx, adm, items[0].ID, "dismissed", "", false); code(err) != "report_closed" {
		t.Fatalf("resolving twice: %v", err)
	}
	if n := e.Int(`SELECT count(*) FROM admin_audit_log WHERE action = 'report.resolved' AND object_id = $1 AND admin_id = $2`,
		items[0].ID.String(), adm.UserID); n != 1 {
		t.Fatalf("%d audit rows", n)
	}
}

// TZ FN-02: one report per user and vacancy, none against your own company, at most 10 a
// day per user, a comment for "other".
func TestReportRules(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	emp := e.User(gen.UserRoleEmployer, true)
	c := e.Company(emp.ID, true)
	v := e.Vacancy(c.ID, emp.ID, gen.VacancyStatusPublished)
	draft := e.Vacancy(c.ID, emp.ID, gen.VacancyStatusDraft)
	s := fixture.Principal(e.User(gen.UserRoleSeeker, true))

	if _, err := e.svc.Report(ctx, s, v.ID.String(), report.Input{Reason: "spam"}); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.Report(ctx, s, v.ID.String(), report.Input{Reason: "fraud"}); code(err) != "already_reported" {
		t.Fatalf("duplicate: %v", err)
	}
	if _, err := e.svc.Report(ctx, fixture.Principal(emp), v.ID.String(), report.Input{Reason: "spam"}); code(err) != "own_vacancy" {
		t.Fatalf("own vacancy: %v", err)
	}
	if _, err := e.svc.Report(ctx, s, draft.ID.String(), report.Input{Reason: "spam"}); code(err) != "vacancy_not_found" {
		t.Fatalf("draft: %v", err)
	}
	if _, err := e.svc.Report(ctx, s, v.ID.String(), report.Input{Reason: "other", Comment: " "}); code(err) != "validation_failed" {
		t.Fatalf("other without comment: %v", err)
	}

	// Daily limit: 10 reports (the rule counts attempts, the 11th is refused).
	spammer := fixture.Principal(e.User(gen.UserRoleSeeker, true))
	var lastErr error
	made := 0
	for i := 0; i < 11; i++ {
		x := e.Vacancy(c.ID, emp.ID, gen.VacancyStatusPublished)
		if _, lastErr = e.svc.Report(ctx, spammer, x.ID.String(), report.Input{Reason: "spam"}); lastErr == nil {
			made++
		}
	}
	if made != 10 || code(lastErr) != "rate_limited" {
		t.Fatalf("made %d reports, last error %v", made, lastErr)
	}
}
