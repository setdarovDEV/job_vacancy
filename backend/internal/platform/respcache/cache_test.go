package respcache

import (
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

type clock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *clock) Now() time.Time { c.mu.Lock(); defer c.mu.Unlock(); return c.t }
func (c *clock) Add(d time.Duration) {
	c.mu.Lock()
	c.t = c.t.Add(d)
	c.mu.Unlock()
}

func newCache(t *testing.T, mr *miniredis.Miniredis, name string, clk *clock) *Cache {
	t.Helper()
	if mr == nil {
		mr = miniredis.RunT(t)
	}
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	c := &Cache{RDB: rdb, Log: slog.New(slog.NewTextHandler(io.Discard, nil)), Name: name,
		TTL: 30 * time.Second, Stale: time.Minute}
	if clk != nil {
		c.now = clk.Now
	}
	return c
}

func gunzip(t *testing.T, b []byte) string {
	t.Helper()
	zr, err := gzip.NewReader(bytes.NewReader(b))
	if err != nil {
		t.Fatal(err)
	}
	out, err := io.ReadAll(zr)
	if err != nil {
		t.Fatal(err)
	}
	return string(out)
}

func counting(body string, calls *atomic.Int32) Loader {
	return func(context.Context) (Loaded, error) {
		calls.Add(1)
		return Loaded{Body: []byte(body), Meta: []byte("m")}, nil
	}
}

// waitFor polls cond (background refreshes run in goroutines).
func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	for i := 0; i < 200; i++ {
		if cond() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", what)
}

func TestMissThenHit(t *testing.T) {
	c := newCache(t, nil, "t", nil)
	ctx := context.Background()
	var calls atomic.Int32
	e1, st, err := c.Get(ctx, "k", counting(`{"data":1}`, &calls))
	if err != nil || st != Miss {
		t.Fatalf("first get: %v %v", st, err)
	}
	e2, st, err := c.Get(ctx, "k", counting(`{"data":2}`, &calls))
	if err != nil || st != Hit {
		t.Fatalf("second get: %v %v", st, err)
	}
	if calls.Load() != 1 {
		t.Fatalf("loader ran %d times, want 1", calls.Load())
	}
	if e1.ETag != e2.ETag || gunzip(t, e2.Gzip) != `{"data":1}` || string(e2.Meta) != "m" {
		t.Fatalf("hit returned %q etag %s meta %q", gunzip(t, e2.Gzip), e2.ETag, e2.Meta)
	}
}

func TestStaleWhileRevalidate(t *testing.T) {
	clk := &clock{t: time.Now()}
	c := newCache(t, nil, "t", clk)
	ctx := context.Background()
	var calls atomic.Int32
	if _, _, err := c.Get(ctx, "k", counting("v1", &calls)); err != nil {
		t.Fatal(err)
	}
	clk.Add(40 * time.Second) // past TTL+20%, inside the stale window

	e, st, err := c.Get(ctx, "k", counting("v2", &calls))
	if err != nil || st != Stale || gunzip(t, e.Gzip) != "v1" {
		t.Fatalf("stale get: %v %v %q", st, err, gunzip(t, e.Gzip))
	}
	waitFor(t, "background refresh", func() bool {
		e, _ := c.Peek(ctx, "k")
		return e != nil && gunzip(t, e.Gzip) == "v2"
	})
	e, st, _ = c.Get(ctx, "k", counting("v3", &calls))
	if st != Hit || gunzip(t, e.Gzip) != "v2" || calls.Load() != 2 {
		t.Fatalf("after refresh: %v %q calls=%d", st, gunzip(t, e.Gzip), calls.Load())
	}
}

