package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"jobvacancy.uz/backend/internal/app"
	"jobvacancy.uz/backend/internal/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	log, flush := app.NewLogger(cfg, "api")
	defer flush()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := app.RunAPI(ctx, cfg, log); err != nil {
		log.Error("api stopped with error", "err", err)
		flush()
		os.Exit(1)
	}
}
