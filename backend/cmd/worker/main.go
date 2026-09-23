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
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	log := logger.New(cfg.Log.Level, cfg.Log.Format)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := app.RunWorker(ctx, cfg, log); err != nil {
		log.Error("worker stopped with error", "err", err)
		os.Exit(1)
	}
}
