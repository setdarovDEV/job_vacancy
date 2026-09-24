package vacancy

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/platform/postgres"
)

// ExpiryWarningDays is how long before expiry the author is warned (TZ FN-04).
const ExpiryWarningDays = 3

// warningBatch caps one run of the warning job; the rest wait for the next run.
const warningBatch = 500

// Lifecycle runs the periodic vacancy jobs in the worker: expiry (with the author's
// notification), the "expires soon" warning and the end of "TOP" placements. Each run is
// one transaction, so a notification is stored and queued exactly when its change commits.
type Lifecycle struct {
	Pool   *pgxpool.Pool
	Cache  *PublicCache // nil skips cache invalidation
	Notify *notification.Service
	Log    *slog.Logger
}

// authorNotice groups a run's vacancies by author: one notification per author, naming
// the first vacancy and how many there are in total.
type authorNotice struct {
	userID    uuid.UUID
	firstID   uuid.UUID
	title     string
	expiresAt time.Time
	count     int
}

func groupByAuthor[T any](rows []T, of func(T) (author, id uuid.UUID, title string, expires time.Time)) []notification.Recipient {
	var order []uuid.UUID
	by := map[uuid.UUID]*authorNotice{}
	for _, r := range rows {
		author, id, title, exp := of(r)
		n, ok := by[author]
		if !ok {
			n = &authorNotice{userID: author, firstID: id, title: title, expiresAt: exp}
			by[author] = n
			order = append(order, author)
		}
		n.count++
	}
	out := make([]notification.Recipient, len(order))
	for i, a := range order {
		n := by[a]
		p := notification.Payload{VacancyID: n.firstID.String(), VacancyTitle: n.title, Count: n.count}
		if !n.expiresAt.IsZero() {
			p.ExpiresAt = n.expiresAt.UTC().Format(time.RFC3339)
		}
		out[i] = notification.Recipient{UserID: a, Payload: p}
	}
	return out
}

// Expire moves published vacancies past their expiry date to expired and tells their
// authors, then drops the cached pages.
func (l *Lifecycle) Expire(ctx context.Context) (int, error) {
	var rows []gen.ExpireVacanciesRow
	var sent notification.Sent
	err := postgres.WithPgxTx(ctx, l.Pool, func(tx pgx.Tx) error {
		var err error
		if rows, err = gen.New(tx).ExpireVacancies(ctx); err != nil || len(rows) == 0 || l.Notify == nil {
			return err
		}
		to := groupByAuthor(rows, func(r gen.ExpireVacanciesRow) (uuid.UUID, uuid.UUID, string, time.Time) {
			return r.CreatedBy, r.ID, r.Title, time.Time{}
		})
		sent, err = l.Notify.NotifyTx(ctx, tx, notification.TypeVacancyExpired, to, true)
		return err
	})
	if err != nil || len(rows) == 0 {
		return 0, err
	}
	sent.Publish(ctx)
	refs := make([]VacancyRef, len(rows))
	for i, r := range rows {
		refs[i] = VacancyRef{ID: r.ID, Slug: r.Slug, CompanyID: r.CompanyID, CompanySlug: r.CompanySlug}
	}
	l.Cache.VacanciesChanged(ctx, refs...)
	return len(rows), nil
}

// WarnExpiring tells authors whose vacancies expire within ExpiryWarningDays, once per
// expiry date (republishing sets a new date, which gets its own warning).
func (l *Lifecycle) WarnExpiring(ctx context.Context) (int, error) {
	var n int
	var sent notification.Sent
	err := postgres.WithPgxTx(ctx, l.Pool, func(tx pgx.Tx) error {
		q := gen.New(tx)
		rows, err := q.DueExpiryWarnings(ctx, gen.DueExpiryWarningsParams{Days: ExpiryWarningDays, MaxResults: warningBatch})
		if err != nil || len(rows) == 0 {
			return err
		}
		n = len(rows)
		ids := make([]uuid.UUID, n)
		expires := make([]time.Time, n)
		for i, r := range rows {
			ids[i] = r.ID
			if r.ExpiresAt != nil {
				expires[i] = *r.ExpiresAt
			}
		}
		if err := q.MarkExpiryWarned(ctx, gen.MarkExpiryWarnedParams{Ids: ids, Expires: expires}); err != nil {
			return err
		}
		if l.Notify == nil {
			return nil
		}
		to := groupByAuthor(rows, func(r gen.DueExpiryWarningsRow) (uuid.UUID, uuid.UUID, string, time.Time) {
			var exp time.Time
			if r.ExpiresAt != nil {
				exp = *r.ExpiresAt
			}
			return r.CreatedBy, r.ID, r.Title, exp
		})
		sent, err = l.Notify.NotifyTx(ctx, tx, notification.TypeVacancyExpiring, to, true)
		return err
	})
	if err != nil {
		return 0, err
	}
	sent.Publish(ctx)
	return n, nil
}

// EndFeatured removes "TOP" placements whose date passed (TZ FN-01).
func (l *Lifecycle) EndFeatured(ctx context.Context) (int, error) {
	rows, err := gen.New(l.Pool).ExpireFeatured(ctx)
	if err != nil || len(rows) == 0 {
		return 0, err
	}
	refs := make([]VacancyRef, len(rows))
	for i, r := range rows {
		refs[i] = VacancyRef{ID: r.ID, Slug: r.Slug, CompanyID: r.CompanyID, CompanySlug: r.CompanySlug}
	}
	l.Cache.VacanciesChanged(ctx, refs...)
	return len(rows), nil
}
