package admin

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

// MaxStatsDays bounds the daily series.
const MaxStatsDays = 90

// Stats returns the dashboard totals and new registrations, vacancies and applications
// per day for the last days days (Asia/Tashkent).
//
// The daily series aggregates a month of rows, which makes its estimated cost cross
// jit_above_cost: JIT compilation then costs more than the query (measured on 196k
// applications: 530-670 ms with JIT, 133-140 ms without), so it is turned off for this
// read-only transaction.
func (s *Service) Stats(ctx context.Context, days int) (Stats, error) {
	var out Stats
	err := postgres.WithPgxTx(ctx, s.Pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, "SET LOCAL jit = off"); err != nil {
			return err
		}
		q := gen.New(tx)
		t, err := q.AdminTotals(ctx)
		if err != nil {
			return err
		}
		rows, err := q.AdminDailyStats(ctx, int32(days))
		if err != nil {
			return err
		}
		out = Stats{Totals: Totals(t), Days: make([]DayStats, len(rows))}
		for i, r := range rows {
			out.Days[i] = DayStats{Date: r.Day.Format("2006-01-02"), Registrations: r.Registrations,
				Vacancies: r.Vacancies, Applications: r.Applications}
		}
		return nil
	})
	return out, err
}

// AuditFilter selects a page of the audit log.
type AuditFilter struct {
	ObjectType *string
	ObjectID   *string
	AdminID    *uuid.UUID
	Before     *uuid.UUID
	Limit      int
}

// AuditLog lists admin actions newest first.
func (s *Service) AuditLog(ctx context.Context, f AuditFilter) ([]AuditEntry, *uuid.UUID, error) {
	rows, err := postgres.PlanPerCall(s.Pool).ListAuditLog(ctx, gen.ListAuditLogParams{
		ObjectType: f.ObjectType, ObjectID: f.ObjectID, AdminID: f.AdminID, BeforeID: f.Before, MaxResults: int32(f.Limit + 1),
	})
	if err != nil {
		return nil, nil, err
	}
	var next *uuid.UUID
	if len(rows) > f.Limit {
		rows = rows[:f.Limit]
		next = &rows[len(rows)-1].ID
	}
	out := make([]AuditEntry, len(rows))
	for i, r := range rows {
		e := AuditEntry{ID: r.ID, Action: r.Action, ObjectType: r.ObjectType, ObjectID: r.ObjectID,
			Details: json.RawMessage(r.Details), CreatedAt: r.CreatedAt}
		if r.Ip != nil {
			ip := r.Ip.String()
			e.IP = &ip
		}
		if r.AdminID != nil {
			e.Admin = &AuditAdmin{ID: *r.AdminID, Email: r.AdminEmail}
			if r.AdminName != nil {
				e.Admin.FullName = *r.AdminName
			}
		}
		out[i] = e
	}
	return out, next, nil
}

func isNoRows(err error) bool { return errors.Is(err, pgx.ErrNoRows) }
