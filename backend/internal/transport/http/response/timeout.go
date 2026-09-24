package response

import (
	"context"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5/pgconn"
)

// StatusClientClosed is logged when the client went away before the response (nginx 499).
const StatusClientClosed = 499

// isClientGone reports a request abandoned by its client (not by our own deadline).
func isClientGone(r *http.Request, err error) bool {
	return errors.Is(err, context.Canceled) && errors.Is(r.Context().Err(), context.Canceled)
}

// isTimeout reports the request deadline (TZ BE-01) or a Postgres statement/lock timeout.
func isTimeout(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var pg *pgconn.PgError
	if errors.As(err, &pg) {
		// 57014 query_canceled (statement_timeout), 55P03 lock_not_available (lock_timeout)
		return pg.Code == "57014" || pg.Code == "55P03"
	}
	return false
}
