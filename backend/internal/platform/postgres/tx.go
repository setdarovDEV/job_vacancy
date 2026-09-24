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
	return WithPgxTx(ctx, pool, func(tx pgx.Tx) error { return fn(gen.New(tx)) })
}

// WithPgxTx is WithTx for code that also needs the transaction itself: River's
// InsertManyTx (jobs committed with the change, TZ BE-08) or a pgx.Batch sent in it.
// gen queries on it come from gen.New(tx).
func WithPgxTx(ctx context.Context, pool *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op after a successful commit
	if err := fn(tx); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}