// TZ BE-05: with several API instances only one refreshes a stale entry.
func TestOnlyOneInstanceRefreshes(t *testing.T) {
	mr := miniredis.RunT(t)
	clk := &clock{t: time.Now()}
	a, b := newCache(t, mr, "t", clk), newCache(t, mr, "t", clk)
	ctx := context.Background()
	var calls atomic.Int32
	if _, _, err := a.Get(ctx, "k", counting("v1", &calls)); err != nil {
		t.Fatal(err)
	}
	clk.Add(40 * time.Second)

	release := make(chan struct{})
	slow := func(context.Context) (Loaded, error) {
		calls.Add(1)
		<-release
		return Loaded{Body: []byte("v2")}, nil
	}
	for i := 0; i < 5; i++ {
		for _, c := range []*Cache{a, b} {
			if _, st, err := c.Get(ctx, "k", slow); err != nil || st != Stale {
				t.Fatalf("get during refresh: %v %v", st, err)
			}
		}
	}
	close(release)
	waitFor(t, "refresh", func() bool {
		e, _ := a.Peek(ctx, "k")
		return e != nil && gunzip(t, e.Gzip) == "v2"
	})
	time.Sleep(20 * time.Millisecond)
	if n := calls.Load(); n != 2 { // initial fill + exactly one refresh
		t.Fatalf("loader ran %d times, want 2", n)
	}
}

// A refresh lock left by a dead instance expires; meanwhile the stale entry is served.
func TestStaleServedWhileAnotherInstanceHoldsLock(t *testing.T) {
	clk := &clock{t: time.Now()}
	c := newCache(t, nil, "t", clk)
	ctx := context.Background()
	var calls atomic.Int32
	_, _, _ = c.Get(ctx, "k", counting("v1", &calls))
	clk.Add(40 * time.Second)
	if ok, _ := c.RDB.SetNX(ctx, c.lockKey("k"), "other", time.Minute).Result(); !ok {
		t.Fatal("setup lock")
	}
	for range 3 {
		if e, st, _ := c.Get(ctx, "k", counting("v2", &calls)); st != Stale || gunzip(t, e.Gzip) != "v1" {
			t.Fatalf("got %v %q", st, gunzip(t, e.Gzip))
		}
	}
	time.Sleep(20 * time.Millisecond)
	if calls.Load() != 1 {
		t.Fatalf("refreshed despite the other instance's lock: %d loads", calls.Load())
	}
	if v, _ := c.RDB.Get(ctx, c.lockKey("k")).Result(); v != "other" {
		t.Fatalf("someone else's lock was touched: %q", v)
	}
}

// The store releases the refresh lock in the same round trip.
func TestRefreshReleasesLock(t *testing.T) {
	clk := &clock{t: time.Now()}
	c := newCache(t, nil, "t", clk)
	ctx := context.Background()
	var calls atomic.Int32
	_, _, _ = c.Get(ctx, "k", counting("v1", &calls))
	clk.Add(40 * time.Second)
	_, _, _ = c.Get(ctx, "k", counting("v2", &calls))
	waitFor(t, "refresh", func() bool {
		e, _ := c.Peek(ctx, "k")
		return e != nil && gunzip(t, e.Gzip) == "v2"
	})
	waitFor(t, "lock release", func() bool { return c.RDB.Exists(ctx, c.lockKey("k")).Val() == 0 })
}

func TestGenerationBumpMarksStale(t *testing.T) {
	c := newCache(t, nil, "t", nil)
	c.Gen = &Generation{RDB: c.RDB, Key: "rcgen:test"}
	ctx := context.Background()
	var calls atomic.Int32
	if _, _, err := c.Get(ctx, "k", counting("v1", &calls)); err != nil {
		t.Fatal(err)
	}
	if _, st, _ := c.Get(ctx, "k", counting("v1", &calls)); st != Hit {
		t.Fatalf("before bump: %v", st)
	}
	if err := c.Gen.Bump(ctx); err != nil {
		t.Fatal(err)
	}
	if _, st, _ := c.Get(ctx, "k", counting("v2", &calls)); st != Stale {
		t.Fatalf("after bump: %v, want STALE", st)
	}
	waitFor(t, "refresh after bump", func() bool {
		_, st, _ := c.Get(ctx, "k", counting("v3", &calls))
		return st == Hit
	})
}

