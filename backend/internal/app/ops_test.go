package app

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type fakeRiver struct {
	runFor           time.Duration // how long running jobs keep going
	stopped, aborted bool
}

func (f *fakeRiver) Stop(ctx context.Context) error {
	select {
	case <-time.After(f.runFor):
		f.stopped = true
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (f *fakeRiver) StopAndCancel(context.Context) error { f.aborted = true; return nil }

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

func TestStopWorkerGraceful(t *testing.T) {
	f := &fakeRiver{runFor: 10 * time.Millisecond}
	if err := stopWorker(f, time.Second, quiet); err != nil || !f.stopped || f.aborted {
		t.Fatalf("err=%v stopped=%v aborted=%v", err, f.stopped, f.aborted)
	}
}

func TestStopWorkerCancelsAfterTimeout(t *testing.T) {
	f := &fakeRiver{runFor: time.Hour}
	start := time.Now()
	if err := stopWorker(f, 30*time.Millisecond, quiet); err != nil || !f.aborted {
		t.Fatalf("err=%v aborted=%v", err, f.aborted)
	}
	if time.Since(start) > time.Second {
		t.Fatal("shutdown did not respect its timeout")
	}
}

func TestHealthcheck(t *testing.T) {
	status := http.StatusOK
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/readyz" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.WriteHeader(status)
	}))
	defer srv.Close()
	t.Setenv("APP_ENV", "production") // don't read a stray .env
	t.Setenv("TEST_HC_ADDR", strings.TrimPrefix(srv.URL, "http://"))
	if code := Healthcheck("TEST_HC_ADDR", "", "/readyz"); code != 0 {
		t.Fatalf("healthy server: exit %d", code)
	}
	status = http.StatusServiceUnavailable
	if code := Healthcheck("TEST_HC_ADDR", "", "/readyz"); code != 1 {
		t.Fatalf("unready server: exit %d", code)
	}
	srv.Close()
	if code := Healthcheck("TEST_HC_ADDR", "", "/readyz"); code != 1 {
		t.Fatalf("server down: exit %d", code)
	}
}

func TestLoopback(t *testing.T) {
	for in, want := range map[string]string{
		":8090": "127.0.0.1:8090", "0.0.0.0:9092": "127.0.0.1:9092", "[::]:8090": "127.0.0.1:8090",
		"127.0.0.1:9092": "127.0.0.1:9092", "10.0.0.5:8090": "10.0.0.5:8090",
	} {
		if got := loopback(in); got != want {
			t.Errorf("loopback(%q) = %q, want %q", in, got, want)
		}
	}
}
