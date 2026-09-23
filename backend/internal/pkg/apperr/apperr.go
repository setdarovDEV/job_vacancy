// Package apperr defines errors that are safe to show to API clients.
// Code is a stable machine-readable key (clients translate it into uz/ru/en);
// Message is an English fallback for logs and developers.
package apperr

import (
	"errors"
	"net/http"
)

type Error struct {
	Status  int               `json:"-"`
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
	// RetryAfter is set for rate-limit errors (seconds).
	RetryAfter int `json:"retry_after,omitempty"`
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

func New(status int, code, msg string) *Error {
	return &Error{Status: status, Code: code, Message: msg}
}

func BadRequest(code, msg string) *Error { return New(http.StatusBadRequest, code, msg) }
func Unauthorized(code, msg string) *Error {
	return New(http.StatusUnauthorized, code, msg)
}
func Forbidden(code, msg string) *Error { return New(http.StatusForbidden, code, msg) }
func NotFound(code, msg string) *Error  { return New(http.StatusNotFound, code, msg) }
func Conflict(code, msg string) *Error  { return New(http.StatusConflict, code, msg) }

func Validation(fields map[string]string) *Error {
	return &Error{Status: http.StatusUnprocessableEntity, Code: "validation_failed",
		Message: "request validation failed", Fields: fields}
}

func TooManyRequests(retryAfter int) *Error {
	return &Error{Status: http.StatusTooManyRequests, Code: "rate_limited",
		Message: "too many requests, try again later", RetryAfter: retryAfter}
}

var Internal = New(http.StatusInternalServerError, "internal_error", "internal server error")

// As extracts an *Error from err, if there is one.
func As(err error) (*Error, bool) {
	var e *Error
	ok := errors.As(err, &e)
	return e, ok
}
