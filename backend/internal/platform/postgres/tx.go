package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"jobvacancy.uz/backend/db/gen"
)

// WithTx runs fn inside a transaction; it commits when fn returns nil and rolls back otherwise.
func WithTx(ctx context.Context, pool *pgxpool.Pool, fn func(q *gen.Queries) error) error {
	return InTx(ctx, pool, func(_ pgx.Tx, q *gen.Queries) error { return fn(q) })
}

// InTx is WithTx for callers that also need the raw transaction, e.g. to enqueue a River
// job that must commit (or roll back) together with the writes.
func InTx(ctx context.Context, pool *pgxpool.Pool, fn func(tx pgx.Tx, q *gen.Queries) error) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op after a successful commit
	if err := fn(tx, gen.New(pool).WithTx(tx)); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}
