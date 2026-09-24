package vacancy

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/realtime"
	fx "jobvacancy.uz/backend/internal/testutil/fixture"
)

// unverifiedCompany adds a company without verification (its vacancies need moderation)
// with the fixture employer as owner.
func (f *fixture) unverifiedCompany() gen.Company {
	f.t.Helper()
	w := fx.New(f.t)
	c := w.Company(f.employer.UserID, false)
	return c
}

func (f *fixture) vacancyStatus(id uuid.UUID) string {
	var s string
	if err := f.pool.QueryRow(context.Background(), `SELECT status FROM vacancies WHERE id = $1`, id).Scan(&s); err != nil {
		f.t.Fatal(err)
	}
	return s
}

// TZ FN-04: "Qayta e'lon qilish" puts an expired vacancy back without moderation when it
// wasn't changed; an edited one, or one an admin took down, goes through moderation.
func TestRepublish(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	c := f.unverifiedCompany()
	w := fx.New(t)
	mk := func() gen.Vacancy {
		v := w.Vacancy(c.ID, f.employer.UserID, gen.VacancyStatusPublished)
		w.Exec(`UPDATE vacancies SET status = 'expired', published_at = now() - interval '31 days',
			submitted_at = now() - interval '32 days', moderated_at = now() - interval '31 days' WHERE id = $1`, v.ID)
		return v
	}

	untouched := mk()
	d, _, err := f.svc.Get(ctx, untouched.ID.String(), &f.employer)
	if err != nil || d.Republish != "direct" {
		t.Fatalf("detail before republish: %q %v", d.Republish, err)
	}
	if d, err := f.svc.Republish(ctx, f.employer, untouched.ID); err != nil || d.Status != "published" ||
		d.ExpiresAt.Sub(time.Now()) < 29*24*time.Hour || time.Since(*d.PublishedAt) > time.Minute {
		t.Fatalf("untouched: %+v %v", d, err)
	}

	edited := mk()
	in := Input{Title: "Edited title", Description: "New description of the job.", CategoryID: f.category,
		RegionID: f.region, EmploymentType: "full_time", WorkFormat: "office", Experience: "none", Schedule: "full_day"}
	if _, err := f.svc.Update(ctx, f.employer, edited.ID, in); err != nil {
		t.Fatal(err)
	}
	if d, _, _ := f.svc.Get(ctx, edited.ID.String(), &f.employer); d.Republish != "moderation" {
		t.Fatalf("edited detail: %q", d.Republish)
	}
	if d, err := f.svc.Republish(ctx, f.employer, edited.ID); err != nil || d.Status != "moderation" {
		t.Fatalf("edited: %+v %v", d.Status, err)
	}

	takenDown := mk()
	f.pool.Exec(ctx, `UPDATE vacancies SET status = 'archived', moderated_at = now() WHERE id = $1`, takenDown.ID)
	if d, err := f.svc.Republish(ctx, f.employer, takenDown.ID); err != nil || d.Status != "moderation" {
		t.Fatalf("taken down by an admin: %+v %v", d.Status, err)
	}

	// Verified companies publish directly either way; live vacancies can't be republished.
	v := f.publish("Omborchi " + randWord(5))
	if _, err := f.svc.Republish(ctx, f.employer, v.ID); !errors.Is(err, ErrTransition) {
		t.Fatalf("republish a live vacancy: %v", err)
	}
	f.pool.Exec(ctx, `UPDATE vacancies SET status = 'expired', content_updated_at = now() WHERE id = $1`, v.ID)
	if d, err := f.svc.Republish(ctx, f.employer, v.ID); err != nil || d.Status != "published" {
		t.Fatalf("verified company: %+v %v", d.Status, err)
	}
	// Outsiders get 404.
	if _, err := f.svc.Republish(ctx, reqctx.Principal{UserID: uuid.New(), Role: "employer"}, untouched.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("outsider: %v", err)
	}
}

