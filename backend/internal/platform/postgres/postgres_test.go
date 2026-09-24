package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/prometheus/client_golang/prometheus"

	"jobvacancy.uz/backend/internal/config"
)

// testDB returns the settings for a reachable test database or skips the test.
// CI provides DATABASE_URL (Postgres 18 service); locally TEST_DATABASE_URL wins.
func testDB(t *testing.T) config.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		url = os.Getenv("DATABASE_URL")
	}
	if url == "" {
		t.Skip("set TEST_DATABASE_URL or DATABASE_URL to run database tests")
	}
	return config.DB{URL: url, MinConns: 0, MaxConnLifetime: time.Hour, MaxConnIdleTime: time.Minute,
		StatementTimeout: 5 * time.Second, LockTimeout: 3 * time.Second, IdleInTxTimeout: 10 * time.Second}
}

// TZ BE-01: on the API/worker pool a runaway query is cut off by statement_timeout (5s).
func TestSessionLimitsCancelSlowQuery(t *testing.T) {
	cfg := testDB(t)
	ctx := context.Background()
	pool, err := NewPool(ctx, cfg, Named("test"), DefaultMaxConns(2), WithSessionLimits())
	if err != nil {
		t.Skipf("database unreachable: %v", err)
	}
	defer pool.Close()

	start := time.Now()
	_, err = pool.Exec(ctx, "SELECT pg_sleep(10)")
	took := time.Since(start)
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "57014" {
		t.Fatalf("pg_sleep(10): want query_canceled (57014), got %v", err)
	}
	if took < 4500*time.Millisecond || took > 7*time.Second {
		t.Fatalf("pg_sleep(10) was cancelled after %v, want ~5s", took)
	}
	t.Logf("pg_sleep(10) cancelled by statement_timeout after %v", took.Round(10*time.Millisecond))

	var stmt, lock, idle, app string
	if err := pool.QueryRow(ctx, `SELECT current_setting('statement_timeout'), current_setting('lock_timeout'),
		current_setting('idle_in_transaction_session_timeout'), current_setting('application_name')`).
		Scan(&stmt, &lock, &idle, &app); err != nil {
		t.Fatal(err)
	}
	if stmt != "5s" || lock != "3s" || idle != "10s" || app != "jobvacancy-test" {
		t.Fatalf("session settings = %s/%s/%s/%s", stmt, lock, idle, app)
	}
	if max := pool.Config().MaxConns; max != 2 {
		t.Fatalf("MaxConns = %d, want the process default 2", max)
	}
}

// migrate and ctl build their pool without options and must not inherit the limits.
func TestToolPoolHasNoLimits(t *testing.T) {
	cfg := testDB(t)
	cfg.MaxConns = 3
	pool, err := NewPool(context.Background(), cfg, DefaultMaxConns(20))
	if err != nil {
		t.Skipf("database unreachable: %v", err)
	}
	defer pool.Close()
	var stmt, idle string
	if err := pool.QueryRow(context.Background(),
		`SELECT current_setting('statement_timeout'), current_setting('idle_in_transaction_session_timeout')`).
		Scan(&stmt, &idle); err != nil {
		t.Fatal(err)
	}
	if stmt != "0" || idle != "0" {
		t.Fatalf("tool pool has limits: statement_timeout=%s idle_in_tx=%s", stmt, idle)
	}
	if max := pool.Config().MaxConns; max != 3 {
		t.Fatalf("DB_MAX_CONNS must win over the default: MaxConns = %d", max)
	}
}

func TestAcquireIsMeasured(t *testing.T) {
	cfg := testDB(t)
	pool, err := NewPool(context.Background(), cfg, Named("acquire_test"), DefaultMaxConns(2))
	if err != nil {
		t.Skipf("database unreachable: %v", err)
	}
	defer pool.Close()
	if err := RegisterPoolMetrics("acquire_test", pool); err != nil {
		t.Fatal(err)
	}
	for range 5 {
		if _, err := pool.Exec(context.Background(), "SELECT 1"); err != nil {
			t.Fatal(err)
		}
	}
	if pool.Stat().AcquireCount() < 5 {
		t.Fatalf("acquires not counted: %d", pool.Stat().AcquireCount())
	}
}

func TestPoolMetricsExported(t *testing.T) {
	cfg := testDB(t)
	a, err := NewPool(context.Background(), cfg, Named("m_a"), DefaultMaxConns(2))
	if err != nil {
		t.Skipf("database unreachable: %v", err)
	}
	defer a.Close()
	b, err := NewPool(context.Background(), cfg, Named("m_b"), DefaultMaxConns(3))
	if err != nil {
		t.Fatal(err)
	}
	defer b.Close()
	if err := RegisterPoolMetrics("m_a", a); err != nil {
		t.Fatal(err)
	}
	if err := RegisterPoolMetrics("m_b", b); err != nil {
		t.Fatalf("second pool: %v", err)
	}
	mfs, err := prometheus.DefaultGatherer.Gather()
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]float64{}
	for _, mf := range mfs {
		if mf.GetName() != "db_pool_max_conns" {
			continue
		}
		for _, m := range mf.GetMetric() {
			seen[m.GetLabel()[0].GetValue()] = m.GetGauge().GetValue()
		}
	}
	if seen["m_a"] != 2 || seen["m_b"] != 3 {
		t.Fatalf("db_pool_max_conns = %v", seen)
	}
}
