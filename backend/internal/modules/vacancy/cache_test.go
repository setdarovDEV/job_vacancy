package vacancy

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func newTestCache(t *testing.T) (*ListCache, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	return &ListCache{RDB: rdb, TTL: time.Minute, Log: slog.New(slog.NewTextHandler(io.Discard, nil))}, mr
}

// TZ BE-01: the first client disconnecting must not fail the others waiting on the same
// singleflight load.
func TestListCacheFirstClientCancelDoesNotFailWaiters(t *testing.T) {
	c, mr := newTestCache(t)
	f := Filter{Limit: 20, Sort: SortNewest}
	total := 42

	var calls atomic.Int32
	started, release := make(chan struct{}), make(chan struct{})
	load := func(ctx context.Context) (ListResult, error) {
		if calls.Add(1) == 1 {
			close(started)
		}
		select {
		case <-release:
		case <-ctx.Done():
			return ListResult{}, ctx.Err()
		}
		if _, ok := ctx.Deadline(); !ok {
			return ListResult{}, errors.New("loader context has no deadline")
		}
		return ListResult{Total: &total}, nil
	}

	firstCtx, cancelFirst := context.WithCancel(context.Background())
	firstErr := make(chan error, 1)
	go func() {
		_, err := c.Get(firstCtx, f, load)
		firstErr <- err
	}()
	<-started

	const waiters = 3
	var wg sync.WaitGroup
	results := make([]error, waiters)
	for i := range waiters {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			res, err := c.Get(ctx, f, load)
			if err == nil && (res.Total == nil || *res.Total != total) {
				err = errors.New("wrong result")
			}
			results[i] = err
		}()
	}
	time.Sleep(50 * time.Millisecond) // let the waiters join the in-flight load

	cancelFirst() // the first client goes away mid-load
	select {
	case err := <-firstErr:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("first caller: want context.Canceled, got %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("first caller kept waiting after its context was cancelled")
	}

	close(release)
	wg.Wait()
	for i, err := range results {
		if err != nil {
			t.Errorf("waiter %d failed: %v", i, err)
		}
	}
	if n := calls.Load(); n != 1 {
		t.Errorf("load ran %d times, want 1 (singleflight)", n)
	}
	if !mr.Exists(cacheKey(f)) {
		t.Error("result of the detached load was not cached")
	}
}

func TestListCacheLoadHasItsOwnTimeout(t *testing.T) {
	c, _ := newTestCache(t)
	c.LoadTimeout = 50 * time.Millisecond
	start := time.Now()
	_, err := c.Get(context.Background(), Filter{Limit: 5}, func(ctx context.Context) (ListResult, error) {
		<-ctx.Done() // a hung query
		return ListResult{}, ctx.Err()
	})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("want DeadlineExceeded, got %v", err)
	}
	if time.Since(start) > time.Second {
		t.Fatalf("load was not bounded by LoadTimeout (took %v)", time.Since(start))
	}
}

func TestListCacheServesFromRedis(t *testing.T) {
	c, _ := newTestCache(t)
	total := 7
	var calls atomic.Int32
	load := func(context.Context) (ListResult, error) {
		calls.Add(1)
		return ListResult{Total: &total}, nil
	}
	for range 3 {
		if _, err := c.Get(context.Background(), Filter{Limit: 10}, load); err != nil {
			t.Fatal(err)
		}
	}
	if calls.Load() != 1 {
		t.Fatalf("load ran %d times, want 1", calls.Load())
	}
}
