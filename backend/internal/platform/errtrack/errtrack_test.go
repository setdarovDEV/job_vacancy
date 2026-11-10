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

func TestAllowList(t *testing.T) {
	for _, k := range []string{"password", "refresh_token", "Authorization", "email", "ip", "user_id", "phone", "body"} {
		if sent(k) {
			t.Errorf("%s must not be sent", k)
		}
	}
	for _, k := range []string{"err", "request_id", "path", "method", "status", "job", "http.status"} {
		if !sent(k) {
			t.Errorf("%s should be sent", k)
		}
	}
}

func TestScrub(t *testing.T) {
	got := scrub("user a.b+c@mail.uz from 84.54.70.10 phone +998 90 123-45-67")
	if strings.Contains(got, "@mail.uz") || strings.Contains(got, "84.54") || strings.Contains(got, "123-45") {
		t.Fatalf("not scrubbed: %s", got)
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
	log.WithGroup("http").Error("unhandled error", "err", errors.New("db down for a@b.uz"), "request_id", "r1", "password", "hunter2", "email", "a@b.uz")
	if len(tr.events) != 1 {
		t.Fatalf("events: %d", len(tr.events))
	}
	e := tr.events[0]
	got := fmt.Sprint(e.Contexts["log"])
	if strings.Contains(got, "hunter2") || strings.Contains(got, "a@b.uz") {
		t.Fatalf("secret leaked: %s", got)
	}
	exc := e.Exception[len(e.Exception)-1]
	if strings.Contains(exc.Value, "a@b.uz") || exc.Type != "*errors.errorString" {
		t.Fatalf("exception not scrubbed: %+v", exc)
	}
	if e.Tags["request_id"] != "r1" || got == "" || !strings.Contains(fmt.Sprint(e.Contexts["log"]["http.request_id"]), "r1") || !strings.Contains(exc.Value, "db down") {
		t.Fatalf("unexpected event: tags=%v exc=%+v", e.Tags, e.Exception)
	}
}