// TZ FN-04: authors hear about expiry 3 days ahead (once per expiry date) and when it
// happens; several vacancies of one author make one notification. "TOP" ends on its date.
func TestLifecycleJobs(t *testing.T) {
	f := newFixture(t)
	ctx := context.Background()
	w := fx.New(t)
	jobs := &fx.Jobs{}
	notify := &notification.Service{Pool: f.pool, Q: f.q, Publisher: &realtime.Publisher{RDB: f.rdb}, Jobs: jobs, Log: f.svc.Log}
	l := &Lifecycle{Pool: f.pool, Cache: f.svc.Cache, Notify: notify, Log: f.svc.Log}
	author := w.User(gen.UserRoleEmployer, true)
	c := w.Company(author.ID, true)
	soon1 := w.Vacancy(c.ID, author.ID, gen.VacancyStatusPublished)
	soon2 := w.Vacancy(c.ID, author.ID, gen.VacancyStatusPublished)
	later := w.Vacancy(c.ID, author.ID, gen.VacancyStatusPublished)
	w.Exec(`UPDATE vacancies SET expires_at = now() + interval '2 days' WHERE id = ANY($1)`, []uuid.UUID{soon1.ID, soon2.ID})
	notes := func(typ string) int {
		return w.Int(`SELECT count(*) FROM notifications WHERE user_id = $1 AND type = $2`, author.ID, typ)
	}

	if _, err := l.WarnExpiring(ctx); err != nil {
		t.Fatal(err)
	}
	if notes("vacancy.expiring") != 1 {
		t.Fatalf("%d expiring notifications, want 1 for both vacancies", notes("vacancy.expiring"))
	}
	var count int
	w.Must(w.Pool.QueryRow(ctx, `SELECT (payload->>'count')::int FROM notifications WHERE user_id = $1 AND type = 'vacancy.expiring'`, author.ID).Scan(&count))
	if count != 2 {
		t.Fatalf("payload count %d", count)
	}
	if _, err := l.WarnExpiring(ctx); err != nil || notes("vacancy.expiring") != 1 {
		t.Fatalf("second run warned again: %d %v", notes("vacancy.expiring"), err)
	}
	if n := w.Int(`SELECT count(*) FROM vacancy_expiry_warnings WHERE vacancy_id = $1`, later.ID); n != 0 {
		t.Fatal("warned about a vacancy expiring in 30 days")
	}

	w.Exec(`UPDATE vacancies SET expires_at = now() - interval '1 minute' WHERE id = ANY($1)`, []uuid.UUID{soon1.ID, soon2.ID})
	n, err := l.Expire(ctx)
	if err != nil || n < 2 {
		t.Fatalf("expire: %d %v", n, err)
	}
	if f.vacancyStatus(soon1.ID) != "expired" || f.vacancyStatus(later.ID) != "published" || notes("vacancy.expired") != 1 {
		t.Fatalf("after expiry: %s %s, %d notifications", f.vacancyStatus(soon1.ID), f.vacancyStatus(later.ID), notes("vacancy.expired"))
	}
	if !contains(jobs.Kinds(), "notification.deliver") {
		t.Fatalf("no delivery jobs: %v", jobs.Kinds())
	}

	// Republishing sets a new expiry date, which gets its own warning when it comes near.
	if _, err := f.svc.Republish(ctx, reqctx.Principal{UserID: author.ID, Role: "employer"}, soon1.ID); err != nil {
		t.Fatal(err)
	}
	w.Exec(`UPDATE vacancies SET expires_at = now() + interval '1 day' WHERE id = $1`, soon1.ID)
	if _, err := l.WarnExpiring(ctx); err != nil || notes("vacancy.expiring") != 2 {
		t.Fatalf("new expiry date not warned: %d %v", notes("vacancy.expiring"), err)
	}

	// "TOP" until a date.
	if _, err := f.svc.SetFeatured(ctx, later.ID, time.Now().Add(-time.Hour)); err == nil {
		t.Fatal("featured until a past date accepted")
	}
	if d, err := f.svc.SetFeatured(ctx, later.ID, time.Now().Add(time.Hour)); err != nil || !d.IsFeatured {
		t.Fatalf("feature: %+v %v", d.IsFeatured, err)
	}
	w.Exec(`UPDATE vacancies SET featured_until = now() - interval '1 second' WHERE id = $1`, later.ID)
	if _, err := l.EndFeatured(ctx); err != nil {
		t.Fatal(err)
	}
	var featured bool
	w.Must(w.Pool.QueryRow(ctx, `SELECT is_featured FROM vacancy_search WHERE vacancy_id = $1`, later.ID).Scan(&featured))
	if featured {
		t.Fatal("search row still featured")
	}
}

func contains(ss []string, s string) bool {
	for _, x := range ss {
		if x == s {
			return true
		}
	}
	return false
}
