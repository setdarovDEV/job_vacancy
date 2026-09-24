package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"jobvacancy.uz/backend/internal/app"
	"jobvacancy.uz/backend/internal/config"
	"jobvacancy.uz/backend/internal/platform/logger"
)

func main() {
	// "/app/worker healthcheck" exits 0 when the worker's /healthz answers 200 (TZ OPS-07).
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(app.Healthcheck("WORKER_METRICS_ADDR", "127.0.0.1:9092", "/healthz"))
	}
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	log := logger.New(cfg.Log.Level, cfg.Log.Format, logger.WithRedaction(cfg.RedactLogs()))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := app.RunWorker(ctx, cfg, log); err != nil {
		log.Error("worker stopped with error", "err", err)
		os.Exit(1)
	}
}
