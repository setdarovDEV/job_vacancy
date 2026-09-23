package app

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivermigrate"

	"jobvacancy.uz/backend/internal/config"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

// Migrate applies (up) or rolls back one step of (down) the application schema, and keeps
// River's own queue tables at the version matching the linked library.
func Migrate(ctx context.Context, cfg *config.Config, log *slog.Logger, direction string) error {
	pool, err := postgres.NewPool(ctx, cfg.DB)
	if err != nil {
		return err
	}
	defer pool.Close()

	provider, err := goose.NewProvider(goose.DialectPostgres, stdlib.OpenDBFromPool(pool), migrationsFS())
	if err != nil {
		return fmt.Errorf("goose: %w", err)
	}

	switch direction {
	case "up":
		if err := migrateRiver(ctx, pool, log); err != nil {
			return err
		}
		results, err := provider.Up(ctx)
		for _, r := range results {
			log.Info("migration applied", "version", r.Source.Version, "file", r.Source.Path, "took", r.Duration)
		}
		if err != nil {
			return fmt.Errorf("goose up: %w", err)
		}
		if len(results) == 0 {
			log.Info("schema is up to date")
		}
	case "down":
		r, err := provider.Down(ctx)
		if err != nil {
			return fmt.Errorf("goose down: %w", err)
		}
		if r != nil {
			log.Info("migration rolled back", "version", r.Source.Version, "file", r.Source.Path)
		}
	case "status":
		statuses, err := provider.Status(ctx)
		if err != nil {
			return err
		}
		for _, s := range statuses {
			log.Info("migration", "version", s.Source.Version, "file", s.Source.Path, "state", s.State)
		}
	default:
		return fmt.Errorf("unknown direction %q (want up, down or status)", direction)
	}
	return nil
}

func migrateRiver(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger) error {
	m, err := rivermigrate.New(riverpgxv5.New(pool), &rivermigrate.Config{Logger: log})
	if err != nil {
		return fmt.Errorf("river migrate: %w", err)
	}
	res, err := m.Migrate(ctx, rivermigrate.DirectionUp, nil)
	if err != nil {
		return fmt.Errorf("river migrate: %w", err)
	}
	for _, v := range res.Versions {
		log.Info("river migration applied", "version", v.Version)
	}
	return nil
}
