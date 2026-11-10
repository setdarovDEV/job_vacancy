package app

import (
	"fmt"
	"log/slog"
	"os"

	"jobvacancy.uz/backend/internal/config"
	"jobvacancy.uz/backend/internal/platform/errtrack"
	"jobvacancy.uz/backend/internal/platform/logger"
)

// NewLogger builds the process logger; with SENTRY_DSN set, error-level records also go to
// Sentry. component is "api" or "worker". Call flush before exiting.
func NewLogger(cfg *config.Config, component string) (log *slog.Logger, flush func()) {
	tracking, flush, err := errtrack.Init(errtrack.Config{
		DSN: cfg.Sentry.DSN, Environment: cfg.Env, Release: cfg.Sentry.Release, ServerName: component,
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "sentry:", err)
	}
	var wrap []func(slog.Handler) slog.Handler
	if tracking {
		wrap = append(wrap, errtrack.Wrap)
	}
	return logger.New(cfg.Log.Level, cfg.Log.Format, wrap...), flush
}
