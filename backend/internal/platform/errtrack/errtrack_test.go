package errtrack

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
)

func TestDroppedKeys(t *testing.T) {
	for _, k := range []string{"password", "refresh_token", "Authorization", "email", "dev_code", "phone"} {
		if !dropped(k) {
			t.Errorf("%s should be dropped", k)
		}
	}
	for _, k := range []string{"err", "request_id", "path", "method", "status", "job"} {
		if dropped(k) {
			t.Errorf("%s should be kept", k)
		}
	}
}

type memTransport struct{ events []*sentry.Event }

func (m *memTransport) Flush(time.Duration) bool              { return true }
func (m *memTransport) FlushWithContext(context.Context) bool { return true }
func (m *memTransport) Configure(sentry.ClientOptions)        {}
func (m *memTransport) SendEvent(e *sentry.Event)             { m.events = append(m.events, e) }
func (m *memTransport) Close()                                {}

func TestReportsErrorsWithoutSecrets(t *testing.T) {
	tr := &memTransport{}
	on, flush, err := Init(Config{DSN: "https://key@o0.ingest.sentry.io/1", Environment: "test", transport: tr})
	if err != nil || !on {
		t.Fatalf("init: %v %v", on, err)
	}
	defer flush()
	log := slog.New(Wrap(slog.NewTextHandler(io.Discard, nil)))
	log.Info("fine", "x", 1)
	log.Error("unhandled error", "err", errors.New("db down"), "request_id", "r1", "password", "hunter2", "email", "a@b.uz")
	if len(tr.events) != 1 {
		t.Fatalf("events: %d", len(tr.events))
	}
	e := tr.events[0]
	got := fmt.Sprint(e.Contexts["log"])
	if strings.Contains(got, "hunter2") || strings.Contains(got, "a@b.uz") {
		t.Fatalf("secret leaked: %s", got)
	}
	if e.Tags["request_id"] != "r1" || len(e.Exception) == 0 || !strings.Contains(e.Exception[len(e.Exception)-1].Value, "db down") {
		t.Fatalf("unexpected event: tags=%v exc=%+v", e.Tags, e.Exception)
	}
}
