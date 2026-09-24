// Package fixture creates rows for database tests with plain SQL: users, companies,
// memberships, vacancies (with their search rows) and sessions. Every name and e-mail
// carries a random tag, so tests share the database without cleaning up.
package fixture

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"math/rand/v2"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/riverqueue/river"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/testutil/pgtest"
)

type World struct {
	T        testing.TB
	Pool     *pgxpool.Pool
	Q        *gen.Queries
	Tag      string
	Category int32
	Region   int32
	Log      *slog.Logger
	n        atomic.Int64
}

// New returns a world on the migrated test database (or skips the test).
func New(t testing.TB) *World {
	t.Helper()
	pool := pgtest.Pool(t)
	w := &World{T: t, Pool: pool, Q: gen.New(pool), Tag: fmt.Sprintf("fx%08x", rand.Uint32()),
		Log: slog.New(slog.NewTextHandler(io.Discard, nil))}
	ctx := context.Background()
	w.Must(pool.QueryRow(ctx, `SELECT id FROM categories WHERE parent_id IS NOT NULL ORDER BY id LIMIT 1`).Scan(&w.Category))
	w.Must(pool.QueryRow(ctx, `SELECT id FROM regions WHERE parent_id IS NULL ORDER BY id LIMIT 1`).Scan(&w.Region))
	return w
}

func (w *World) Must(err error) {
	w.T.Helper()
	if err != nil {
		w.T.Fatal(err)
	}
}

func (w *World) Exec(sql string, args ...any) {
	w.T.Helper()
	_, err := w.Pool.Exec(context.Background(), sql, args...)
	w.Must(err)
}

// Int reads one integer.
func (w *World) Int(sql string, args ...any) int {
	w.T.Helper()
	var n int
	w.Must(w.Pool.QueryRow(context.Background(), sql, args...).Scan(&n))
	return n
}

func (w *World) next() int64 { return w.n.Add(1) }

// Email is a fresh unique address.
func (w *World) Email() string { return fmt.Sprintf("%s-%d@test.local", w.Tag, w.next()) }

// User inserts an active user; verified sets email_verified_at.
func (w *World) User(role gen.UserRole, verified bool) gen.User {
	w.T.Helper()
	var id uuid.UUID
	w.Must(w.Pool.QueryRow(context.Background(), `INSERT INTO users (email, full_name, role, email_verified_at)
		VALUES ($1, $2, $3, CASE WHEN $4 THEN now() END) RETURNING id`,
		w.Email(), fmt.Sprintf("User %s %d", w.Tag, w.next()), role, verified).Scan(&id))
	u, err := w.Q.GetUserByID(context.Background(), id)
	w.Must(err)
	return u
}

// Company inserts an active company owned by owner, who becomes its owner member.
func (w *World) Company(owner uuid.UUID, verified bool) gen.Company {
	w.T.Helper()
	n := w.next()
	var id uuid.UUID
	w.Must(w.Pool.QueryRow(context.Background(), `INSERT INTO companies (owner_id, name, slug, verified_at)
		VALUES ($1, $2, $3, CASE WHEN $4 THEN now() END) RETURNING id`,
		owner, fmt.Sprintf("Co %s %d", w.Tag, n), fmt.Sprintf("co-%s-%d", w.Tag, n), verified).Scan(&id))
	w.Member(id, owner, "owner")
	c, err := w.Q.GetCompanyByID(context.Background(), id)
	w.Must(err)
	return c
}

// Member adds user to company with role.
func (w *World) Member(company, user uuid.UUID, role string) {
	w.T.Helper()
	w.Exec(`INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, $3)
		ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role`, company, user, role)
}

// Vacancy inserts a vacancy of company by author in status, with its search row (title
// "<tag> vacancy N", searchable by the tag).
func (w *World) Vacancy(company, author uuid.UUID, status gen.VacancyStatus) gen.Vacancy {
	w.T.Helper()
	ctx := context.Background()
	n := w.next()
	title := fmt.Sprintf("%s vacancy %d", w.Tag, n)
	var id uuid.UUID
	w.Must(w.Pool.QueryRow(ctx, `INSERT INTO vacancies (company_id, created_by, title, slug, description,
		category_id, region_id, employment_type, work_format, experience, schedule, status,
		submitted_at, published_at, expires_at)
		VALUES ($1, $2, $3, $4, 'Description of the job.', $5, $6, 'full_time', 'office', 'none', 'full_day',
		        $7::vacancy_status, now() - interval '1 hour',
		        CASE WHEN $7 IN ('published', 'expired', 'archived') THEN now() - interval '30 minutes' END,
		        CASE WHEN $7 IN ('published', 'expired', 'archived') THEN now() + interval '30 days' END)
		RETURNING id`, company, author, title, fmt.Sprintf("v-%s-%d", w.Tag, n), w.Category, w.Region, status).Scan(&id))
	w.Exec(`INSERT INTO vacancy_search (vacancy_id, is_published, published_at, company_id, category_id,
		region_id, employment_type, work_format, experience, schedule, currency, title, tags, company, meta, body)
		SELECT v.id, v.status = 'published', v.published_at, v.company_id, v.category_id, v.region_id,
		       v.employment_type, v.work_format, v.experience, v.schedule, v.currency, lower(v.title), '', '', '', ''
		FROM vacancies v WHERE v.id = $1`, id)
	v, err := w.Q.GetVacancyByID(ctx, id)
	w.Must(err)
	return v
}

// Session inserts a session of user created ago; it returns the principal using it.
func (w *World) Session(u gen.User, ago time.Duration) reqctx.Principal {
	w.T.Helper()
	var id uuid.UUID
	w.Must(w.Pool.QueryRow(context.Background(), `INSERT INTO user_sessions (user_id, refresh_hash, expires_at, created_at)
		VALUES ($1, $2, now() + interval '30 days', now() - $3::interval) RETURNING id`,
		u.ID, []byte(uuid.NewString()), fmt.Sprintf("%d seconds", int(ago.Seconds()))).Scan(&id))
	return reqctx.Principal{UserID: u.ID, SessionID: id, Role: string(u.Role)}
}

// Principal is a signed-in u without a stored session.
func Principal(u gen.User) reqctx.Principal {
	return reqctx.Principal{UserID: u.ID, SessionID: uuid.New(), Role: string(u.Role)}
}

// Redis is a private in-memory Redis.
func Redis(t testing.TB) (*miniredis.Miniredis, *redis.Client) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	return mr, rdb
}

// Jobs records the jobs a service enqueues inside its transaction (it inserts nothing).
type Jobs struct {
	mu   sync.Mutex
	Args []river.JobArgs
}

func (j *Jobs) InsertManyTx(_ context.Context, _ pgx.Tx, args []river.JobArgs) error {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Args = append(j.Args, args...)
	return nil
}

// Kinds lists the recorded job kinds in order.
func (j *Jobs) Kinds() []string {
	j.mu.Lock()
	defer j.mu.Unlock()
	out := make([]string, len(j.Args))
	for i, a := range j.Args {
		out[i] = a.Kind()
	}
	return out
}
