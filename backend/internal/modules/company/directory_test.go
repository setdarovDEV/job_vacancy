package company

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/testutil/pgtest"
	mw "jobvacancy.uz/backend/internal/transport/http/middleware"
)

type dirFixture struct {
	t        *testing.T
	pool     *pgxpool.Pool
	owner    uuid.UUID
	category int32
	region   int32
	tag      string
}

func newDirFixture(t *testing.T) *dirFixture {
	t.Helper()
	pool := pgtest.Pool(t)
	ctx := context.Background()
	f := &dirFixture{t: t, pool: pool, tag: fmt.Sprintf("dirtest%08x", rand.Uint32())}
	must(t, pool.QueryRow(ctx, `SELECT id FROM categories WHERE parent_id IS NOT NULL ORDER BY id LIMIT 1`).Scan(&f.category))
	must(t, pool.QueryRow(ctx, `SELECT id FROM regions WHERE parent_id IS NULL ORDER BY id LIMIT 1`).Scan(&f.region))
	must(t, pool.QueryRow(ctx, `INSERT INTO users (email, full_name, role, email_verified_at)
		VALUES ($1, 'Dir Owner', 'employer', now()) RETURNING id`, f.tag+"@test.local").Scan(&f.owner))
	return f
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func (f *dirFixture) company(name string, verified bool) uuid.UUID {
	f.t.Helper()
	var id uuid.UUID
	must(f.t, f.pool.QueryRow(context.Background(), `INSERT INTO companies (owner_id, name, slug, verified_at)
		VALUES ($1, $2, $3, CASE WHEN $4 THEN now() END) RETURNING id`,
		f.owner, name, strings.ToLower(strings.ReplaceAll(name, " ", "-")), verified).Scan(&id))
	return id
}

// vacancy inserts a vacancy of company in the given status.
func (f *dirFixture) vacancy(company uuid.UUID, status string) uuid.UUID {
	f.t.Helper()
	var id uuid.UUID
	must(f.t, f.pool.QueryRow(context.Background(), `INSERT INTO vacancies (company_id, created_by, title, slug,
		description, category_id, region_id, employment_type, work_format, experience, schedule, status, published_at)
		VALUES ($1, $2, 'T', $3, 'D', $4, $5, 'full_time', 'office', 'none', 'full_day', $6::vacancy_status,
		        CASE WHEN $6 = 'published' THEN now() END)
		RETURNING id`, company, f.owner, "v-"+uuid.NewString(), f.category, f.region, status).Scan(&id))
	return id
}

func (f *dirFixture) open(company uuid.UUID) int32 {
	f.t.Helper()
	var n int32
	must(f.t, f.pool.QueryRow(context.Background(), `SELECT open_vacancies FROM companies WHERE id = $1`, company).Scan(&n))
	return n
}

func (f *dirFixture) exec(sql string, args ...any) {
	f.t.Helper()
	if _, err := f.pool.Exec(context.Background(), sql, args...); err != nil {
		f.t.Fatal(err)
	}
}

// The counter follows every way a vacancy enters or leaves "published", in the same
// transaction, and a view-count flush doesn't touch the company row.
func TestOpenVacanciesCounter(t *testing.T) {
	f := newDirFixture(t)
	a := f.company(f.tag+" alpha", false)
	b := f.company(f.tag+" beta", false)

	v1 := f.vacancy(a, "published")
	v2 := f.vacancy(a, "published")
	d := f.vacancy(a, "draft")
	if got := f.open(a); got != 2 {
		t.Fatalf("after 2 published inserts: %d", got)
	}
	f.exec(`UPDATE vacancies SET status = 'published', published_at = now() WHERE id = $1`, d) // publish
	f.exec(`UPDATE vacancies SET status = 'archived' WHERE id = $1`, v1)                        // archive
	f.exec(`UPDATE vacancies SET status = 'expired' WHERE id = $1`, v2)                         // expire
	if got := f.open(a); got != 1 {
		t.Fatalf("after publish+archive+expire: %d, want 1", got)
	}
	var updatedAt1, updatedAt2 string
	must(t, f.pool.QueryRow(context.Background(), `SELECT updated_at::text FROM companies WHERE id=$1`, a).Scan(&updatedAt1))
	f.exec(`UPDATE vacancies SET views_count = views_count + 5 WHERE id = $1`, d) // counters: no company write
	f.exec(`UPDATE vacancies SET company_id = $2 WHERE id = $1`, d, b)            // moved to another company
	if ga, gb := f.open(a), f.open(b); ga != 0 || gb != 1 {
		t.Fatalf("after move: a=%d b=%d, want 0/1", ga, gb)
	}
	must(t, f.pool.QueryRow(context.Background(), `SELECT updated_at::text FROM companies WHERE id=$1`, a).Scan(&updatedAt2))
	if updatedAt1 != updatedAt2 {
		t.Fatalf("company updated_at moved on a counter change: %s -> %s", updatedAt1, updatedAt2)
	}
	f.exec(`DELETE FROM vacancies WHERE id = $1`, d)
	if got := f.open(b); got != 0 {
		t.Fatalf("after delete: %d", got)
	}
	// A rolled-back publish leaves the counter alone.
	tx, err := f.pool.Begin(context.Background())
	must(t, err)
	_, err = tx.Exec(context.Background(), `UPDATE vacancies SET status='published' WHERE id=$1`, v1)
	must(t, err)
	must(t, tx.Rollback(context.Background()))
	if got := f.open(a); got != 0 {
		t.Fatalf("after rollback: %d", got)
	}
}

type dirResponse struct {
	Data []DTO `json:"data"`
	Meta struct {
		Page       *int64  `json:"page"`
		NextPage   *int64  `json:"next_page"`
		NextCursor *string `json:"next_cursor"`
		Total      int64   `json:"total"`
		PageCount  int64   `json:"page_count"`
	} `json:"meta"`
}

// Numbered pages (seeking from cached anchors) and the cursor walk return the same rows in
// the documented order, with correct totals; nothing is skipped or repeated.
func TestDirectoryPages(t *testing.T) {
	f := newDirFixture(t)
	const n = 61 // 3 pages: 24 + 24 + 13
	type want struct {
		name     string
		verified bool
		open     int
	}
	var expected []want
	for i := range n {
		verified := i%5 == 0
		name := fmt.Sprintf("%s co %02d", f.tag, (i*37)%n) // names not in insertion order
		id := f.company(name, verified)
		open := i % 4
		for range open {
			f.vacancy(id, "published")
		}
		expected = append(expected, want{name, verified, open})
	}
	f.company(f.tag+" blocked", true)
	f.exec(`UPDATE companies SET status = 'blocked' WHERE name = $1`, f.tag+" blocked")
	slices.SortFunc(expected, func(x, y want) int {
		if x.verified != y.verified {
			if x.verified {
				return -1
			}
			return 1
		}
		if x.open != y.open {
			return y.open - x.open
		}
		return strings.Compare(x.name, y.name)
	})

	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	h := &Handler{Svc: &Service{Pool: f.pool, Q: gen.New(f.pool)}, Directory: &Directory{Q: gen.New(f.pool), RDB: rdb}}
	r := chi.NewRouter()
	r.Route("/companies", func(r chi.Router) { h.Routes(r, &mw.Authenticator{}) })
	get := func(query string) dirResponse {
		t.Helper()
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/companies?"+query, nil))
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: %d %s", query, rec.Code, rec.Body)
		}
		var out dirResponse
		must(t, json.Unmarshal(rec.Body.Bytes(), &out))
		return out
	}
	check := func(label string, got []DTO, from int) {
		t.Helper()
		for i, c := range got {
			w := expected[from+i]
			if c.Name != w.name || c.Verified != w.verified || c.OpenVacancies == nil || int(*c.OpenVacancies) != w.open {
				t.Fatalf("%s row %d: got %s verified=%v open=%v, want %+v", label, from+i, c.Name, c.Verified, c.OpenVacancies, w)
			}
		}
	}

	// Numbered pages.
	for page := 1; page <= 3; page++ {
		res := get(fmt.Sprintf("q=%s&page=%d", f.tag, page))
		if res.Meta.Total != n || res.Meta.PageCount != 3 {
			t.Fatalf("page %d meta: total=%d page_count=%d", page, res.Meta.Total, res.Meta.PageCount)
		}
		wantLen := min(24, n-(page-1)*24)
		if len(res.Data) != wantLen {
			t.Fatalf("page %d: %d rows, want %d", page, len(res.Data), wantLen)
		}
		check(fmt.Sprintf("page %d", page), res.Data, (page-1)*24)
		if (page < 3) != (res.Meta.NextPage != nil) || (page < 3) != (res.Meta.NextCursor != nil) {
			t.Fatalf("page %d: next_page=%v next_cursor=%v", page, res.Meta.NextPage, res.Meta.NextCursor)
		}
	}
	if res := get("q=" + f.tag + "&page=4"); len(res.Data) != 0 || res.Meta.NextPage != nil {
		t.Fatalf("page past the end: %d rows", len(res.Data))
	}
	// The anchors were cached once for this search term.
	if keys := mr.Keys(); len(keys) != 1 || !strings.HasPrefix(keys[0], anchorsKeyPrefix) {
		t.Fatalf("redis keys: %v", keys)
	}

	// Cursor walk from page 1.
	var walked []DTO
	res := get("q=" + f.tag)
	walked = append(walked, res.Data...)
	for res.Meta.NextCursor != nil {
		res = get("q=" + f.tag + "&cursor=" + *res.Meta.NextCursor)
		if res.Meta.Page != nil {
			t.Fatalf("cursor page reports page=%d", *res.Meta.Page)
		}
		walked = append(walked, res.Data...)
	}
	if len(walked) != n {
		t.Fatalf("cursor walk: %d rows, want %d", len(walked), n)
	}
	check("cursor walk", walked, 0)

	// A bad cursor is a 400.
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/companies?cursor=%7B", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("bad cursor: %d", rec.Code)
	}

	// LIKE wildcards in q match literally.
	if res := get("q=" + f.tag + "%25"); len(res.Data) != 0 {
		t.Fatalf("q with %%: %d rows", len(res.Data))
	}
}

// TZ BE-03 ✅ "OFFSET kodda qolmaydi": no query or Go file pages with OFFSET.
func TestNoOffsetPaging(t *testing.T) {
	root := filepath.Join("..", "..", "..")
	re := regexp.MustCompile(`(?i)\bOFFSET\s+(\$|\d|sqlc\.|@|\?)`)
	var hits []string
	for _, dir := range []string{"db/queries", "db/gen", "internal"} {
		err := filepath.WalkDir(filepath.Join(root, dir), func(p string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() || strings.HasSuffix(p, "_test.go") ||
				(!strings.HasSuffix(p, ".sql") && !strings.HasSuffix(p, ".go")) {
				return err
			}
			b, err := os.ReadFile(p)
			if err != nil {
				return err
			}
			for i, line := range strings.Split(string(b), "\n") {
				if re.MatchString(line) {
					hits = append(hits, fmt.Sprintf("%s:%d: %s", p, i+1, strings.TrimSpace(line)))
				}
			}
			return nil
		})
		must(t, err)
	}
	if len(hits) > 0 {
		t.Fatalf("OFFSET paging found:\n%s", strings.Join(hits, "\n"))
	}
}
