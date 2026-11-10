// Package errtrack sends error-level log records to Sentry when SENTRY_DSN is set.
//
// Hooking in at the logger means every place that already logs an unexpected failure
// (unhandled API errors, recovered panics, failing jobs) is reported, with nothing else to
// wire. Only the log message and its attributes go out, never request bodies, headers or
// cookies; attributes that could hold secrets or personal data are dropped.
package errtrack

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/getsentry/sentry-go"
)

type Config struct {
	DSN         string
	Environment string
	Release     string
	ServerName  string // api | worker

	transport sentry.Transport // tests
}

// Init starts the Sentry client; with an empty DSN it does nothing. The returned function
// flushes queued events and should be deferred.
func Init(c Config) (enabled bool, flush func(), err error) {
	if c.DSN == "" {
		return false, func() {}, nil
	}
	err = sentry.Init(sentry.ClientOptions{
		Dsn:            c.DSN,
		Environment:    c.Environment,
		Release:        c.Release,
		ServerName:     c.ServerName,
		SendDefaultPII: false,
		Transport:      c.transport,
		BeforeSend: func(e *sentry.Event, _ *sentry.EventHint) *sentry.Event {
			e.Request = nil // never attach request data
			e.User = sentry.User{}
			return e
		},
	})
	if err != nil {
		return false, func() {}, err
	}
	return true, func() { sentry.Flush(3 * time.Second) }, nil
}

// Wrap returns a handler that logs through next and reports Error records to Sentry.
func Wrap(next slog.Handler) slog.Handler { return &handler{next: next} }

type handler struct {
	next  slog.Handler
	attrs []slog.Attr
	group string
}

func (h *handler) Enabled(ctx context.Context, l slog.Level) bool { return h.next.Enabled(ctx, l) }

func (h *handler) Handle(ctx context.Context, r slog.Record) error {
	if r.Level >= slog.LevelError {
		h.capture(r)
	}
	return h.next.Handle(ctx, r)
}

func (h *handler) WithAttrs(as []slog.Attr) slog.Handler {
	return &handler{next: h.next.WithAttrs(as), attrs: append(append([]slog.Attr{}, h.attrs...), as...), group: h.group}
}

func (h *handler) WithGroup(name string) slog.Handler {
	return &handler{next: h.next.WithGroup(name), attrs: h.attrs, group: name}
}

// sensitive attribute keys (substring match) that are never sent.
var sensitive = []string{"password", "token", "secret", "authorization", "cookie", "email", "phone", "code", "otp", "text", "html", "body"}

func dropped(key string) bool {
	k := strings.ToLower(key)
	for _, s := range sensitive {
		if strings.Contains(k, s) {
			return true
		}
	}
	return false
}

func (h *handler) capture(r slog.Record) {
	hub := sentry.CurrentHub()
	if hub.Client() == nil {
		return
	}
	extra := map[string]any{}
	var cause error
	add := func(a slog.Attr) bool {
		if err, ok := a.Value.Any().(error); ok && cause == nil {
			cause = err
		}
		if !dropped(a.Key) {
			extra[a.Key] = a.Value.String()
		}
		return true
	}
	for _, a := range h.attrs {
		add(a)
	}
	r.Attrs(add)
	hub.WithScope(func(s *sentry.Scope) {
		s.SetLevel(sentry.LevelError)
		s.SetContext("log", extra)
		if id, ok := extra["request_id"].(string); ok {
			s.SetTag("request_id", id)
		}
		if cause != nil {
			hub.CaptureException(fmt.Errorf("%s: %w", r.Message, cause))
		} else {
			hub.CaptureMessage(r.Message)
		}
	})
}
