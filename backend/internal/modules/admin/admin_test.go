package admin_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/modules/admin"
	"jobvacancy.uz/backend/internal/modules/auth"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/testutil/fixture"
	mw "jobvacancy.uz/backend/internal/transport/http/middleware"
)

type env struct {
	*fixture.World
	rdb     *redis.Client
	svc     *admin.Service
	cache   *vacancy.PublicCache
	jobs    *fixture.Jobs
	admin   reqctx.Principal
	ctx     context.Context
	vacancy *vacancy.Service
	router  http.Handler
}

func newEnv(t *testing.T) *env {
	t.Helper()
	w := fixture.New(t)
	_, rdb := fixture.Redis(t)
	cat := &catalog.Service{Q: w.Q, Log: w.Log}
	w.Must(cat.Reload(context.Background()))
	cache := vacancy.NewPublicCache(rdb, w.Log)
	companies := &company.Service{Pool: w.Pool, Q: w.Q, Catalog: cat}
	jobs := &fixture.Jobs{}
	adm := w.User(gen.UserRoleAdmin, true)
	e := &env{World: w, rdb: rdb, cache: cache, jobs: jobs,
		svc: &admin.Service{Pool: w.Pool, Q: w.Q, Companies: companies,
			Revoked: auth.NewRevocationStore(rdb, 15*time.Minute), Cache: cache, Jobs: jobs, Log: w.Log},
		vacancy: &vacancy.Service{Pool: w.Pool, Q: w.Q, Companies: companies, Catalog: cat,
			Views: &vacancy.ViewCounter{RDB: rdb}, Cache: cache, Log: w.Log},
	}
	e.admin = w.Session(adm, 0)
	// Audit rows take the admin and IP from the request context.
	e.ctx = reqctx.WithClientIP(reqctx.WithPrincipal(context.Background(), e.admin), mustAddr("198.51.100.9"))
	h := &vacancy.Handler{Svc: e.vacancy}
	r := chi.NewRouter()
	r.Use(mw.RequestID, mw.ClientIP(false, nil))
	r.Route("/vacancies", func(r chi.Router) { h.Routes(r, &mw.Authenticator{}) })
	e.router = r
	return e
}

func (e *env) get(path string) (*httptest.ResponseRecorder, map[string]any) {
	req := httptest.NewRequest("GET", path, nil)
	req.RemoteAddr = "203.0.113.7:1234"
	rec := httptest.NewRecorder()
	e.router.ServeHTTP(rec, req)
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	return rec, body
}

func (e *env) audit(action, objectID string) map[string]any {
	e.T.Helper()
	var raw []byte
	var admin uuid.UUID
	var ip string
	err := e.Pool.QueryRow(context.Background(), `SELECT details, admin_id, host(ip) FROM admin_audit_log
		WHERE action = $1 AND object_id = $2 ORDER BY id DESC LIMIT 1`, action, objectID).Scan(&raw, &admin, &ip)
	if err != nil {
		e.T.Fatalf("no audit row %s %s: %v", action, objectID, err)
	}
	if admin != e.admin.UserID || ip != "198.51.100.9" {
		e.T.Fatalf("audit row %s by %s from %s", action, admin, ip)
	}
	var d map[string]any
	e.Must(json.Unmarshal(raw, &d))
	return d
}

func code(err error) string {
	if ae, ok := apperr.As(err); ok {
		return ae.Code
	}
	return fmt.Sprint(err)
}

