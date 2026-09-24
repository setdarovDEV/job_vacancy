package http

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/jobs"
	"jobvacancy.uz/backend/internal/modules/account"
	"jobvacancy.uz/backend/internal/modules/admin"
	"jobvacancy.uz/backend/internal/modules/application"
	"jobvacancy.uz/backend/internal/modules/auth"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/chat"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/modules/file"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/modules/report"
	"jobvacancy.uz/backend/internal/modules/resume"
	"jobvacancy.uz/backend/internal/modules/savedsearch"
	"jobvacancy.uz/backend/internal/modules/user"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/hash"
	"jobvacancy.uz/backend/internal/pkg/otp"
	"jobvacancy.uz/backend/internal/pkg/ratelimit"
	"jobvacancy.uz/backend/internal/pkg/token"
	"jobvacancy.uz/backend/internal/realtime"
	"jobvacancy.uz/backend/internal/testutil/fixture"
	mw "jobvacancy.uz/backend/internal/transport/http/middleware"
)

type noMail struct{}

func (noMail) EnqueueEmailCode(context.Context, jobs.EmailCodeArgs) error { return nil }

// TZ SEC-04 ✅ "Bitta IP ortidagi 50 foydalanuvchi normal ishlaydi" (a Go stand-in for
// the k6 run): 50 people behind one carrier CGNAT address sign in within the same minute
// (5 of them mistype their password first), refresh their tokens twice and make ten API
// calls each, through the real router, limits and login guard. Nobody sees a 429, a
// captcha or a delay. The per-IP ceilings still exist: the 121st refresh from that
// address in the minute is refused.
func TestFiftyUsersBehindOneIP(t *testing.T) {
	w := fixture.New(t)
	_, rdb := fixture.Redis(t)
	tokens := token.NewManager(strings.Repeat("k", 40), "test", 15*time.Minute)
	revoked := auth.NewRevocationStore(rdb, 15*time.Minute)
	guard := auth.NewLoginGuard(rdb, nil, w.Log)
	svc := &auth.Service{Q: w.Q, Tokens: tokens, OTP: otp.NewStore(rdb, strings.Repeat("o", 40)),
		Revoked: revoked, Emails: noMail{}, Guard: guard, RefreshTTL: time.Hour, ConsentVersion: "2026-09-24", Log: w.Log}
	router := NewRouter(Deps{
		Log: w.Log, DB: w.Pool, Redis: rdb, Limiter: ratelimit.New(rdb),
		Auth:        &mw.Authenticator{Tokens: tokens, Revoked: revoked},
		AuthHandler: &auth.Handler{Svc: svc}, UserHandler: &user.Handler{Q: w.Q},
		CatalogHandler: &catalog.Handler{}, CompanyHandler: &company.Handler{}, VacancyHandler: &vacancy.Handler{},
		ResumeHandler: &resume.Handler{}, FileHandler: &file.Handler{}, NotifyHandler: &notification.Handler{},
		ChatHandler: &chat.Handler{}, SavedHandler: &savedsearch.Handler{}, WSHandler: &realtime.Handler{},
		AppHandler: &application.Handler{}, AdminHandler: &admin.Handler{}, ReportHandler: &report.Handler{},
		AccountHandler: &account.Handler{},
	})

	pw := "Cgnat-Pass1"
	h, err := hash.Password(pw)
	w.Must(err)
	const users = 50
	emails := make([]string, users)
	for i := range emails {
		u := w.User(gen.UserRoleSeeker, true)
		w.Exec(`UPDATE users SET password_hash = $2 WHERE id = $1`, u.ID, h)
		emails[i] = *u.Email
	}

	const cgnat = "100.64.12.34:40000" // everyone's TCP peer (no proxy in front here)
	do := func(method, path, body, bearer string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.RemoteAddr = cgnat
		r.Header.Set("Content-Type", "application/json")
		if bearer != "" {
			r.Header.Set("Authorization", "Bearer "+bearer)
		}
		if cookie != nil {
			r.AddCookie(cookie)
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, r)
		return rec
	}
	session := func(rec *httptest.ResponseRecorder) (string, *http.Cookie) {
		var out struct {
			Data struct {
				AccessToken string `json:"access_token"`
			} `json:"data"`
		}
		_ = json.Unmarshal(rec.Body.Bytes(), &out)
		for _, c := range rec.Result().Cookies() {
			if c.Name == "jv_refresh" {
				return out.Data.AccessToken, c
			}
		}
		return out.Data.AccessToken, nil
	}

	var mu sync.Mutex
	statuses := map[string]map[int]int{}
	count := func(kind string, code int) {
		mu.Lock()
		if statuses[kind] == nil {
			statuses[kind] = map[int]int{}
		}
		statuses[kind][code]++
		mu.Unlock()
	}
	start := time.Now()
	var wg sync.WaitGroup
	sem := make(chan struct{}, 10)
	for i, email := range emails {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			if i%10 == 0 { // a typo first
				count("login_typo", do("POST", "/api/v1/auth/login", fmt.Sprintf(`{"email":%q,"password":"wrong"}`, email), "", nil).Code)
			}
			rec := do("POST", "/api/v1/auth/login", fmt.Sprintf(`{"email":%q,"password":%q}`, email, pw), "", nil)
			count("login", rec.Code)
			access, cookie := session(rec)
			for j := 0; j < 2; j++ {
				rec = do("POST", "/api/v1/auth/refresh", "", "", cookie)
				count("refresh", rec.Code)
				if a, c := session(rec); c != nil {
					access, cookie = a, c
				}
			}
			for j := 0; j < 10; j++ {
				count("me", do("GET", "/api/v1/me", "", access, nil).Code)
			}
		}()
	}
	wg.Wait()
	took := time.Since(start)
	t.Logf("50 users behind %s: %v in %v", cgnat, statuses, took.Round(time.Millisecond))
	want := map[string]map[int]int{
		"login_typo": {401: 5}, "login": {200: users}, "refresh": {200: 2 * users}, "me": {200: 10 * users},
	}
	for kind, codes := range want {
		for code, n := range codes {
			if statuses[kind][code] != n || len(statuses[kind]) != 1 {
				t.Fatalf("%s: got %v, want %v", kind, statuses[kind], codes)
			}
		}
	}
	if took > 50*time.Second {
		t.Fatalf("took %v: the run must fit in the rate-limit minute", took)
	}

	// The refresh ceiling (120/min per IP) is still there: 100 used, 20 more pass, then 429.
	codes := map[int]int{}
	for i := 0; i < 21; i++ {
		codes[do("POST", "/api/v1/auth/refresh", "", "", nil).Code]++
	}
	if codes[401] != 20 || codes[429] != 1 {
		t.Fatalf("refreshes 101..121: %v, want 20×401 then 1×429", codes)
	}
}
