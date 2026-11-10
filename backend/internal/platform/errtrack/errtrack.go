// Package errtrack sends error-level log records to Sentry when SENTRY_DSN is set.
//
// Hooking in at the logger means every place that already logs an unexpected failure
// (unhandled API errors, recovered panics, failing jobs) is reported, with nothing else to
// wire. Only the masked log message, the error's type and masked text, and an allow-list
// of attributes go out: never request bodies, headers, cookies or user data.
package errtrack

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
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
	next   slog.Handler
	attrs  []slog.Attr // already prefixed with their groups
	prefix string      // "group." for attributes added later
}

func (h *handler) Enabled(ctx context.Context, l slog.Level) bool { return h.next.Enabled(ctx, l) }

func (h *handler) Handle(ctx context.Context, r slog.Record) error {
	if r.Level >= slog.LevelError {
		h.capture(r)
	}
	return h.next.Handle(ctx, r)
}

func (h *handler) WithAttrs(as []slog.Attr) slog.Handler {
	attrs := append([]slog.Attr{}, h.attrs...)
	for _, a := range as {
		attrs = append(attrs, slog.Attr{Key: h.prefix + a.Key, Value: a.Value})
	}
	return &handler{next: h.next.WithAttrs(as), attrs: attrs, prefix: h.prefix}
}

func (h *handler) WithGroup(name string) slog.Handler {
	if name == "" {
		return h
	}
	return &handler{next: h.next.WithGroup(name), attrs: h.attrs, prefix: h.prefix + name + "."}
}

// Only these attributes are sent (matched on the last key segment); everything else, such
// as user input, addresses and ids of people, stays in the local log.
var allowed = map[string]bool{
	"err": true, "error": true, "value": true, "stack": true, "request_id": true, "method": true,
	"path": true, "route": true, "status": true, "job": true, "kind": true, "attempt": true,
	"queue": true, "component": true, "took": true,
}

func sent(key string) bool {
	if i := strings.LastIndexByte(key, '.'); i >= 0 {
		key = key[i+1:]
	}
	return allowed[strings.ToLower(key)]
}

// Error texts can quote input (an address, a phone number); those are masked.
var (
	emailRe = regexp.MustCompile(`[\w.+-]+@[\w-]+(\.[\w-]+)+`)
	phoneRe = regexp.MustCompile(`\+?\d[\d ()-]{7,}\d`)
	ipRe    = regexp.MustCompile(`\b\d{1,3}(\.\d{1,3}){3}\b`)
)

func scrub(s string) string {
	s = emailRe.ReplaceAllString(s, "[email]")
	s = ipRe.ReplaceAllString(s, "[ip]")
	return phoneRe.ReplaceAllString(s, "[number]")
}

// scrubbedError carries the masked message; the event keeps the original error's type.
type scrubbedError struct{ msg string }

func (e scrubbedError) Error() string { return e.msg }

func (h *handler) capture(r slog.Record) {
	hub := sentry.CurrentHub()
	if hub.Client() == nil {
		return
	}
	extra := map[string]any{}
	var cause error
	add := func(a slog.Attr) {
		if err, ok := a.Value.Any().(error); ok && cause == nil {
			cause = err
		}
		if sent(a.Key) {
			extra[a.Key] = scrub(a.Value.String())
		}
	}
	for _, a := range h.attrs {
		add(a)
	}
	r.Attrs(func(a slog.Attr) bool {
		add(slog.Attr{Key: h.prefix + a.Key, Value: a.Value})
		return true
	})
	hub.WithScope(func(s *sentry.Scope) {
		s.SetLevel(sentry.LevelError)
		s.SetContext("log", extra)
		for k, v := range extra {
			if k == "request_id" || strings.HasSuffix(k, ".request_id") {
				s.SetTag("request_id", v.(string))
			}
		}
		msg := scrub(r.Message)
		if cause == nil {
			hub.CaptureMessage(msg)
			return
		}
		ev := hub.Client().EventFromException(scrubbedError{msg: msg + ": " + scrub(cause.Error())}, sentry.LevelError)
		for i := range ev.Exception {
			ev.Exception[i].Type = fmt.Sprintf("%T", cause)
		}
		hub.CaptureEvent(ev)
	})
}
