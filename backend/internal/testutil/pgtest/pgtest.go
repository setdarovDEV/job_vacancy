// Package pgtest gives tests a migrated Postgres database.
//
// It connects to TEST_DATABASE_URL (local) or DATABASE_URL (CI, where `go test` runs
// before the migrate step) and applies the embedded migrations once per test binary,
// under goose's Postgres advisory lock so test packages running in parallel don't race.
// Without either variable the test is skipped. Tests create their own rows (unique
// e-mails and slugs) and never truncate, so they can share one database.
package pgtest

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"

	"jobvacancy.uz/backend/db"
)

var (
	once    sync.Once
	pool    *pgxpool.Pool
	initErr error
)

// Pool returns a pool on the migrated test database, or skips the test.
func Pool(t testing.TB) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = os.Getenv("DATABASE_URL")
	}
	if url == "" {
		t.Skip("set TEST_DATABASE_URL or DATABASE_URL to run database tests")
	}
	once.Do(func() { pool, initErr = setup(url) })
	if initErr != nil {
		t.Fatalf("test database: %v", initErr)
	}
	return pool
}

func setup(url string) (*pgxpool.Pool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 8
	p, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := p.Ping(ctx); err != nil {
		p.Close()
		return nil, err
	}
	migrations, err := fs.Sub(db.Migrations, "migrations")
	if err != nil {
		return nil, err
	}
	locker, err := lock.NewPostgresSessionLocker()
	if err != nil {
		return nil, err
	}
	sqlDB := stdlib.OpenDBFromPool(p)
	defer sqlDB.Close()
	provider, err := goose.NewProvider(goose.DialectPostgres, sqlDB, migrations, goose.WithSessionLocker(locker))
	if err != nil {
		return nil, err
	}
	if _, err := provider.Up(ctx); err != nil {
		p.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return p, nil
}