// TZ FN-01: blocking a user revokes every session (DB and access tokens) and unpublishes
// the vacancies they published or sent to moderation; all of it is audited.
func TestBlockUser(t *testing.T) {
	e := newEnv(t)
	emp := e.User(gen.UserRoleEmployer, true)
	colleague := e.User(gen.UserRoleEmployer, true)
	c := e.Company(emp.ID, true)
	e.Member(c.ID, colleague.ID, "recruiter")
	pub := e.Vacancy(c.ID, emp.ID, gen.VacancyStatusPublished)
	mod := e.Vacancy(c.ID, emp.ID, gen.VacancyStatusModeration)
	draft := e.Vacancy(c.ID, emp.ID, gen.VacancyStatusDraft)
	other := e.Vacancy(c.ID, colleague.ID, gen.VacancyStatusPublished)
	s1, s2 := e.Session(emp, 0), e.Session(emp, time.Hour)

	u, err := e.svc.BlockUser(e.ctx, e.admin, emp.ID, "Fake vacancies")
	if err != nil || u.Status != "blocked" {
		t.Fatalf("block: %+v %v", u, err)
	}
	if n := e.Int(`SELECT count(*) FROM user_sessions WHERE user_id = $1 AND revoked_at IS NULL`, emp.ID); n != 0 {
		t.Fatalf("%d sessions still active", n)
	}
	for _, s := range []reqctx.Principal{s1, s2} {
		if n, _ := e.rdb.Exists(context.Background(), auth.RevokedKey(s.SessionID)).Result(); n != 1 {
			t.Fatalf("access token of session %s not revoked", s.SessionID)
		}
	}
	status := func(v gen.Vacancy) string {
		var s string
		e.Must(e.Pool.QueryRow(context.Background(), `SELECT status FROM vacancies WHERE id = $1`, v.ID).Scan(&s))
		return s
	}
	if status(pub) != "archived" || status(mod) != "archived" || status(draft) != "draft" || status(other) != "published" {
		t.Fatalf("statuses: pub %s, mod %s, draft %s, colleague's %s", status(pub), status(mod), status(draft), status(other))
	}
	d := e.audit("user.block", emp.ID.String())
	if d["reason"] != "Fake vacancies" || d["sessions_revoked"] != 2.0 || len(d["vacancies_unpublished"].([]any)) != 2 {
		t.Fatalf("audit details %v", d)
	}

	// Again: nothing changes, no second audit row.
	if _, err := e.svc.BlockUser(e.ctx, e.admin, emp.ID, "again"); err != nil {
		t.Fatal(err)
	}
	if n := e.Int(`SELECT count(*) FROM admin_audit_log WHERE action = 'user.block' AND object_id = $1`, emp.ID.String()); n != 1 {
		t.Fatalf("%d audit rows", n)
	}
	// Admins and oneself can't be blocked; a reason is required.
	other2 := e.User(gen.UserRoleAdmin, true)
	for _, tc := range []struct {
		id     uuid.UUID
		reason string
		want   string
	}{{other2.ID, "reason", "cannot_block_admin"}, {e.admin.UserID, "reason", "cannot_block_self"},
		{colleague.ID, " ", "validation_failed"}, {uuid.New(), "reason", "user_not_found"}} {
		if _, err := e.svc.BlockUser(e.ctx, e.admin, tc.id, tc.reason); code(err) != tc.want {
			t.Errorf("block %s: %v, want %s", tc.id, err, tc.want)
		}
	}

	u, err = e.svc.UnblockUser(e.ctx, emp.ID)
	if err != nil || u.Status != "active" {
		t.Fatalf("unblock: %+v %v", u, err)
	}
	e.audit("user.unblock", emp.ID.String())
	// The unpublished vacancies stay archived; republishing needs moderation again.
	if status(pub) != "archived" {
		t.Fatal("unblock republished a vacancy")
	}
}

