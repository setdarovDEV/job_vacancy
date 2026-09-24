// Package jobs defines background jobs processed by cmd/worker through River
// (a Postgres-backed queue: jobs are inserted in the same database, so enqueueing can be
// part of a transaction and nothing is lost if Redis goes down).
package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/file"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/modules/savedsearch"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/platform/mailer"
	"jobvacancy.uz/backend/internal/platform/storage"
	"jobvacancy.uz/backend/internal/platform/telegram"
)

const (
	QueueCritical = "critical" // user is waiting for it (OTP e-mails)
	QueueDefault  = river.QueueDefault
)

// ---- e-mail with a one-time code -------------------------------------------------------

type EmailCodeArgs struct {
	To         string `json:"to"`
	Template   string `json:"template"`
	Locale     string `json:"locale"`
	Code       string `json:"code"`
	TTLMinutes int    `json:"ttl_minutes"`
}

func (EmailCodeArgs) Kind() string { return "email.code" }

func (EmailCodeArgs) InsertOpts() river.InsertOpts {
	return river.InsertOpts{Queue: QueueCritical, MaxAttempts: 5}
}

type EmailCodeWorker struct {
	river.WorkerDefaults[EmailCodeArgs]
	Mailer mailer.Mailer
}

func (w *EmailCodeWorker) Timeout(*river.Job[EmailCodeArgs]) time.Duration { return 30 * time.Second }

func (w *EmailCodeWorker) Work(ctx context.Context, job *river.Job[EmailCodeArgs]) error {
	a := job.Args
	// A code that outlived its TTL is useless; don't keep retrying it.
	if time.Since(job.CreatedAt) > time.Duration(a.TTLMinutes)*time.Minute {
		return river.JobCancel(fmt.Errorf("code expired before delivery"))
	}
	msg, err := mailer.RenderCode(a.Template, a.Locale, a.To, a.Code, a.TTLMinutes)
	if err != nil {
		return river.JobCancel(err)
	}
	return w.Mailer.Send(ctx, msg)
}

// ---- periodic cleanup ------------------------------------------------------------------

type CleanupSessionsArgs struct{}

func (CleanupSessionsArgs) Kind() string { return "auth.cleanup_sessions" }

type CleanupSessionsWorker struct {
	river.WorkerDefaults[CleanupSessionsArgs]
	Q   *gen.Queries
	Log *slog.Logger
}

func (w *CleanupSessionsWorker) Work(ctx context.Context, _ *river.Job[CleanupSessionsArgs]) error {
	n, err := w.Q.DeleteExpiredSessions(ctx)
	if err != nil {
		return err
	}
	w.Log.Info("expired sessions deleted", "count", n)
	return nil
}

// ---- vacancies ---------------------------------------------------------------------------

type FlushViewsArgs struct{}

func (FlushViewsArgs) Kind() string { return "vacancy.flush_views" }

type FlushViewsWorker struct {
	river.WorkerDefaults[FlushViewsArgs]
	Views *vacancy.ViewCounter
	Q     *gen.Queries
}

func (w *FlushViewsWorker) Work(ctx context.Context, _ *river.Job[FlushViewsArgs]) error {
	_, err := w.Views.Flush(ctx, w.Q)
	return err
}

type ExpireVacanciesArgs struct{}

func (ExpireVacanciesArgs) Kind() string { return "vacancy.expire" }

type ExpireVacanciesWorker struct {
	river.WorkerDefaults[ExpireVacanciesArgs]
	Q *gen.Queries
	// Cache drops the expired vacancies' public pages (TZ BE-05); nil skips that.
	Cache *vacancy.PublicCache
	Log   *slog.Logger
}

func (w *ExpireVacanciesWorker) Work(ctx context.Context, _ *river.Job[ExpireVacanciesArgs]) error {
	rows, err := w.Q.ExpireVacancies(ctx)
	if err != nil {
		return err
	}
	if len(rows) == 0 {
		return nil
	}
	refs := make([]vacancy.VacancyRef, len(rows))
	for i, r := range rows {
		refs[i] = vacancy.VacancyRef{ID: r.ID, Slug: r.Slug, CompanyID: r.CompanyID, CompanySlug: r.CompanySlug}
	}
	w.Cache.VacanciesChanged(ctx, refs...)
	w.Log.Info("vacancies expired", "count", len(rows))
	return nil
}

// ---- files -------------------------------------------------------------------------------

type CleanupUploadsArgs struct{}

func (CleanupUploadsArgs) Kind() string { return "file.cleanup_pending" }

type CleanupUploadsWorker struct {
	river.WorkerDefaults[CleanupUploadsArgs]
	Files *file.Service
	Log   *slog.Logger
}

func (w *CleanupUploadsWorker) Work(ctx context.Context, _ *river.Job[CleanupUploadsArgs]) error {
	n, err := w.Files.CleanupPending(ctx)
	if n > 0 {
		w.Log.Info("abandoned uploads removed", "count", n)
	}
	return err
}

// ---- notifications -------------------------------------------------------------------------

type DeliverWorker struct {
	river.WorkerDefaults[notification.DeliverArgs]
	D *notification.Deliverer
}

func (w *DeliverWorker) Timeout(*river.Job[notification.DeliverArgs]) time.Duration {
	return 30 * time.Second
}

func (w *DeliverWorker) Work(ctx context.Context, job *river.Job[notification.DeliverArgs]) error {
	return w.D.Deliver(ctx, job.Args)
}

