package pgtest

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/riverqueue/river/rivermigrate"
)

// Counter counts the Postgres round trips made through a pool from CountingPool: every
// Query/Exec/QueryRow (BEGIN and COMMIT included) and every batch count as one. Statement
// preparation on a connection's first use of a query is counted apart (Prepares), since
// steady-state traffic doesn't pay it.
type Counter struct {
	mu       sync.Mutex
	trips    []string
	prepares int
}

func (c *Counter) add(s string) {
	c.mu.Lock()
	c.trips = append(c.trips, s)
	c.mu.Unlock()
}

// Reset starts a new measurement.
func (c *Counter) Reset() {
	c.mu.Lock()
	c.trips, c.prepares = nil, 0
	c.mu.Unlock()
}

// N is the number of round trips since the last Reset.
func (c *Counter) N() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.trips)
}

// Prepares is the number of statement preparations since the last Reset.
func (c *Counter) Prepares() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.prepares
}

// String lists the round trips, one per line (for failure messages).
func (c *Counter) String() string {
	c.mu.Lock()
	defer c.mu.Unlock()
	var b strings.Builder
	for i, s := range c.trips {
		fmt.Fprintf(&b, "%2d. %s\n", i+1, s)
	}
	return b.String()
}

func oneLine(sql string) string {
	s := strings.Join(strings.Fields(sql), " ")
	if len(s) > 110 {
		s = s[:110] + "…"
	}
	return s
}

func (c *Counter) TraceQueryStart(ctx context.Context, _ *pgx.Conn, d pgx.TraceQueryStartData) context.Context {
	c.add(oneLine(d.SQL))
	return ctx
}

func (c *Counter) TraceQueryEnd(context.Context, *pgx.Conn, pgx.TraceQueryEndData) {}

func (c *Counter) TraceBatchStart(ctx context.Context, _ *pgx.Conn, d pgx.TraceBatchStartData) context.Context {
	var parts []string
	if d.Batch != nil {
		for _, q := range d.Batch.QueuedQueries {
			parts = append(parts, oneLine(q.SQL)[:min(40, len(oneLine(q.SQL)))])
		}
	}
	c.add(fmt.Sprintf("batch[%d]: %s", len(parts), strings.Join(parts, " | ")))
	return ctx
}

func (c *Counter) TraceBatchQuery(context.Context, *pgx.Conn, pgx.TraceBatchQueryData) {}
func (c *Counter) TraceBatchEnd(context.Context, *pgx.Conn, pgx.TraceBatchEndData)     {}

func (c *Counter) TracePrepareStart(ctx context.Context, _ *pgx.Conn, _ pgx.TracePrepareStartData) context.Context {
	c.mu.Lock()
	c.prepares++
	c.mu.Unlock()
	return ctx
}

func (c *Counter) TracePrepareEnd(context.Context, *pgx.Conn, pgx.TracePrepareEndData) {}

// CountingPool returns a separate pool on the migrated test database whose round trips
// are counted (TZ QA-01: query counts of list endpoints).
func CountingPool(t testing.TB) (*pgxpool.Pool, *Counter) {
	t.Helper()
	Pool(t) // migrated (or skipped)
	cfg, err := pgxpool.ParseConfig(url())
	if err != nil {
		t.Fatal(err)
	}
	c := &Counter{}
	cfg.ConnConfig.Tracer = c
	cfg.MaxConns = 4
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	p, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(p.Close)
	return p, c
}

func url() string {
	if u := os.Getenv("TEST_DATABASE_URL"); u != "" {
		return u
	}
	return os.Getenv("DATABASE_URL")
}

var riverOnce sync.Once
var riverErr error

// River makes sure River's queue tables exist in the test database (cmd/migrate creates
// them in real deployments). Packages testing in parallel serialize on an advisory lock.
func River(t testing.TB) {
	t.Helper()
	pool := Pool(t)
	riverOnce.Do(func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
		defer cancel()
		conn, err := pool.Acquire(ctx)
		if err != nil {
			riverErr = err
			return
		}
		defer conn.Release()
		if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock(727401)`); err != nil {
			riverErr = err
			return
		}
		defer func() { _, _ = conn.Exec(context.Background(), `SELECT pg_advisory_unlock(727401)`) }()
		m, err := rivermigrate.New(riverpgxv5.New(pool), nil)
		if err != nil {
			riverErr = err
			return
		}
		_, riverErr = m.Migrate(ctx, rivermigrate.DirectionUp, nil)
	})
	if riverErr != nil {
		t.Fatalf("river migrate: %v", riverErr)
	}
}