// TZ FN-01 ✅ "Bloklangan kompaniya vakansiyalari qidiruvdan 1 daqiqa ichida yo'qoladi":
// a blocked company's vacancies leave the cached search listing, the company listing and
// their cached detail pages right after the block (measured, far below a minute).
func TestBlockedCompanyLeavesSearch(t *testing.T) {
	e := newEnv(t)
	emp := e.User(gen.UserRoleEmployer, true)
	c := e.Company(emp.ID, true)
	v1 := e.Vacancy(c.ID, emp.ID, gen.VacancyStatusPublished)
	e.Vacancy(c.ID, emp.ID, gen.VacancyStatusPublished)

	count := func(path string) int {
		rec, body := e.get(path)
		if rec.Code != 200 {
			t.Fatalf("%s: %d %s", path, rec.Code, rec.Body.String())
		}
		return len(body["data"].([]any))
	}
	search := "/vacancies?q=" + e.Tag
	byCompany := "/vacancies?company_id=" + c.ID.String()
	if n := count(search); n != 2 {
		t.Fatalf("search before block: %d", n)
	}
	if n := count(byCompany); n != 2 {
		t.Fatalf("company listing before block: %d", n)
	}
	if rec, _ := e.get("/vacancies/" + v1.Slug); rec.Code != 200 || rec.Header().Get("X-Cache") != "MISS" {
		t.Fatalf("detail before block: %d", rec.Code)
	}
	if rec, _ := e.get("/vacancies/" + v1.Slug); rec.Header().Get("X-Cache") != "HIT" {
		t.Fatal("detail not cached")
	}
	if count(search) != 2 { // now served from the cache
		t.Fatal("cached search changed")
	}

	start := time.Now()
	if _, err := e.svc.BlockCompany(e.ctx, e.admin, c.ID.String(), "Scam company"); err != nil {
		t.Fatal(err)
	}
	if rec, _ := e.get("/vacancies/" + v1.Slug); rec.Code != 404 {
		t.Fatalf("detail after block: %d", rec.Code)
	}
	// Listings are stale-while-revalidate: at most one more request may see the old page
	// while it refreshes in the background.
	requests := 0
	for count(search) != 0 || count(byCompany) != 0 {
		requests++
		if requests > 3 || time.Since(start) > time.Minute {
			t.Fatalf("still listed after %d requests / %s", requests, time.Since(start))
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Logf("blocked company's vacancies left search after %s (%d stale requests)", time.Since(start).Round(time.Millisecond), requests)
	if n := e.Int(`SELECT count(*) FROM vacancies WHERE company_id = $1 AND status = 'published'`, c.ID); n != 0 {
		t.Fatalf("%d still published", n)
	}
	if n := e.Int(`SELECT open_vacancies FROM companies WHERE id = $1`, c.ID); n != 0 {
		t.Fatalf("open_vacancies %d", n)
	}
	d := e.audit("company.block", c.ID.String())
	if len(d["vacancies_unpublished"].([]any)) != 2 {
		t.Fatalf("audit %v", d)
	}
	// Members can't manage a blocked company.
	if _, _, err := e.svc.Companies.Authorize(context.Background(), fixture.Principal(emp), c.ID.String(), gen.CompanyMemberRoleRecruiter); code(err) != "company_blocked" {
		t.Fatalf("authorize blocked company: %v", err)
	}
	dto, err := e.svc.UnblockCompany(e.ctx, c.Slug)
	if err != nil || dto.Status != "active" {
		t.Fatalf("unblock: %+v %v", dto, err)
	}
	e.audit("company.unblock", c.ID.String())
}

// TZ FN-01: merging a duplicate skill moves every vacancy and resume to the target, adds
// up the usage, deletes the duplicate and queues the search reindex in the same
// transaction.
func TestMergeSkill(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	emp := e.User(gen.UserRoleEmployer, true)
	c := e.Company(emp.ID, true)
	skill := func(name string, verified bool, usage int) int32 {
		var id int32
		e.Must(e.Pool.QueryRow(ctx, `INSERT INTO skills (name, slug, is_verified, usage_count) VALUES ($1, $2, $3, $4) RETURNING id`,
			name, e.Tag+"-"+name, verified, usage).Scan(&id))
		return id
	}
	dup, into := skill("golang", false, 3), skill("Go", true, 10)
	a := e.Vacancy(c.ID, emp.ID, gen.VacancyStatusPublished)
	b := e.Vacancy(c.ID, emp.ID, gen.VacancyStatusDraft)
	e.Exec(`INSERT INTO vacancy_skills VALUES ($1, $3), ($2, $3), ($2, $4)`, a.ID, b.ID, dup, into)
	seeker := e.User(gen.UserRoleSeeker, true)
	var resumeID uuid.UUID
	e.Must(e.Pool.QueryRow(ctx, `INSERT INTO resumes (user_id, title) VALUES ($1, 'Dev') RETURNING id`, seeker.ID).Scan(&resumeID))
	e.Exec(`INSERT INTO resume_skills VALUES ($1, $2)`, resumeID, dup)

	res, err := e.svc.MergeSkill(e.ctx, dup, into)
	if err != nil {
		t.Fatal(err)
	}
	if res.Vacancies != 2 || res.Resumes != 1 || res.Into.UsageCount != 13 {
		t.Fatalf("result %+v", res)
	}
	if n := e.Int(`SELECT count(*) FROM skills WHERE id = $1`, dup); n != 0 {
		t.Fatal("duplicate skill still exists")
	}
	if n := e.Int(`SELECT count(*) FROM vacancy_skills WHERE skill_id = $1 AND vacancy_id = ANY($2)`, into, []uuid.UUID{a.ID, b.ID}); n != 2 {
		t.Fatalf("%d vacancy rows on the target", n)
	}
	if n := e.Int(`SELECT usage_count FROM skills WHERE id = $1`, into); n != 13 {
		t.Fatalf("usage %d", n)
	}
	if n := e.Int(`SELECT count(*) FROM resume_skills WHERE resume_id = $1 AND skill_id = $2`, resumeID, into); n != 1 {
		t.Fatal("resume not moved")
	}
	if len(e.jobs.Args) != 1 || e.jobs.Args[0].Kind() != "vacancy.reindex" {
		t.Fatalf("jobs %v", e.jobs.Kinds())
	}
	ids := e.jobs.Args[0].(vacancy.ReindexArgs).IDs
	if !slices.Contains(ids, a.ID) || !slices.Contains(ids, b.ID) {
		t.Fatalf("reindex ids %v", ids)
	}
	d := e.audit("skill.merge", fmt.Sprint(dup))
	if d["from"] != "golang" || d["into"] != "Go" {
		t.Fatalf("audit %v", d)
	}
	if _, err := e.svc.MergeSkill(e.ctx, into, into); !errors.Is(err, admin.ErrSkillMergeSelf) {
		t.Fatalf("self merge: %v", err)
	}
	if _, err := e.svc.MergeSkill(e.ctx, dup, into); !errors.Is(err, admin.ErrSkillNotFound) {
		t.Fatalf("merge of a deleted skill: %v", err)
	}
	s, err := e.svc.SetSkillVerified(e.ctx, into, false)
	if err != nil || s.IsVerified {
		t.Fatalf("unverify: %+v %v", s, err)
	}
	e.audit("skill.unverify", fmt.Sprint(into))
}

// TZ FN-01: search finds users by a piece of name, e-mail or phone; stats count today's
// sign-ups; the audit log filters by object.
func TestUserSearchStatsAudit(t *testing.T) {
	e := newEnv(t)
	u := e.User(gen.UserRoleSeeker, false)
	e.User(gen.UserRoleEmployer, false)
	e.Exec(`UPDATE users SET phone = '+998901112233' WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM users WHERE phone = '+998901112233')`, u.ID)

	got, _, err := e.svc.Users(context.Background(), admin.UserFilter{Q: e.Tag, Limit: 10})
	if err != nil || len(got) != 3 { // two users here plus the admin of this env
		t.Fatalf("search by tag: %d %v", len(got), err)
	}
	role := gen.UserRoleSeeker
	got, _, _ = e.svc.Users(context.Background(), admin.UserFilter{Q: e.Tag, Role: &role, Limit: 10})
	if len(got) != 1 || got[0].ID != u.ID {
		t.Fatalf("search by tag and role: %+v", got)
	}
	first, next, _ := e.svc.Users(context.Background(), admin.UserFilter{Q: e.Tag, Limit: 2})
	rest, _, _ := e.svc.Users(context.Background(), admin.UserFilter{Q: e.Tag, Limit: 2, Before: next})
	if len(first) != 2 || next == nil || len(rest) != 1 {
		t.Fatalf("keyset pages %d/%d", len(first), len(rest))
	}

	st, err := e.svc.Stats(context.Background(), 7)
	if err != nil || len(st.Days) != 7 {
		t.Fatalf("stats: %d days %v", len(st.Days), err)
	}
	today := time.Now().In(mustZone("Asia/Tashkent")).Format("2006-01-02")
	if last := st.Days[6]; last.Date != today || last.Registrations < 3 {
		t.Fatalf("today %+v, want date %s and ≥ 3 sign-ups", last, today)
	}
	if st.Totals.Users < 3 {
		t.Fatalf("totals %+v", st.Totals)
	}

	if _, err := e.svc.BlockUser(e.ctx, e.admin, u.ID, "spam"); err != nil {
		t.Fatal(err)
	}
	typ, id := "user", u.ID.String()
	entries, _, err := e.svc.AuditLog(context.Background(), admin.AuditFilter{ObjectType: &typ, ObjectID: &id, Limit: 10})
	if err != nil || len(entries) != 1 || entries[0].Action != "user.block" || entries[0].Admin == nil || *entries[0].IP != "198.51.100.9" {
		t.Fatalf("audit log: %+v %v", entries, err)
	}
}
