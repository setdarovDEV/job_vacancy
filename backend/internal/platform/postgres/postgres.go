// Package postgres creates the shared pgx connection pool.
package postgres

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"jobvacancy.uz/backend/internal/config"
)

type settings struct {
	name     string
	maxConns int32
	limits   bool
}

// Option tunes a pool for the process that owns it.
type Option func(*settings)

// Named labels the pool: Postgres application_name "jobvacancy-<name>" (pg_stat_activity)
// and the pool="<name>" label of the db_pool_* metrics.
func Named(name string) Option { return func(s *settings) { s.name = name } }

// DefaultMaxConns sizes the pool when DB_MAX_CONNS is not set (api 20, worker 35).
func DefaultMaxConns(n int32) Option { return func(s *settings) { s.maxConns = n } }

// WithSessionLimits applies DB_STATEMENT_TIMEOUT, DB_LOCK_TIMEOUT and
// DB_IDLE_IN_TX_TIMEOUT to every connection. Only the API and worker pools use it:
// migrate and ctl share NewPool and must be able to run CREATE INDEX CONCURRENTLY and
// long backfills.
func WithSessionLimits() Option { return func(s *settings) { s.limits = true } }

func NewPool(ctx context.Context, cfg config.DB, opts ...Option) (*pgxpool.Pool, error) {
	var s settings
	for _, o := range opts {
		o(&s)
	}
	pc, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("postgres: parse url: %w", err)
	}
	switch {
	case cfg.MaxConns > 0:
		pc.MaxConns = cfg.MaxConns
	case s.maxConns > 0:
		pc.MaxConns = s.maxConns
	}
	pc.MinConns = min(cfg.MinConns, pc.MaxConns)
	pc.MaxConnLifetime = cfg.MaxConnLifetime
	pc.MaxConnIdleTime = cfg.MaxConnIdleTime
	pc.HealthCheckPeriod = 30 * time.Second
	// pgx caches prepared statements per connection by default (QueryExecModeCacheStatement),
	// so sqlc queries are parsed and planned once per connection.

	rp := pc.ConnConfig.RuntimeParams
	if s.name != "" {
		rp["application_name"] = "jobvacancy-" + s.name
		pc.ConnConfig.Tracer = newAcquireTracer(s.name)
	}
	if s.limits {
		ms := func(d time.Duration) string { return strconv.FormatInt(d.Milliseconds(), 10) }
		rp["statement_timeout"] = ms(cfg.StatementTimeout)
		rp["lock_timeout"] = ms(cfg.LockTimeout)
		rp["idle_in_transaction_session_timeout"] = ms(cfg.IdleInTxTimeout)
	}

	pool, err := pgxpool.NewWithConfig(ctx, pc)
	if err != nil {
		return nil, fmt.Errorf("postgres: connect: %w", err)
	}
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres: ping: %w", err)
	}
	return pool, nil
}
