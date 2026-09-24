package http

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

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
	"jobvacancy.uz/backend/internal/pkg/ratelimit"
	"jobvacancy.uz/backend/internal/pkg/token"
	"jobvacancy.uz/backend/internal/realtime"
	mw "jobvacancy.uz/backend/internal/transport/http/middleware"
)

var param = regexp.MustCompile(`\{[a-z_]+\}`)

// TZ FN-01 ✅ "Admin bo'lmagan foydalanuvchi uchun 403": the real router is built and every
// route mounted under /api/v1/admin is walked. A seeker's and an employer's valid tokens
// get 403 {code: forbidden} on each; no token gets 401. Handlers have no services here: a
// request that got past the role check would panic (500), so a 403 proves the check runs
// first on every route, including ones added later.
func TestAdminRoutesRequireAdmin(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	tokens := token.NewManager(strings.Repeat("k", 40), "test", 15*time.Minute)

	router := NewRouter(Deps{
		Log: log, Redis: rdb, Limiter: ratelimit.New(rdb),
		Auth: &mw.Authenticator{Tokens: tokens, Revoked: auth.NewRevocationStore(rdb, 15*time.Minute)},

		AuthHandler: &auth.Handler{}, UserHandler: &user.Handler{}, CatalogHandler: &catalog.Handler{},
		CompanyHandler: &company.Handler{}, VacancyHandler: &vacancy.Handler{}, ResumeHandler: &resume.Handler{},
		FileHandler: &file.Handler{}, NotifyHandler: &notification.Handler{}, ChatHandler: &chat.Handler{},
		SavedHandler: &savedsearch.Handler{}, WSHandler: &realtime.Handler{}, AppHandler: &application.Handler{},
		AdminHandler: &admin.Handler{}, ReportHandler: &report.Handler{}, AccountHandler: &account.Handler{},
	})

	type route struct{ method, path string }
	var routes []route
	err := chi.Walk(router.(chi.Routes), func(method, pattern string, _ http.Handler, _ ...func(http.Handler) http.Handler) error {
		if strings.HasPrefix(pattern, "/api/v1/admin/") {
			p := strings.ReplaceAll(pattern, "{skill}", "7")
			p = param.ReplaceAllStringFunc(p, func(string) string { return uuid.NewString() })
			routes = append(routes, route{method, strings.TrimSuffix(p, "/*")})
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(routes) < 25 {
		t.Fatalf("found only %d admin routes: %v", len(routes), routes)
	}

	issue := func(role string) string {
		tok, _, err := tokens.Issue(uuid.New(), uuid.New(), role, time.Now())
		if err != nil {
			t.Fatal(err)
		}
		return tok
	}
	for _, who := range []struct {
		name, token string
		want        int
	}{
		{"seeker", issue("seeker"), http.StatusForbidden},
		{"employer", issue("employer"), http.StatusForbidden},
		{"anonymous", "", http.StatusUnauthorized},
	} {
		for _, rt := range routes {
			req := httptest.NewRequest(rt.method, rt.path, strings.NewReader(`{}`))
			req.RemoteAddr = "203.0.113.5:4000"
			req.Header.Set("Content-Type", "application/json")
			if who.token != "" {
				req.Header.Set("Authorization", "Bearer "+who.token)
			}
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != who.want {
				t.Errorf("%s %s %s: %d, want %d (%s)", who.name, rt.method, rt.path, rec.Code, who.want, rec.Body.String())
				continue
			}
			if who.want == http.StatusForbidden && !strings.Contains(rec.Body.String(), `"code":"forbidden"`) {
				t.Errorf("%s %s %s: body %s", who.name, rt.method, rt.path, rec.Body.String())
			}
		}
	}
	t.Logf("%d admin routes checked for seeker, employer and anonymous callers", len(routes))
}
