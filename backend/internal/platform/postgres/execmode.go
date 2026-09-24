package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"jobvacancy.uz/backend/db/gen"
)

// PlanPerCall wraps db so every sqlc query runs in QueryExecModeExec: it is planned with
// its actual parameters each time instead of reusing a cached prepared statement, whose
// plan may turn generic. Use it for queries whose best plan depends on the values, above
// all full-text conditions: a generic plan can't see how many rows a tsquery matches and
// then picks the same path for "d:*" (most rows) and "flutter:*" (a handful).
func PlanPerCall(db gen.DBTX) *gen.Queries { return gen.New(execMode{db}) }

type execMode struct{ db gen.DBTX }

func withMode(args []any) []any { return append([]any{pgx.QueryExecModeExec}, args...) }

func (e execMode) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	return e.db.Exec(ctx, sql, withMode(args)...)
}

func (e execMode) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return e.db.Query(ctx, sql, withMode(args)...)
}

func (e execMode) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return e.db.QueryRow(ctx, sql, withMode(args)...)
}
