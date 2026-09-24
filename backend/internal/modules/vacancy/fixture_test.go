package vacancy

import (
	"context"
	"io"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/searchq"
	"jobvacancy.uz/backend/internal/testutil/pgtest"
	mw "jobvacancy.uz/backend/internal/transport/http/middleware"
)

// fixture is a vacancy service on the migrated test database with a private miniredis,
// an employer and a verified company (whose vacancies publish without moderation).
type fixture struct {
	t        *testing.T
	pool     *pgxpool.Pool
	q        *gen.Queries
	mr       *miniredis.Miniredis
	rdb      *redis.Client
	svc      *Service
	router   http.Handler
	employer reqctx.Principal
	company  gen.Company
	category int32
	region   int32
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	pool := pgtest.Pool(t)
	ctx := context.Background()
	q := gen.New(pool)
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })

	cat := &catalog.Service{Q: q, Log: log}
	if err := cat.Reload(ctx); err != nil {
		t.Fatal(err)
	}
	f := &fixture{t: t, pool: pool, q: q, mr: mr, rdb: rdb}
	if err := pool.QueryRow(ctx, `SELECT id FROM categories WHERE parent_id IS NOT NULL ORDER BY id LIMIT 1`).Scan(&f.category); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `SELECT id FROM regions WHERE parent_id IS NULL ORDER BY id LIMIT 1`).Scan(&f.region); err != nil {
		t.Fatal(err)
	}

	suffix := randWord(8)
	var userID uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO users (email, full_name, role, email_verified_at)
		VALUES ($1, 'Test Employer', 'employer', now()) RETURNING id`, "emp-"+suffix+"@test.local").Scan(&userID); err != nil {
		t.Fatal(err)
	}
	f.employer = reqctx.Principal{UserID: userID, Role: "employer"}
	row := pool.QueryRow(ctx, `INSERT INTO companies (owner_id, name, slug, verified_at)
		VALUES ($1, $2, $3, now()) RETURNING id, slug`, userID, "Test Co "+suffix, "test-co-"+suffix)
	if err := row.Scan(&f.company.ID, &f.company.Slug); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO company_members (company_id, user_id, role) VALUES ($1, $2, 'owner')`,
		f.company.ID, userID); err != nil {
		t.Fatal(err)
	}

	f.svc = &Service{
		Pool: pool, Q: q, Catalog: cat,
		Companies: &company.Service{Pool: pool, Q: q, Catalog: cat},
		Views:     &ViewCounter{RDB: rdb},
		Cache:     NewPublicCache(rdb, log),
		Log:       log,
	}
	h := &Handler{Svc: f.svc}
	r := chi.NewRouter()
	r.Use(mw.RequestID, mw.ClientIP(false, nil))
	r.Route("/vacancies", func(r chi.Router) { h.Routes(r, &mw.Authenticator{}) })
	r.Route("/search", h.SearchRoutes)
	f.router = r
	return f
}

// publish creates and publishes a vacancy of the fixture company.
func (f *fixture) publish(title string) Detail {
	f.t.Helper()
	ctx := context.Background()
	d, err := f.svc.Create(ctx, f.employer, f.company.ID.String(), Input{
		Title: title, Description: strings.Repeat("Vazifalar va talablar. ", 3),
		CategoryID: f.category, RegionID: f.region, EmploymentType: "full_time",
		WorkFormat: "office", Experience: "none", Schedule: "full_day",
	})
	if err != nil {
		f.t.Fatal(err)
	}
	if d, err = f.svc.Submit(ctx, f.employer, d.ID); err != nil {
		f.t.Fatal(err)
	}
	if d.Status != "published" {
		f.t.Fatalf("status %s, want published", d.Status)
	}
	return d
}

// do sends a request through the vacancy routes from 203.0.113.10 (hdr["RemoteAddr"]
// overrides it).
func (f *fixture) do(method, target string, hdr map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, nil)
	req.RemoteAddr = "203.0.113.10:5555"
	for k, v := range hdr {
		if k == "RemoteAddr" {
			req.RemoteAddr = v
			continue
		}
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)
	return rec
}

// settle waits for background cache refreshes.
func settle() { time.Sleep(50 * time.Millisecond) }

const letters = "abcdefghijklmnopqrstuvwxyz"

// randWord never repeats a letter back to back (a run like "aaaa" is spam to the
// popular-search filter) and never starts a stop root (it is used after a fixed prefix).
func randWord(n int) string {
	b := make([]byte, n)
	for i := range b {
		for {
			b[i] = letters[rand.IntN(len(letters))]
			if i == 0 || b[i] != b[i-1] {
				break
			}
		}
	}
	return string(b)
}

const browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

func parseQ(s string) searchq.Query { return searchq.Parse(s) }
