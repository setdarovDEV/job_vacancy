package account_test

import (
	"context"
	"fmt"
	"net/netip"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/jobs"
	"jobvacancy.uz/backend/internal/modules/account"
	"jobvacancy.uz/backend/internal/modules/auth"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/modules/file"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/otp"
	"jobvacancy.uz/backend/internal/pkg/ratelimit"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/token"
	"jobvacancy.uz/backend/internal/testutil/fixture"
)

type noMail struct{}

func (noMail) EnqueueEmailCode(context.Context, jobs.EmailCodeArgs) error { return nil }

type env struct {
	*fixture.World
	auth      *auth.Service
	svc       *account.Service
	jobs      *fixture.Jobs
	companies *company.Service
}

func newEnv(t *testing.T) *env {
	t.Helper()
	w := fixture.New(t)
	_, rdb := fixture.Redis(t)
	revoked := auth.NewRevocationStore(rdb, 15*time.Minute)
	a := &auth.Service{Q: w.Q, Tokens: token.NewManager(strings.Repeat("s", 40), "test", 15*time.Minute),
		OTP: otp.NewStore(rdb, strings.Repeat("o", 40)), Revoked: revoked, Emails: noMail{},
		Guard: auth.NewLoginGuard(rdb, nil, w.Log), RefreshTTL: time.Hour, ConsentVersion: "2026-09-24", Log: w.Log}
	cat := &catalog.Service{Q: w.Q, Log: w.Log}
	w.Must(cat.Reload(context.Background()))
	j := &fixture.Jobs{}
	return &env{World: w, auth: a, jobs: j, companies: &company.Service{Pool: w.Pool, Q: w.Q, Catalog: cat},
		svc: &account.Service{Pool: w.Pool, Q: w.Q, Limiter: ratelimit.New(rdb), Revoked: revoked, Jobs: j,
			Cache: vacancy.NewPublicCache(rdb, w.Log), Log: w.Log}}
}

func code(err error) string {
	if ae, ok := apperr.As(err); ok {
		return ae.Code
	}
	return fmt.Sprint(err)
}

var consent = auth.Consent{Given: true}

func (e *env) register(email string, role gen.UserRole) (*auth.Result, reqctx.Principal) {
	e.T.Helper()
	res, err := e.auth.Register(context.Background(), auth.RegisterInput{Email: email, Password: "Secret123",
		FullName: "Ali Valiyev", Role: role, Locale: gen.AppLocaleUz, Consent: consent},
		auth.ClientMeta{Platform: "web", IP: netip.MustParseAddr("203.0.113.1")})
	e.Must(err)
	c, err := e.auth.Tokens.Parse(res.AccessToken)
	e.Must(err)
	return res, reqctx.Principal{UserID: c.UserID, SessionID: c.SessionID, Role: c.Role}
}

