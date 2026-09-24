package postgres

import (
	"context"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// PoolAcquireDuration is how long a request waited for a pooled connection (TZ BE-07:
// p95 < 1 ms at 300 RPS). A growing tail means the pool is too small for the load.
var PoolAcquireDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name:    "db_pool_acquire_duration_seconds",
	Help:    "Time to acquire a Postgres connection from the pool.",
	Buckets: []float64{.00001, .00005, .0001, .00025, .0005, .001, .0025, .005, .01, .025, .05, .1, .25, 1},
}, []string{"pool"})

type acquireStartKey struct{}

// acquireTracer records PoolAcquireDuration; pgxpool calls it through ConnConfig.Tracer.
type acquireTracer struct{ hist prometheus.Observer }

func newAcquireTracer(name string) *acquireTracer {
	return &acquireTracer{hist: PoolAcquireDuration.WithLabelValues(name)}
}

func (t *acquireTracer) TraceAcquireStart(ctx context.Context, _ *pgxpool.Pool, _ pgxpool.TraceAcquireStartData) context.Context {
	return context.WithValue(ctx, acquireStartKey{}, time.Now())
}

func (t *acquireTracer) TraceAcquireEnd(ctx context.Context, _ *pgxpool.Pool, data pgxpool.TraceAcquireEndData) {
	if start, ok := ctx.Value(acquireStartKey{}).(time.Time); ok && data.Err == nil {
		t.hist.Observe(time.Since(start).Seconds())
	}
}

// pgx.QueryTracer is required by ConnConfig.Tracer; queries are not traced.
func (t *acquireTracer) TraceQueryStart(ctx context.Context, _ *pgx.Conn, _ pgx.TraceQueryStartData) context.Context {
	return ctx
}

func (t *acquireTracer) TraceQueryEnd(context.Context, *pgx.Conn, pgx.TraceQueryEndData) {}

// RegisterPoolMetrics exports pool.Stat() as db_pool_* series labelled pool=<name>,
// read at scrape time (no background goroutine). One collector serves every pool of
// the process; registering a name twice replaces the previous pool.
func RegisterPoolMetrics(name string, pool *pgxpool.Pool) error {
	collector.mu.Lock()
	collector.pools[name] = pool
	collector.mu.Unlock()
	var err error
	registerOnce.Do(func() { err = prometheus.Register(collector) })
	return err
}

var (
	registerOnce sync.Once
	collector    = &poolCollector{pools: map[string]*pgxpool.Pool{}}
)

var poolDescs = struct {
	max, total, acquired, idle, constructing                          *prometheus.Desc
	acquires, emptyAcquires, canceled, newConns, lifetimeKill, idleKill *prometheus.Desc
	acquireWait, emptyWait                                             *prometheus.Desc
}{
	max:           poolDesc("db_pool_max_conns", "Maximum size of the pool."),
	total:         poolDesc("db_pool_total_conns", "Open connections (idle + acquired + constructing)."),
	acquired:      poolDesc("db_pool_acquired_conns", "Connections currently in use."),
	idle:          poolDesc("db_pool_idle_conns", "Idle connections."),
	constructing:  poolDesc("db_pool_constructing_conns", "Connections being established."),
	acquires:      poolDesc("db_pool_acquires_total", "Successful acquires."),
	emptyAcquires: poolDesc("db_pool_empty_acquires_total", "Acquires that had to wait because the pool was empty."),
	canceled:      poolDesc("db_pool_canceled_acquires_total", "Acquires cancelled by their context."),
	newConns:      poolDesc("db_pool_new_conns_total", "Connections opened."),
	lifetimeKill:  poolDesc("db_pool_max_lifetime_destroys_total", "Connections closed for exceeding MaxConnLifetime."),
	idleKill:      poolDesc("db_pool_max_idle_destroys_total", "Connections closed for exceeding MaxConnIdleTime."),
	acquireWait:   poolDesc("db_pool_acquire_seconds_total", "Total time spent in successful acquires."),
	emptyWait:     poolDesc("db_pool_empty_acquire_wait_seconds_total", "Total time spent waiting on an empty pool."),
}

func poolDesc(name, help string) *prometheus.Desc {
	return prometheus.NewDesc(name, help, []string{"pool"}, nil)
}

type poolCollector struct {
	mu    sync.Mutex
	pools map[string]*pgxpool.Pool
}

func (c *poolCollector) Describe(ch chan<- *prometheus.Desc) {
	d := poolDescs
	for _, x := range []*prometheus.Desc{d.max, d.total, d.acquired, d.idle, d.constructing, d.acquires,
		d.emptyAcquires, d.canceled, d.newConns, d.lifetimeKill, d.idleKill, d.acquireWait, d.emptyWait} {
		ch <- x
	}
}

func (c *poolCollector) Collect(ch chan<- prometheus.Metric) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for name, pool := range c.pools {
		collectPool(ch, name, pool.Stat())
	}
}

func collectPool(ch chan<- prometheus.Metric, name string, s *pgxpool.Stat) {
	d := poolDescs
	gauge := func(desc *prometheus.Desc, v float64) {
		ch <- prometheus.MustNewConstMetric(desc, prometheus.GaugeValue, v, name)
	}
	counter := func(desc *prometheus.Desc, v float64) {
		ch <- prometheus.MustNewConstMetric(desc, prometheus.CounterValue, v, name)
	}
	gauge(d.max, float64(s.MaxConns()))
	gauge(d.total, float64(s.TotalConns()))
	gauge(d.acquired, float64(s.AcquiredConns()))
	gauge(d.idle, float64(s.IdleConns()))
	gauge(d.constructing, float64(s.ConstructingConns()))
	counter(d.acquires, float64(s.AcquireCount()))
	counter(d.emptyAcquires, float64(s.EmptyAcquireCount()))
	counter(d.canceled, float64(s.CanceledAcquireCount()))
	counter(d.newConns, float64(s.NewConnsCount()))
	counter(d.lifetimeKill, float64(s.MaxLifetimeDestroyCount()))
	counter(d.idleKill, float64(s.MaxIdleDestroyCount()))
	counter(d.acquireWait, s.AcquireDuration().Seconds())
	counter(d.emptyWait, s.EmptyAcquireWaitTime().Seconds())
}
