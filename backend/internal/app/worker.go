package app

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"

	"fmt"
	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/savedsearch"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/realtime"
	"log/slog"
	"time"

	"jobvacancy.uz/backend/internal/config"
	"jobvacancy.uz/backend/internal/jobs"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/platform/mailer"
	"jobvacancy.uz/backend/internal/platform/postgres"
	"jobvacancy.uz/backend/internal/platform/redis"
	"jobvacancy.uz/backend/internal/platform/storage"
	"jobvacancy.uz/backend/internal/platform/telegram"
)

// RunWorker processes background jobs until ctx is cancelled, then lets running jobs finish.
func RunWorker(ctx context.Context, cfg *config.Config, log *slog.Logger) error {
	pool, err := postgres.NewPool(ctx, cfg.DB, postgres.Named("worker"),
		postgres.DefaultMaxConns(WorkerPoolSize(cfg.Worker)), postgres.WithSessionLimits())
	if err != nil {
		return err
	}
	defer pool.Close()

	rdb, err := redis.New(ctx, cfg.Redis.URL)
	if err != nil {
		return err
	}
	defer rdb.Close()
	registerPoolMetrics(ctx, "worker", pool, rdb, log)
	go serveWorkerOps(ctx, cfg.Worker.MetricsAddr, pool, rdb, log)

	st, err := storage.New(cfg.S3)
	if err != nil {
		return err
	}

	m, err := mailer.NewSMTP(cfg.SMTP)
	if err != nil {
		return err
	}
	var bot telegram.Bot = telegram.LogBot{Log: log}
	if cfg.Telegram.BotToken != "" {
		bot = telegram.NewBot(cfg.Telegram.BotToken, cfg.Telegram.BotUsername)
	}
	saved, err := SavedSearches(ctx, pool, rdb, log)
	if err != nil {
		return err
	}
	client, err := jobs.NewWorkerClient(jobs.Deps{
		Pool: pool, Redis: rdb, Mailer: m, Storage: st, Bot: bot,
		Push: notification.LogPush{Log: log}, WebURL: cfg.WebURL, Saved: saved, Log: log,
		CriticalWorkers: cfg.Worker.CriticalWorkers, DefaultWorkers: cfg.Worker.DefaultWorkers,
	})
	if err != nil {
		return fmt.Errorf("river: %w", err)
	}
	// Start with a background context: shutdown is driven explicitly below.
	if err := client.Start(context.Background()); err != nil {
		return fmt.Errorf("river start: %w", err)
	}
	log.Info("worker started")

	<-ctx.Done()
	return stopWorker(client, cfg.Worker.ShutdownTimeout, log)
}

// riverStopper is the part of *river.Client used for shutdown.
type riverStopper interface {
	Stop(ctx context.Context) error
	StopAndCancel(ctx context.Context) error
}

// stopWorker lets running jobs finish for up to timeout, then cancels the rest (TZ OPS-07).
// Cancelled jobs are marked retryable by River and run again on the next worker, so a
// rolling restart loses nothing; jobs not yet fetched simply stay in the queue.
func stopWorker(c riverStopper, timeout time.Duration, log *slog.Logger) error {
	log.Info("shutting down worker", "timeout", timeout)
	stopCtx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	err := c.Stop(stopCtx)
	if !errors.Is(err, context.DeadlineExceeded) {
		return err
	}
	log.Warn("jobs still running after the shutdown timeout; cancelling them (they will be retried)")
	cancelCtx, cancel2 := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel2()
	return c.StopAndCancel(cancelCtx)
}

// SavedSearches builds the alert service outside the API: it needs vacancy listing (with
// the catalog snapshot) and notifications, whose jobs go through an insert-only client.
func SavedSearches(ctx context.Context, pool *pgxpool.Pool, rdb *goredis.Client, log *slog.Logger) (*savedsearch.Service, error) {
	q := gen.New(pool)
	cat := &catalog.Service{Q: q, Log: log}
	if err := cat.Start(ctx); err != nil {
		return nil, err
	}
	enq, err := jobs.NewEnqueuer(pool, log)
	if err != nil {
		return nil, err
	}
	notify := &notification.Service{Q: q, Publisher: &realtime.Publisher{RDB: rdb}, Jobs: enq, Log: log}
	return &savedsearch.Service{Q: q, Vacancies: &vacancy.Service{Pool: pool, Q: q, Catalog: cat, Log: log},
		Notify: notify, Log: log}, nil
}