func TestInvalidate(t *testing.T) {
	c := newCache(t, nil, "t", nil)
	ctx := context.Background()
	var calls atomic.Int32
	_, _, _ = c.Get(ctx, "k", counting("v1", &calls))
	if err := c.Invalidate(ctx, "k", "never-cached"); err != nil {
		t.Fatal(err)
	}
	e, st, err := c.Get(ctx, "k", counting("v2", &calls))
	if err != nil || st != Miss || gunzip(t, e.Gzip) != "v2" {
		t.Fatalf("after invalidate: %v %v %q", st, err, gunzip(t, e.Gzip))
	}
}

// A load that started before a write must not store its outdated result after the
// write invalidated the key.
func TestInvalidateDuringLoadDropsResult(t *testing.T) {
	c := newCache(t, nil, "t", nil)
	ctx := context.Background()
	started, release := make(chan struct{}), make(chan struct{})
	go func() {
		<-started
		if err := c.Invalidate(ctx, "k"); err != nil {
			t.Error(err)
		}
		close(release)
	}()
	e, _, err := c.Get(ctx, "k", func(context.Context) (Loaded, error) {
		close(started)
		<-release
		return Loaded{Body: []byte("old")}, nil
	})
	if err != nil || gunzip(t, e.Gzip) != "old" {
		t.Fatalf("caller still gets its result: %v", err)
	}
	if e, _ := c.Peek(ctx, "k"); e != nil {
		t.Fatalf("outdated load was stored: %q", gunzip(t, e.Gzip))
	}
}

// TZ BE-01: the first client disconnecting must not fail the others waiting on the same
// load, and the load runs with its own deadline.
func TestFirstClientCancelDoesNotFailWaiters(t *testing.T) {
	c := newCache(t, nil, "t", nil)
	var calls atomic.Int32
	started, release := make(chan struct{}), make(chan struct{})
	load := func(ctx context.Context) (Loaded, error) {
		if calls.Add(1) == 1 {
			close(started)
		}
		select {
		case <-release:
		case <-ctx.Done():
			return Loaded{}, ctx.Err()
		}
		if _, ok := ctx.Deadline(); !ok {
			return Loaded{}, errors.New("loader context has no deadline")
		}
		return Loaded{Body: []byte("ok")}, nil
	}
	firstCtx, cancelFirst := context.WithCancel(context.Background())
	firstErr := make(chan error, 1)
	go func() { _, _, err := c.Get(firstCtx, "k", load); firstErr <- err }()
	<-started

	var wg sync.WaitGroup
	errs := make([]error, 3)
	for i := range errs {
		wg.Add(1)
		go func() { defer wg.Done(); _, _, errs[i] = c.Get(context.Background(), "k", load) }()
	}
	time.Sleep(20 * time.Millisecond)
	cancelFirst()
	if err := <-firstErr; !errors.Is(err, context.Canceled) {
		t.Fatalf("first caller: %v, want context.Canceled", err)
	}
	close(release)
	wg.Wait()
	for i, err := range errs {
		if err != nil {
			t.Fatalf("waiter %d failed: %v", i, err)
		}
	}
	if calls.Load() != 1 {
		t.Fatalf("loader ran %d times, want 1", calls.Load())
	}
	if e, _ := c.Peek(context.Background(), "k"); e == nil {
		t.Fatal("result was not cached")
	}
}

func TestLoaderErrorNotCached(t *testing.T) {
	c := newCache(t, nil, "t", nil)
	ctx := context.Background()
	boom := errors.New("boom")
	if _, _, err := c.Get(ctx, "k", func(context.Context) (Loaded, error) { return Loaded{}, boom }); !errors.Is(err, boom) {
		t.Fatalf("err = %v", err)
	}
	if e, _ := c.Peek(ctx, "k"); e != nil {
		t.Fatal("error result cached")
	}
}

