// Command migrate applies database migrations: migrate [up|down|status] (default up).
package main

import (
	"context"
	"fmt"
	"os"

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
	log := logger.New(cfg.Log.Level, cfg.Log.Format, logger.WithRedaction(cfg.RedactLogs()))

	direction := "up"
	if len(os.Args) > 1 {
		direction = os.Args[1]
	}
	if err := app.Migrate(context.Background(), cfg, log, direction); err != nil {
		log.Error("migration failed", "err", err)
		os.Exit(1)
	}
}
