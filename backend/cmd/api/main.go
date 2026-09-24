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
	// "/app/api healthcheck" exits 0 when /readyz answers 200 (Docker healthcheck in the
	// distroless image, TZ OPS-07). "healthcheck live" only checks that the process serves.
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		path := "/readyz"
		if len(os.Args) > 2 && os.Args[2] == "live" {
			path = "/healthz"
		}
		os.Exit(app.Healthcheck("HTTP_ADDR", ":8090", path))
	}
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	log := logger.New(cfg.Log.Level, cfg.Log.Format, logger.WithRedaction(cfg.RedactLogs()))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := app.RunAPI(ctx, cfg, log); err != nil {
		log.Error("api stopped with error", "err", err)
		os.Exit(1)
	}
}
