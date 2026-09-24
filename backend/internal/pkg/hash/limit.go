package hash

import (
	"context"
	"runtime"
	gotime "time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// Each argon2id hash takes 19 MiB and a core for ~20-50 ms. Without a bound, a burst of
// sign-ins (or a password-guessing flood) runs them all at once: memory spikes and every
// other request waits for CPU. At most GOMAXPROCS×2 hashes run at a time (TZ BE-12); the
// rest queue until a slot frees or their request's deadline passes. GOMAXPROCS follows the
// container's CPU quota.
var slots = make(chan struct{}, max(runtime.GOMAXPROCS(0)*2, 2))

var (
	hashWait = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "password_hash_wait_seconds",
		Help:    "Time a password hash waited for a free slot (argon2 concurrency limit).",
		Buckets: []float64{.0001, .001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5},
	})
	hashInFlight = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "password_hash_in_flight",
		Help: "Password hashes (argon2id) running now.",
	})
)

// acquire takes a hashing slot, or gives up when ctx ends.
func acquire(ctx context.Context) (release func(), err error) {
	start := gotime.Now()
	select {
	case slots <- struct{}{}:
	case <-ctx.Done():
		hashWait.Observe(gotime.Since(start).Seconds())
		return nil, ctx.Err()
	}
	hashWait.Observe(gotime.Since(start).Seconds())
	hashInFlight.Inc()
	return func() {
		hashInFlight.Dec()
		<-slots
	}, nil
}

// Slots is the concurrency limit (for tests and diagnostics).
func Slots() int { return cap(slots) }
