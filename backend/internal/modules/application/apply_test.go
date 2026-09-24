package application_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math/rand/v2"
	"os"
	"os/exec"
	"slices"
	"syscall"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/jobs"
	"jobvacancy.uz/backend/internal/modules/application"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/modules/resume"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/realtime"
	"jobvacancy.uz/backend/internal/testutil/pgtest"
)

type world struct {
	t        *testing.T
	pool     *pgxpool.Pool
	owner    uuid.UUID // verified e-mail: gets e-mail jobs
	hr       uuid.UUID // Telegram linked: gets Telegram jobs
	company  uuid.UUID
	seeker   reqctx.Principal
	resume   uuid.UUID
	category int32
	region   int32
}

func newWorld(t *testing.T) *world {
	t.Helper()
	w := &world{t: t, pool: pgtest.Pool(t)}
	pgtest.River(t)
	ctx := context.Background()
	must(t, w.pool.QueryRow(ctx, `SELECT id FROM categories WHERE parent_id IS NOT NULL ORDER BY id LIMIT 1`).Scan(&w.category))
	must(t, w.pool.QueryRow(ctx, `SELECT id FROM regions WHERE parent_id IS NULL ORDER BY id LIMIT 1`).Scan(&w.region))
	w.owner = w.user("employer", `UPDATE users SET email_verified_at = now() WHERE id = $1`)
	w.hr = w.user("employer", fmt.Sprintf(`UPDATE users SET telegram_chat_id = %d WHERE id = $1`, rand.Int64N(1e12)+1))
	must(t, w.pool.QueryRow(ctx, `INSERT INTO companies (owner_id, name, slug) VALUES ($1, 'Apply Co', $2) RETURNING id`,
		w.owner, "apply-"+uuid.NewString()).Scan(&w.company))
	w.exec(`INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'recruiter')`,
		w.company, w.owner, w.hr)
	w.seeker = reqctx.Principal{UserID: w.user("seeker", `UPDATE users SET email_verified_at = now() WHERE id = $1`), Role: "seeker"}
	w.resume = w.resumeOf(w.seeker.UserID)
	return w
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func (w *world) exec(sql string, args ...any) {
	w.t.Helper()
	if _, err := w.pool.Exec(context.Background(), sql, args...); err != nil {
		w.t.Fatal(err)
	}
}

func (w *world) user(role, setup string) uuid.UUID {
	w.t.Helper()
	var id uuid.UUID
	must(w.t, w.pool.QueryRow(context.Background(), `INSERT INTO users (email, full_name, role)
		VALUES ($1, 'Test '||$2, $2::user_role) RETURNING id`, "a-"+uuid.NewString()[:13]+"@test.local", role).Scan(&id))
	if setup != "" {
		w.exec(setup, id)
	}
	return id
}

func (w *world) resumeOf(user uuid.UUID) uuid.UUID {
	w.t.Helper()
	var id uuid.UUID
	must(w.t, w.pool.QueryRow(context.Background(), `INSERT INTO resumes (user_id, title) VALUES ($1, 'Dev') RETURNING id`, user).Scan(&id))
	return id
}

func (w *world) vacancy(status string) uuid.UUID {
	w.t.Helper()
	var id uuid.UUID
	must(w.t, w.pool.QueryRow(context.Background(), `INSERT INTO vacancies (company_id, created_by, title, slug, description,
		category_id, region_id, employment_type, work_format, experience, schedule, status, published_at)
		VALUES ($1, $2, 'Go dasturchi', $3, 'D', $4, $5, 'full_time', 'office', 'none', 'full_day', $6::vacancy_status, now())
		RETURNING id`, w.company, w.owner, "apply-"+uuid.NewString(), w.category, w.region, status).Scan(&id))
	return id
}

// service builds the application service on pool, with a Redis client for live events.
func (w *world) service(pool *pgxpool.Pool, rdb *redis.Client) *application.Service {
	w.t.Helper()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	q := gen.New(pool)
	cat := &catalog.Service{Q: q, Log: log}
	must(w.t, cat.Reload(context.Background()))
	enq, err := jobs.NewEnqueuer(pool, log)
	must(w.t, err)
	companies := &company.Service{Pool: pool, Q: q, Catalog: cat}
	return &application.Service{
		Pool: pool, Q: q, Companies: companies,
		Resumes:   &resume.Service{Pool: pool, Q: q, Catalog: cat},
		Vacancies: &vacancy.Service{Pool: pool, Q: q, Catalog: cat, Companies: companies, Log: log},
		Notify:    &notification.Service{Pool: pool, Q: q, Publisher: &realtime.Publisher{RDB: rdb}, Jobs: enq, Log: log},
		Log:       log,
	}
}

// jobsFor lists the delivery channels queued for an application's notifications.
func (w *world) jobsFor(appID uuid.UUID) map[uuid.UUID][]string {
	w.t.Helper()
	rows, err := w.pool.Query(context.Background(), `SELECT (args->>'user_id')::uuid, args->>'channel' FROM river_job
		WHERE kind = 'notification.deliver' AND args->'payload'->>'application_id' = $1 ORDER BY 2`, appID.String())
	must(w.t, err)
	out := map[uuid.UUID][]string{}
	for rows.Next() {
		var u uuid.UUID
		var ch string
		must(w.t, rows.Scan(&u, &ch))
		out[u] = append(out[u], ch)
	}
	must(w.t, rows.Err())
	return out
}

func (w *world) storedFor(appID uuid.UUID) int {
	w.t.Helper()
	var n int
	must(w.t, w.pool.QueryRow(context.Background(), `SELECT count(*) FROM notifications
		WHERE type = 'application.new' AND payload->>'application_id' = $1`, appID.String()).Scan(&n))
	return n
}

// TZ BE-12 ✅: applying takes ≤ 5 Postgres round trips (was 12-15), and returns the same
// response; the company is notified in the same transaction (TZ BE-08).
func TestApplyRoundTrips(t *testing.T) {
	w := newWorld(t)
	ctx := context.Background()
	cpool, counter := pgtest.CountingPool(t)
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	svc := w.service(cpool, rdb)

	// Warm the connections' statement caches (steady state is what the API sees).
	for range 4 {
		other := reqctx.Principal{UserID: w.user("seeker", `UPDATE users SET email_verified_at = now() WHERE id = $1`), Role: "seeker"}
		_, err := svc.Apply(ctx, other, w.vacancy("published"), application.ApplyInput{ResumeID: w.resumeOf(other.UserID)})
		must(t, err)
	}

	v := w.vacancy("published")
	counter.Reset()
	d, err := svc.Apply(ctx, w.seeker, v, application.ApplyInput{ResumeID: w.resume, CoverLetter: "  Salom!  "})
	must(t, err)
	t.Logf("apply: %d Postgres round trips (+%d prepares)\n%s", counter.N(), counter.Prepares(), counter)
	if counter.N() > 5 {
		t.Fatalf("apply took %d round trips, want ≤ 5", counter.N())
	}
	if d.Status != "sent" || d.Source != "apply" || d.CoverLetter != "Salom!" || d.VacancyID != v || d.ResumeID != w.resume ||
		d.Vacancy == nil || d.Vacancy.ID != v || d.Vacancy.ApplicationsCount != 1 ||
		len(d.Events) != 1 || d.Events[0].To != "sent" || d.Events[0].From != nil {
		t.Fatalf("detail: %+v vacancy=%+v", d, d.Vacancy)
	}
	var count, events int
	must(t, w.pool.QueryRow(ctx, `SELECT applications_count, (SELECT count(*) FROM application_events WHERE application_id = $2)
		FROM vacancies WHERE id = $1`, v, d.ID).Scan(&count, &events))
	if count != 1 || events != 1 {
		t.Fatalf("applications_count=%d events=%d", count, events)
	}
	if got := w.jobsFor(d.ID); !slices.Equal(got[w.owner], []string{"email"}) || !slices.Equal(got[w.hr], []string{"telegram"}) || len(got) != 2 {
		t.Fatalf("delivery jobs: %v", got)
	}
	if n := w.storedFor(d.ID); n != 2 {
		t.Fatalf("stored notifications: %d", n)
	}

	// Same checks and errors as before, in the same order.
	cases := []struct {
		name string
		p    reqctx.Principal
		v    uuid.UUID
		r    uuid.UUID
		want error
	}{
		{"twice", w.seeker, v, w.resume, application.ErrAlreadyApplied},
		{"employer", reqctx.Principal{UserID: w.owner, Role: "employer"}, v, w.resume, application.ErrSeekerOnly},
		{"unverified", reqctx.Principal{UserID: w.user("seeker", ""), Role: "seeker"}, v, w.resume, company.ErrVerificationRequired},
		{"no vacancy", w.seeker, uuid.New(), w.resume, vacancy.ErrNotFound},
		{"draft", w.seeker, w.vacancy("draft"), w.resume, application.ErrVacancyClosed},
		{"someone else's resume", w.seeker, w.vacancy("published"), w.resumeOf(w.hr), resume.ErrNotFound},
	}
	for _, c := range cases {
		_, err := svc.Apply(ctx, c.p, c.v, application.ApplyInput{ResumeID: c.r})
		if !errors.Is(err, c.want) {
			t.Errorf("%s: %v, want %v", c.name, err, c.want)
		}
	}
	member := reqctx.Principal{UserID: w.user("seeker", `UPDATE users SET email_verified_at = now() WHERE id = $1`), Role: "seeker"}
	w.exec(`INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, 'recruiter')`, w.company, member.UserID)
	if _, err := svc.Apply(ctx, member, w.vacancy("published"), application.ApplyInput{ResumeID: w.resumeOf(member.UserID)}); !errors.Is(err, application.ErrOwnVacancy) {
		t.Errorf("own company: %v", err)
	}
	// The rejected duplicate wrote nothing.
	if n := w.storedFor(d.ID); n != 2 {
		t.Fatalf("duplicate apply stored notifications: %d", n)
	}
}

// TZ BE-08 ✅ crash test: the API process is killed (SIGKILL) right after the apply
// transaction commits, before anything else runs. The company's notifications and their
// delivery jobs survive, because they committed with the application.
func TestApplyCrashAfterCommit(t *testing.T) {
	if os.Getenv("JV_APPLY_CRASH") == "child" {
		crashChild(t)
		return
	}
	w := newWorld(t)
	v := w.vacancy("published")
	cmd := exec.Command(os.Args[0], "-test.run=^TestApplyCrashAfterCommit$", "-test.count=1")
	cmd.Env = append(os.Environ(), "JV_APPLY_CRASH=child",
		"JV_SEEKER="+w.seeker.UserID.String(), "JV_VACANCY="+v.String(), "JV_RESUME="+w.resume.String())
	out, err := cmd.CombinedOutput()
	var ee *exec.ExitError
	if !errors.As(err, &ee) {
		t.Fatalf("child wasn't killed: err=%v\n%s", err, out)
	}
	ws, ok := ee.Sys().(syscall.WaitStatus)
	if !ok || !ws.Signaled() || ws.Signal() != syscall.SIGKILL {
		t.Fatalf("child ended with %v, want SIGKILL\n%s", err, out)
	}

	var appID uuid.UUID
	err = w.pool.QueryRow(context.Background(), `SELECT id FROM applications WHERE vacancy_id = $1 AND seeker_id = $2`,
		v, w.seeker.UserID).Scan(&appID)
	if errors.Is(err, pgx.ErrNoRows) {
		t.Fatal("the application didn't commit before the kill")
	}
	must(t, err)
	got := w.jobsFor(appID)
	if !slices.Equal(got[w.owner], []string{"email"}) || !slices.Equal(got[w.hr], []string{"telegram"}) {
		t.Fatalf("after the crash the queued deliveries are %v, want owner=[email] hr=[telegram]", got)
	}
	if n := w.storedFor(appID); n != 2 {
		t.Fatalf("after the crash %d in-app notifications are stored, want 2", n)
	}
	t.Logf("killed right after commit; application %s kept its 2 notifications and jobs %v", appID, got)
}

// crashChild applies once with a Redis client that SIGKILLs the process on its first
// command: the post-commit live publish is the first thing that talks to Redis.
func crashChild(t *testing.T) {
	pool := pgtest.Pool(t)
	rdb := redis.NewClient(&redis.Options{Addr: "127.0.0.1:1"})
	rdb.AddHook(killHook{})
	w := &world{t: t, pool: pool}
	svc := w.service(pool, rdb)
	p := reqctx.Principal{UserID: uuid.MustParse(os.Getenv("JV_SEEKER")), Role: "seeker"}
	_, err := svc.Apply(context.Background(), p, uuid.MustParse(os.Getenv("JV_VACANCY")),
		application.ApplyInput{ResumeID: uuid.MustParse(os.Getenv("JV_RESUME"))})
	fmt.Fprintf(os.Stderr, "child: apply returned without being killed: %v\n", err)
	os.Exit(3)
}

type killHook struct{}

func (killHook) DialHook(next redis.DialHook) redis.DialHook { return next }
func (killHook) ProcessHook(next redis.ProcessHook) redis.ProcessHook {
	return func(ctx context.Context, cmd redis.Cmder) error {
		_ = syscall.Kill(os.Getpid(), syscall.SIGKILL)
		select {}
	}
}
func (killHook) ProcessPipelineHook(next redis.ProcessPipelineHook) redis.ProcessPipelineHook {
	return func(ctx context.Context, cmds []redis.Cmder) error {
		_ = syscall.Kill(os.Getpid(), syscall.SIGKILL)
		select {}
	}
}