// TZ FN-03 ✅: after deletion the account can't sign in, its personal data is gone and the
// e-mail is free to register again; applications stay with the employer.
func TestDeleteAccount(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	email := e.Email()
	res, p := e.register(email, gen.UserRoleSeeker)
	uid := res.User.ID
	e.Exec(`UPDATE users SET phone = $2, phone_verified_at = now(), avatar_url = 'http://x/a.jpg', telegram_chat_id = $3 WHERE id = $1`,
		uid, fmt.Sprintf("+99890%07d", time.Now().UnixNano()%10000000), time.Now().UnixNano()%1_000_000_000)

	// A resume nobody applied with, one an employer received, and other personal rows.
	emp := e.User(gen.UserRoleEmployer, true)
	c := e.Company(emp.ID, true)
	v := e.Vacancy(c.ID, emp.ID, gen.VacancyStatusPublished)
	var unused, used, appID uuid.UUID
	e.Must(e.Pool.QueryRow(ctx, `INSERT INTO resumes (user_id, title, about) VALUES ($1, 'Kassir', 'about me') RETURNING id`, uid).Scan(&unused))
	e.Must(e.Pool.QueryRow(ctx, `INSERT INTO resumes (user_id, title, about) VALUES ($1, 'Sotuvchi', 'my story') RETURNING id`, uid).Scan(&used))
	e.Exec(`INSERT INTO resume_experiences (resume_id, company, position, start_date) VALUES ($1, 'Makro', 'Kassir', '2020-01-01')`, used)
	e.Must(e.Pool.QueryRow(ctx, `INSERT INTO applications (vacancy_id, company_id, seeker_id, resume_id) VALUES ($1, $2, $3, $4) RETURNING id`,
		v.ID, c.ID, uid, used).Scan(&appID))
	e.Exec(`INSERT INTO notifications (user_id, type) VALUES ($1, 'application.status')`, uid)
	e.Exec(`INSERT INTO saved_vacancies (user_id, vacancy_id) VALUES ($1, $2)`, uid, v.ID)
	e.Exec(`INSERT INTO device_tokens (token, user_id, platform) VALUES ($1, $2, 'android')`, "tok-"+uid.String(), uid)
	e.Exec(`INSERT INTO files (owner_id, purpose, bucket, object_key, content_type) VALUES ($1, 'avatar', 'jv-public', $2, 'image/jpeg')`,
		uid, "avatars/"+uid.String()+".jpg")

	if err := e.svc.Delete(ctx, p, account.DeleteInput{}); code(err) != "validation_failed" {
		t.Fatalf("no password: %v", err)
	}
	if err := e.svc.Delete(ctx, p, account.DeleteInput{Password: "Wrong1234"}); code(err) != "wrong_password" {
		t.Fatalf("wrong password: %v", err)
	}
	if err := e.svc.Delete(ctx, p, account.DeleteInput{Password: "Secret123"}); err != nil {
		t.Fatal(err)
	}

	u, err := e.Q.GetUserByID(ctx, uid)
	e.Must(err)
	if u.Status != gen.UserStatusDeleted || u.DeletedAt == nil || u.FullName != "" || u.Phone != nil || u.AvatarUrl != nil ||
		u.PasswordHash != nil || u.TelegramChatID != nil || *u.Email == email || !strings.HasSuffix(*u.Email, "@deleted.invalid") {
		t.Fatalf("user not anonymized: %+v", u)
	}
	for sql, want := range map[string]int{
		`SELECT count(*) FROM user_sessions WHERE user_id = $1 AND revoked_at IS NULL`:                            0,
		`SELECT count(*) FROM resumes WHERE user_id = $1`:                                                         1, // the one an employer received
		`SELECT count(*) FROM resumes WHERE user_id = $1 AND title = '' AND about = '' AND visibility = 'hidden'`: 1,
		`SELECT count(*) FROM resume_experiences x JOIN resumes r ON r.id = x.resume_id WHERE r.user_id = $1`:     0,
		`SELECT count(*) FROM notifications WHERE user_id = $1`:                                                   0,
		`SELECT count(*) FROM saved_vacancies WHERE user_id = $1`:                                                 0,
		`SELECT count(*) FROM device_tokens WHERE user_id = $1`:                                                   0,
		`SELECT count(*) FROM files WHERE owner_id = $1`:                                                          0,
		`SELECT count(*) FROM applications WHERE seeker_id = $1`:                                                  1,
	} {
		if got := e.Int(sql, uid); got != want {
			t.Errorf("%s = %d, want %d", sql, got, want)
		}
	}
	if len(e.jobs.Args) != 1 {
		t.Fatalf("jobs %v", e.jobs.Kinds())
	}
	purge := e.jobs.Args[0].(file.PurgeObjectsArgs)
	if len(purge.Objects) != 1 || purge.Objects[0].Key != "avatars/"+uid.String()+".jpg" {
		t.Fatalf("purge job %+v", purge)
	}

	// ✅ Sign-in no longer works, and the address can register again.
	if _, err := e.auth.Login(ctx, email, "Secret123", auth.ClientMeta{}); code(err) != "invalid_credentials" {
		t.Fatalf("login after deletion: %v", err)
	}
	again, _ := e.register(email, gen.UserRoleEmployer)
	if again.User.ID == uid || *again.User.Email != email {
		t.Fatalf("re-registration: %+v", again.User)
	}
	// Deleting twice is refused (the old session is revoked anyway).
	if err := e.svc.Delete(ctx, p, account.DeleteInput{Password: "Secret123"}); code(err) != "account_blocked" {
		t.Fatalf("second deletion: %v", err)
	}
}

