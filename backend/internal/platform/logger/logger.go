// Package logger builds the process-wide slog logger.
package logger

import (
	"log/slog"
	"os"
	"strings"
)

// Option adjusts the logger built by New.
type Option func(*options)

type options struct{ redact bool }

// WithRedaction masks secrets and personal data in every log line (TZ SEC-09).
func WithRedaction(on bool) Option { return func(o *options) { o.redact = on } }

func New(level, format string, opts ...Option) *slog.Logger {
	var o options
	for _, fn := range opts {
		fn(&o)
	}
	var lvl slog.Level
	switch strings.ToLower(level) {
	case "debug":
		lvl = slog.LevelDebug
	case "warn":
		lvl = slog.LevelWarn
	case "error":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}
	ho := &slog.HandlerOptions{Level: lvl}

	var h slog.Handler
	if format == "json" {
		h = slog.NewJSONHandler(os.Stdout, ho)
	} else {
		h = slog.NewTextHandler(os.Stdout, ho)
	}
	if o.redact {
		h = NewRedactHandler(h)
	}
	l := slog.New(h)
	slog.SetDefault(l)
	return l
}
