package app

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	goredis "github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/internal/platform/metrics"
)

// serveWorkerOps exposes the worker's /metrics (pool and River stats for Prometheus) and
// /healthz (Docker healthcheck) on a private address.
func serveWorkerOps(ctx context.Context, addr string, pool *pgxpool.Pool, rdb *goredis.Client, log *slog.Logger) {
	mux := http.NewServeMux()
	mux.Handle("GET /metrics", promhttp.Handler())
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		status, code := map[string]string{"postgres": "ok", "redis": "ok"}, http.StatusOK
		if err := pool.Ping(ctx); err != nil {
			status["postgres"], code = "down", http.StatusServiceUnavailable
		}
		if err := rdb.Ping(ctx).Err(); err != nil {
			status["redis"], code = "down", http.StatusServiceUnavailable
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		_ = json.NewEncoder(w).Encode(status)
	})
	metrics.ServeHandler(ctx, addr, mux, log)
}

// Healthcheck is the `healthcheck` subcommand of the api and worker binaries: distroless
// images have no curl, so Docker runs `/app/api healthcheck` (TZ OPS-07). It GETs
// http://127.0.0.1:<port of addrEnv><path> and returns the process exit code.
func Healthcheck(addrEnv, defaultAddr, path string) int {
	addr := os.Getenv(addrEnv)
	if addr == "" {
		addr = defaultAddr
	}
	url := "http://" + loopback(addr) + path
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		fmt.Fprintln(os.Stderr, "healthcheck:", err)
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintln(os.Stderr, "healthcheck:", url, resp.Status)
		return 1
	}
	return 0
}

// loopback turns a listen address (":8090", "0.0.0.0:8090", "[::]:8090") into one the
// healthcheck can dial inside the container.
func loopback(addr string) string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return addr
	}
	if host == "" || host == "0.0.0.0" || host == "::" || strings.EqualFold(host, "localhost") {
		host = "127.0.0.1"
	}
	return net.JoinHostPort(host, port)
}