// ---- saved-search alerts -----------------------------------------------------------------

type SavedSearchAlertsArgs struct{}

func (SavedSearchAlertsArgs) Kind() string { return "savedsearch.alerts" }

type SavedSearchAlertsWorker struct {
	river.WorkerDefaults[SavedSearchAlertsArgs]
	Svc *savedsearch.Service
	Log *slog.Logger
}

func (w *SavedSearchAlertsWorker) Timeout(*river.Job[SavedSearchAlertsArgs]) time.Duration {
	return 10 * time.Minute
}

func (w *SavedSearchAlertsWorker) Work(ctx context.Context, _ *river.Job[SavedSearchAlertsArgs]) error {
	checked, alerted, err := w.Svc.RunAlerts(ctx)
	if checked > 0 {
		w.Log.Info("saved searches checked", "checked", checked, "alerted", alerted)
	}
	return err
}

// ---- wiring ----------------------------------------------------------------------------

type Deps struct {
	Pool    *pgxpool.Pool
	Redis   *redis.Client
	Mailer  mailer.Mailer
	Storage *storage.Storage
	Bot     telegram.Bot
	Push    notification.PushSender
	WebURL  string
	Saved   *savedsearch.Service
	Log     *slog.Logger
	// River concurrency per queue (TZ BE-07: critical 10, default 20); 0 uses those.
	CriticalWorkers int
	DefaultWorkers  int
}

func periodic(every time.Duration, args river.JobArgs) *river.PeriodicJob {
	return river.NewPeriodicJob(river.PeriodicInterval(every),
		func() (river.JobArgs, *river.InsertOpts) { return args, nil },
		&river.PeriodicJobOpts{RunOnStart: true})
}

// NewWorkerClient builds the River client that actually processes jobs (cmd/worker).
func NewWorkerClient(d Deps) (*river.Client[pgx.Tx], error) {
	workers := river.NewWorkers()
	river.AddWorker(workers, &EmailCodeWorker{Mailer: d.Mailer})
	q := gen.New(d.Pool)
	river.AddWorker(workers, &CleanupSessionsWorker{Q: q, Log: d.Log})
	river.AddWorker(workers, &FlushViewsWorker{Views: &vacancy.ViewCounter{RDB: d.Redis}, Q: q})
	river.AddWorker(workers, &ExpireVacanciesWorker{Q: q, Cache: vacancy.NewPublicCache(d.Redis, d.Log), Log: d.Log})
	river.AddWorker(workers, &DeliverWorker{D: &notification.Deliverer{
		Q: q, Mailer: d.Mailer, Bot: d.Bot, Push: d.Push, WebURL: d.WebURL, Log: d.Log,
	}})
	river.AddWorker(workers, &SavedSearchAlertsWorker{Svc: d.Saved, Log: d.Log})
	river.AddWorker(workers, &CleanupUploadsWorker{Files: &file.Service{Q: q, Storage: d.Storage, Log: d.Log}, Log: d.Log})

	return river.NewClient(riverpgxv5.New(d.Pool), &river.Config{
		Logger: d.Log,
		Queues: map[string]river.QueueConfig{
			QueueCritical: {MaxWorkers: orDefault(d.CriticalWorkers, 10)},
			QueueDefault:  {MaxWorkers: orDefault(d.DefaultWorkers, 20)},
		},
		// A job whose worker died (SIGKILL after the grace period) is picked up again after
		// this; it must stay above the longest job timeout (saved-search alerts, 10 min).
		RescueStuckJobsAfter: 15 * time.Minute,
		Workers:              workers,
		// Finished jobs may contain one-time codes; don't keep them around.
		CompletedJobRetentionPeriod: time.Hour,
		PeriodicJobs: []*river.PeriodicJob{
			periodic(6*time.Hour, CleanupSessionsArgs{}),
			periodic(time.Minute, FlushViewsArgs{}),
			periodic(10*time.Minute, ExpireVacanciesArgs{}),
			periodic(6*time.Hour, CleanupUploadsArgs{}),
			periodic(5*time.Minute, SavedSearchAlertsArgs{}),
		},
	})
}

func orDefault(n, def int) int {
	if n > 0 {
		return n
	}
	return def
}

// Enqueuer is the insert-only side used by the API process.
type Enqueuer struct{ client *river.Client[pgx.Tx] }

func NewEnqueuer(pool *pgxpool.Pool, log *slog.Logger) (*Enqueuer, error) {
	c, err := river.NewClient(riverpgxv5.New(pool), &river.Config{Logger: log})
	if err != nil {
		return nil, err
	}
	return &Enqueuer{client: c}, nil
}

func (e *Enqueuer) EnqueueEmailCode(ctx context.Context, a EmailCodeArgs) error {
	_, err := e.client.Insert(ctx, a, nil)
	return err
}

// InsertManyTx enqueues several jobs inside tx in one round trip, so they commit (or roll
// back) with the business change that caused them (TZ BE-08).
func (e *Enqueuer) InsertManyTx(ctx context.Context, tx pgx.Tx, args []river.JobArgs) error {
	if len(args) == 0 {
		return nil
	}
	params := make([]river.InsertManyParams, len(args))
	for i, a := range args {
		params[i] = river.InsertManyParams{Args: a}
	}
	_, err := e.client.InsertManyTx(ctx, tx, params)
	return err
}
