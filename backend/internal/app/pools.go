package app

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/internal/config"
	"jobvacancy.uz/backend/internal/pkg/token"
	"jobvacancy.uz/backend/internal/platform/postgres"
	"jobvacancy.uz/backend/internal/platform/redis"
)

// Pool sizes when DB_MAX_CONNS is not set (TZ BE-07). Postgres max_connections=200 has to
// cover api instances × APIPoolSize + the worker pool + migrate/ctl/exporters:
// 2 × 20 + 37 + ~15 = ~92.
const (
	APIPoolSize = 20
	// River also holds connections of its own (job fetch, LISTEN, leader election).
	riverOverhead = 5
)

// WorkerPoolSize is the worker's pool: one connection per River worker plus River's own.
func WorkerPoolSize(w config.Worker) int32 {
	return int32(w.CriticalWorkers + w.DefaultWorkers + w.MediaWorkers + riverOverhead)
}

// registerPoolMetrics exports pgxpool.Stat() and Redis PoolStats() to Prometheus and logs
// the pool against the server's max_connections so a misconfigured budget is visible.
func registerPoolMetrics(ctx context.Context, name string, pool *pgxpool.Pool, rdb *goredis.Client, log *slog.Logger) {
	if err := postgres.RegisterPoolMetrics(name, pool); err != nil {
		log.Warn("db pool metrics not registered", "err", err)
	}
	if err := redis.RegisterPoolMetrics(name, rdb); err != nil {
		log.Warn("redis pool metrics not registered", "err", err)
	}
	var serverMax int
	if err := pool.QueryRow(ctx, "SELECT current_setting('max_connections')::int").Scan(&serverMax); err != nil {
		log.Warn("could not read max_connections", "err", err)
		return
	}
	poolMax := pool.Config().MaxConns
	log.Info("db pool ready", "pool", name, "max_conns", poolMax, "server_max_connections", serverMax)
	if int(poolMax)*4 > serverMax {
		log.Warn("db pool uses more than a quarter of max_connections; check the connection budget",
			"pool", name, "max_conns", poolMax, "server_max_connections", serverMax)
	}
}

// accessTokens builds the JWT manager with the current key and, during a rotation, the
// previous one (TZ SEC-01).
func accessTokens(a config.Auth) *token.Manager {
	current := token.Key{ID: a.JWTKeyID, Secret: []byte(a.JWTSecret)}
	var previous *token.Key
	if a.JWTPreviousSecret != "" {
		previous = &token.Key{ID: a.JWTPreviousKeyID, Secret: []byte(a.JWTPreviousSecret)}
	}
	return token.NewRotatingManager(current, previous, a.JWTIssuer, a.AccessTokenTTL)
}