func TestRedisDownServesUncached(t *testing.T) {
	mr := miniredis.RunT(t)
	c := newCache(t, mr, "t", nil)
	mr.Close()
	var calls atomic.Int32
	e, st, err := c.Get(context.Background(), "k", counting("live", &calls))
	if err != nil || st != Miss || gunzip(t, e.Gzip) != "live" {
		t.Fatalf("redis down: %v %v", st, err)
	}
}

func TestJitterWithinTwentyPercent(t *testing.T) {
	for range 1000 {
		d := jittered(100 * time.Second)
		if d < 80*time.Second || d > 120*time.Second {
			t.Fatalf("jittered TTL %v outside ±20%%", d)
		}
	}
}

func TestEntryRoundTrip(t *testing.T) {
	in := &Entry{ETag: `W/"abc"`, Gzip: []byte{1, 2, 3}, Meta: []byte("meta"), Gen: 7,
		FreshUntil: time.UnixMilli(1_700_000_000_123)}
	out, err := decode(in.encode())
	if err != nil || out.ETag != in.ETag || string(out.Gzip) != string(in.Gzip) ||
		string(out.Meta) != "meta" || out.Gen != 7 || !out.FreshUntil.Equal(in.FreshUntil) {
		t.Fatalf("round trip: %+v %v", out, err)
	}
	if _, err := decode([]byte("garbage")); err == nil {
		t.Fatal("garbage decoded")
	}
}

func TestServe(t *testing.T) {
	c := newCache(t, nil, "t", nil)
	var calls atomic.Int32
	e, st, _ := c.Get(context.Background(), "k", counting(`{"data":"hello"}`, &calls))

	// gzip client gets the stored bytes as they are
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Accept-Encoding", "gzip, deflate, br")
	c.Serve(rec, req, e, st, "public, max-age=60")
	if rec.Code != 200 || rec.Header().Get("Content-Encoding") != "gzip" || !bytes.Equal(rec.Body.Bytes(), e.Gzip) {
		t.Fatalf("gzip client: %d %q", rec.Code, rec.Header().Get("Content-Encoding"))
	}
	if rec.Header().Get("ETag") != e.ETag || rec.Header().Get("Cache-Control") != "public, max-age=60" ||
		rec.Header().Get("X-Cache") != "MISS" || rec.Header().Get("Vary") != "Accept-Encoding" {
		t.Fatalf("headers: %v", rec.Header())
	}

	// plain client
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	c.Serve(rec, req, e, Hit, "public, max-age=60")
	if rec.Body.String() != `{"data":"hello"}` || rec.Header().Get("Content-Encoding") != "" {
		t.Fatalf("plain client: %q", rec.Body.String())
	}

	// revalidation
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("If-None-Match", `"zzz", `+e.ETag)
	c.Serve(rec, req, e, Hit, "public, max-age=60")
	if rec.Code != http.StatusNotModified || rec.Body.Len() != 0 {
		t.Fatalf("If-None-Match: %d len=%d", rec.Code, rec.Body.Len())
	}
}

func TestHeaderParsing(t *testing.T) {
	for h, want := range map[string]bool{
		"gzip": true, "deflate, gzip;q=0.5": true, "GZIP": true, "*": true,
		"": false, "br": false, "gzip;q=0": false, "gzip; q=0.0": false, "identity": false,
	} {
		if got := AcceptsGzip(h); got != want {
			t.Errorf("AcceptsGzip(%q) = %v", h, got)
		}
	}
	etag := `W/"abc"`
	for h, want := range map[string]bool{
		`W/"abc"`: true, `"abc"`: true, `"x", W/"abc"`: true, "*": true, `"abcd"`: false, "": false,
	} {
		if got := NoneMatch(h, etag); got != want {
			t.Errorf("NoneMatch(%q) = %v", h, got)
		}
	}
}
