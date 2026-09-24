// Package response writes the API's JSON envelope:
//
//	success: {"data": ...}            (lists add "meta": {"next_cursor": ...})
//	failure: {"error": {"code": "...", "message": "...", "fields": {...}}}
package response

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/validate"
)

const maxBodyBytes = 1 << 20 // 1 MiB; file uploads go straight to object storage

type envelope struct {
	Data  any           `json:"data,omitempty"`
	Meta  any           `json:"meta,omitempty"`
	Error *apperr.Error `json:"error,omitempty"`
}

func JSON(w http.ResponseWriter, status int, data any) {
	write(w, status, envelope{Data: data})
}

func List(w http.ResponseWriter, data, meta any) {
	write(w, http.StatusOK, envelope{Data: data, Meta: meta})
}

func NoContent(w http.ResponseWriter) { w.WriteHeader(http.StatusNoContent) }

// Encode returns the success envelope exactly as JSON (meta nil) or List would write it,
// for handlers that cache the bytes (package respcache).
func Encode(data, meta any) ([]byte, error) {
	var buf bytes.Buffer
	err := json.NewEncoder(&buf).Encode(envelope{Data: data, Meta: meta})
	return buf.Bytes(), err
}

// Error writes err as an API error. Anything that isn't an *apperr.Error is logged and
// reported as a generic 500 so internals never leak to clients.
func Error(w http.ResponseWriter, r *http.Request, err error) {
	ae, ok := apperr.As(err)
	if !ok {
		switch {
		case isClientGone(r, err):
			// The client disconnected; nobody reads this response. 499 as in nginx.
			slog.DebugContext(r.Context(), "request canceled by client",
				"request_id", reqctx.RequestID(r.Context()), "path", r.URL.Path)
			w.WriteHeader(StatusClientClosed)
			return
		case isTimeout(err):
			slog.WarnContext(r.Context(), "request timed out",
				"err", err, "request_id", reqctx.RequestID(r.Context()),
				"method", r.Method, "path", r.URL.Path)
			ae = apperr.Timeout
		default:
			slog.ErrorContext(r.Context(), "unhandled error",
				"err", err, "request_id", reqctx.RequestID(r.Context()),
				"method", r.Method, "path", r.URL.Path)
			ae = apperr.Internal
		}
	}
	if ae.RetryAfter > 0 {
		w.Header().Set("Retry-After", strconv.Itoa(ae.RetryAfter))
	}
	write(w, ae.Status, envelope{Error: ae})
}

// Decode reads a JSON body into dst.
func Decode(r *http.Request, dst any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, maxBodyBytes))
	if err := dec.Decode(dst); err != nil {
		var mbe *http.MaxBytesError
		switch {
		case errors.As(err, &mbe):
			return apperr.New(http.StatusRequestEntityTooLarge, "body_too_large", "request body too large")
		case errors.Is(err, io.EOF):
			return apperr.BadRequest("empty_body", "request body is empty")
		default:
			return apperr.BadRequest("invalid_json", "request body is not valid JSON")
		}
	}
	return nil
}

func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// DecodeValid decodes and validates a JSON body, writing the error response itself.
// It returns false when the handler should stop.
func DecodeValid(w http.ResponseWriter, r *http.Request, dst any) bool {
	if err := Decode(r, dst); err != nil {
		Error(w, r, err)
		return false
	}
	if err := validate.Struct(dst); err != nil {
		Error(w, r, err)
		return false
	}
	return true
}
