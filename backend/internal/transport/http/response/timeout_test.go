package response

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func errorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body struct {
		Error struct{ Code string } `json:"error"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	return body.Error.Code
}

func TestErrorMapsTimeouts(t *testing.T) {
	for name, err := range map[string]error{
		"request deadline":  fmt.Errorf("list: %w", context.DeadlineExceeded),
		"statement_timeout": fmt.Errorf("query: %w", &pgconn.PgError{Code: "57014", Message: "canceling statement due to statement timeout"}),
		"lock_timeout":      &pgconn.PgError{Code: "55P03"},
	} {
		t.Run(name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			Error(rec, httptest.NewRequest(http.MethodGet, "/api/v1/vacancies", nil), err)
			if rec.Code != http.StatusServiceUnavailable || errorCode(t, rec) != "timeout" || rec.Header().Get("Retry-After") != "1" {
				t.Fatalf("got %d %q retry-after=%q", rec.Code, errorCode(t, rec), rec.Header().Get("Retry-After"))
			}
		})
	}
}

func TestErrorClientGone(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/vacancies", nil).WithContext(ctx)
	rec := httptest.NewRecorder()
	Error(rec, req, fmt.Errorf("query: %w", context.Canceled))
	if rec.Code != StatusClientClosed || rec.Body.Len() != 0 {
		t.Fatalf("got %d with body %q, want a bare 499", rec.Code, rec.Body.String())
	}
}

func TestErrorOtherStillInternal(t *testing.T) {
	rec := httptest.NewRecorder()
	Error(rec, httptest.NewRequest(http.MethodGet, "/", nil), errors.New("boom"))
	if rec.Code != http.StatusInternalServerError || errorCode(t, rec) != "internal_error" {
		t.Fatalf("got %d %q", rec.Code, errorCode(t, rec))
	}
}
