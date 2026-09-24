package redis

import (
	"sync"

	"github.com/prometheus/client_golang/prometheus"
	goredis "github.com/redis/go-redis/v9"
)

// RegisterPoolMetrics exports the client's PoolStats() as redis_pool_* series labelled
// pool=<name>, read at scrape time (TZ BE-07). One collector serves every client.
func RegisterPoolMetrics(name string, c *goredis.Client) error {
	collector.mu.Lock()
	collector.clients[name] = c
	collector.mu.Unlock()
	var err error
	registerOnce.Do(func() { err = prometheus.Register(collector) })
	return err
}

var (
	registerOnce sync.Once
	collector    = &poolCollector{clients: map[string]*goredis.Client{}}
)

func desc(name, help string) *prometheus.Desc {
	return prometheus.NewDesc(name, help, []string{"pool"}, nil)
}

var (
	descHits     = desc("redis_pool_hits_total", "Times a free connection was found in the pool.")
	descMisses   = desc("redis_pool_misses_total", "Times no free connection was found in the pool.")
	descTimeouts = desc("redis_pool_timeouts_total", "Times waiting for a connection timed out.")
	descWaits    = desc("redis_pool_waits_total", "Times a caller had to wait for a connection.")
	descWaitSec  = desc("redis_pool_wait_seconds_total", "Total time spent waiting for a connection.")
	descTotal    = desc("redis_pool_total_conns", "Open connections.")
	descIdle     = desc("redis_pool_idle_conns", "Idle connections.")
	descStale    = desc("redis_pool_stale_conns_total", "Stale connections removed from the pool.")
	descPending  = desc("redis_pool_pending_requests", "Callers currently waiting for a connection.")
)

type poolCollector struct {
	mu      sync.Mutex
	clients map[string]*goredis.Client
}

func (p *poolCollector) Describe(ch chan<- *prometheus.Desc) {
	for _, d := range []*prometheus.Desc{descHits, descMisses, descTimeouts, descWaits, descWaitSec,
		descTotal, descIdle, descStale, descPending} {
		ch <- d
	}
}

func (p *poolCollector) Collect(ch chan<- prometheus.Metric) {
	p.mu.Lock()
	defer p.mu.Unlock()
	for name, c := range p.clients {
		collect(ch, name, c.PoolStats())
	}
}

func collect(ch chan<- prometheus.Metric, name string, s *goredis.PoolStats) {
	emit := func(d *prometheus.Desc, t prometheus.ValueType, v float64) {
		ch <- prometheus.MustNewConstMetric(d, t, v, name)
	}
	emit(descHits, prometheus.CounterValue, float64(s.Hits))
	emit(descMisses, prometheus.CounterValue, float64(s.Misses))
	emit(descTimeouts, prometheus.CounterValue, float64(s.Timeouts))
	emit(descWaits, prometheus.CounterValue, float64(s.WaitCount))
	emit(descWaitSec, prometheus.CounterValue, float64(s.WaitDurationNs)/1e9)
	emit(descTotal, prometheus.GaugeValue, float64(s.TotalConns))
	emit(descIdle, prometheus.GaugeValue, float64(s.IdleConns))
	emit(descStale, prometheus.CounterValue, float64(s.StaleConns))
	emit(descPending, prometheus.GaugeValue, float64(s.PendingRequests))
}