// TZ FN-03: an owner must hand over a company that has other members first; a company the
// owner runs alone closes with the account.
func TestDeleteCompanyOwner(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	res, p := e.register(e.Email(), gen.UserRoleEmployer)
	owner := res.User
	shared := e.Company(owner.ID, true)
	colleague := e.User(gen.UserRoleEmployer, true)
	e.Member(shared.ID, colleague.ID, "admin")
	alone := e.Company(owner.ID, false)
	live := e.Vacancy(alone.ID, owner.ID, gen.VacancyStatusPublished)

	err := e.svc.Delete(ctx, p, account.DeleteInput{Password: "Secret123"})
	ae, ok := apperr.As(err)
	if !ok || ae.Code != "ownership_transfer_required" || ae.Fields["companies"] != shared.Slug {
		t.Fatalf("delete while owning a shared company: %v %+v", err, ae)
	}
	if _, err := e.companies.TransferOwnership(ctx, p, shared.Slug, colleague.ID); err != nil {
		t.Fatal(err)
	}
	if err := e.svc.Delete(ctx, p, account.DeleteInput{Password: "Secret123"}); err != nil {
		t.Fatal(err)
	}
	st := func(id uuid.UUID) string {
		var s string
		e.Must(e.Pool.QueryRow(ctx, `SELECT status FROM companies WHERE id = $1`, id).Scan(&s))
		return s
	}
	if st(shared.ID) != "active" || st(alone.ID) != "deleted" {
		t.Fatalf("companies: shared %s, alone %s", st(shared.ID), st(alone.ID))
	}
	if n := e.Int(`SELECT count(*) FROM companies WHERE id = $1 AND owner_id = $2`, shared.ID, colleague.ID); n != 1 {
		t.Fatal("ownership not transferred")
	}
	if n := e.Int(`SELECT count(*) FROM vacancies WHERE id = $1 AND status = 'archived'`, live.ID); n != 1 {
		t.Fatal("the closed company's vacancy is still live")
	}
	if n := e.Int(`SELECT count(*) FROM company_members WHERE user_id = $1`, owner.ID); n != 0 {
		t.Fatalf("%d memberships left", n)
	}
}

// Google-only accounts confirm with a recent sign-in (or a fresh Google ID token).
func TestDeleteGoogleAccountNeedsRecentSignIn(t *testing.T) {
	e := newEnv(t)
	u := e.User(gen.UserRoleSeeker, true)
	e.Exec(`UPDATE users SET google_sub = $2 WHERE id = $1`, u.ID, "g-"+u.ID.String())
	old := e.Session(u, account.RecentSignIn+time.Minute)
	if err := e.svc.Delete(context.Background(), old, account.DeleteInput{}); code(err) != "reauth_required" {
		t.Fatalf("stale session: %v", err)
	}
	if err := e.svc.Delete(context.Background(), old, account.DeleteInput{GoogleIDToken: "not-a-token"}); code(err) != "reauth_required" {
		t.Fatalf("bad token without a verifier: %v", err)
	}
	fresh := e.Session(u, time.Minute)
	if err := e.svc.Delete(context.Background(), fresh, account.DeleteInput{}); err != nil {
		t.Fatal(err)
	}
}

// A stolen access token can't be used to guess the password through DELETE /me.
func TestDeleteAttemptsAreLimited(t *testing.T) {
	e := newEnv(t)
	_, p := e.register(e.Email(), gen.UserRoleSeeker)
	var last error
	for i := 0; i < 11; i++ {
		last = e.svc.Delete(context.Background(), p, account.DeleteInput{Password: fmt.Sprintf("Guess%04d", i)})
	}
	if code(last) != "rate_limited" {
		t.Fatalf("11th attempt: %v", last)
	}
}
