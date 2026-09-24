// Package http assembles the API router.
package http

import (
	"context"
	"log/slog"
	"net/http"
	"net/netip"
	"sync/atomic"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/internal/modules/application"
	"jobvacancy.uz/backend/internal/modules/auth"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/chat"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/modules/file"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/modules/resume"
	"jobvacancy.uz/backend/internal/modules/savedsearch"
	"jobvacancy.uz/backend/internal/modules/user"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/ratelimit"
	"jobvacancy.uz/backend/internal/realtime"
	mw "jobvacancy.uz/backend/internal/transport/http/middleware"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

type Deps struct {
	Log         *slog.Logger
	DB          *pgxpool.Pool
	Redis       *redis.Client
	Limiter     *ratelimit.Limiter
	Auth        *mw.Authenticator
	CORSOrigins []string
	TrustProxy  bool
	// Peers allowed to set X-Real-IP (nginx / the SSR server's network).
	TrustedProxies []netip.Prefix
	// Request deadlines (TZ BE-01): normal routes and the slow ones (PDF export).
	RequestTimeout     time.Duration
	SlowRequestTimeout time.Duration
	// Compress gzips responses in Go; only when nginx isn't in front (TZ BE-06).
	Compress bool
	// Storage is pinged by /readyz (TZ OPS-07); nil skips the check.
	Storage Pinger
	// Draining turns /readyz into 503 during graceful shutdown; nil means never.
	Draining *atomic.Bool

	AuthHandler    *auth.Handler
	UserHandler    *user.Handler
	CatalogHandler *catalog.Handler
	CompanyHandler *company.Handler
	VacancyHandler *vacancy.Handler
	ResumeHandler  *resume.Handler
	FileHandler    *file.Handler
	NotifyHandler  *notification.Handler
	ChatHandler    *chat.Handler
	SavedHandler   *savedsearch.Handler
	WSHandler      *realtime.Handler
	AppHandler     *application.Handler
}

// Request limits. api_ip and api_user are counted by the request gate for every API
// request; the others guard sensitive routes (password guessing, sign-up spam, codes).
var (
	apiIPRule   = ratelimit.Rule{Name: "api_ip", Limit: 1200, Window: time.Minute}
	authIPRule  = ratelimit.Rule{Name: "auth_ip", Limit: 30, Window: time.Minute}
	codeIPRule  = ratelimit.Rule{Name: "code_ip", Limit: 10, Window: 10 * time.Minute}
	apiUserRule = ratelimit.Rule{Name: "api_user", Limit: 600, Window: time.Minute}
)

func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(mw.RequestID, mw.ClientIP(d.TrustProxy, d.TrustedProxies), mw.Observe(d.Log), mw.Recover(d.Log),
		mw.CORS(d.CORSOrigins), mw.RejectBadURL)
	if d.RequestTimeout > 0 {
		r.Use(mw.Timeout(d.RequestTimeout, d.SlowRequestTimeout))
	}
	if d.Compress {
		r.Use(mw.Compress(5))
	}

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		response.Error(w, r, apperr.NotFound("route_not_found", "route not found"))
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		response.Error(w, r, apperr.New(http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed"))
	})

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	r.Get("/readyz", readiness(d))

	gate := &mw.Gate{RDB: d.Redis, Tokens: d.Auth.Tokens, IP: apiIPRule, User: apiUserRule, RevokedKey: auth.RevokedKey}
	r.Route("/api/v1", func(r chi.Router) {
		// One Redis round trip per request (TZ BE-09): the coarse per-IP ceiling for
		// everything and, with an access token, its revocation check and the per-user
		// ceiling. Stricter limits for sensitive routes are layered below.
		r.Use(gate.Middleware)

		r.Route("/catalog", d.CatalogHandler.Routes)
		r.Route("/companies", func(r chi.Router) {
			d.CompanyHandler.Routes(r, d.Auth)
			r.Route("/{company}/vacancies", func(r chi.Router) { d.VacancyHandler.CompanyRoutes(r, d.Auth) })
		})
		r.Route("/vacancies", func(r chi.Router) {
			d.VacancyHandler.Routes(r, d.Auth)
			r.Group(func(r chi.Router) {
				r.Use(d.Auth.Require)
				d.VacancyHandler.SavedRoutes(r)
				d.AppHandler.VacancyRoutes(r)
			})
		})
		r.Route("/search", d.VacancyHandler.SearchRoutes)
		d.NotifyHandler.WebhookRoutes(r)
		r.Route("/ws", func(r chi.Router) { d.WSHandler.Routes(r, d.Auth) })

		r.Route("/auth", func(r chi.Router) {
			r.Group(func(r chi.Router) {
				r.Use(mw.RateLimit(d.Limiter, authIPRule, mw.KeyByIP))
				d.AuthHandler.PublicRoutes(r)
			})
			r.Group(func(r chi.Router) {
				r.Use(d.Auth.Require, mw.RateLimit(d.Limiter, codeIPRule, mw.KeyByUser))
				d.AuthHandler.ProtectedRoutes(r)
			})
		})

		// Everything below requires a signed-in user.
		r.Group(func(r chi.Router) {
			r.Use(d.Auth.Require) // the per-user limit is counted by the gate
			r.Route("/me", func(r chi.Router) {
				d.UserHandler.Routes(r)
				d.AuthHandler.MeRoutes(r)
				d.CompanyHandler.MeRoutes(r)
				d.ResumeHandler.MeRoutes(r)
				d.AppHandler.MeRoutes(r)
				d.VacancyHandler.SavedMeRoutes(r)
				d.FileHandler.MeRoutes(r)
				d.NotifyHandler.MeRoutes(r)
				d.SavedHandler.MeRoutes(r)
			})
			r.Route("/files", d.FileHandler.Routes)
			r.Route("/resumes", func(r chi.Router) {
				d.ResumeHandler.Routes(r)
				d.AppHandler.ResumeRoutes(r)
			})
			r.Route("/applications", func(r chi.Router) {
				d.AppHandler.Routes(r)
				d.ChatHandler.ApplicationRoutes(r)
			})
			r.Route("/conversations", d.ChatHandler.Routes)
			r.Route("/messages", d.ChatHandler.MessageRoutes)
			r.Route("/admin", func(r chi.Router) {
				r.Use(mw.RequireRole("admin"))
				r.Route("/companies", d.CompanyHandler.AdminRoutes)
				r.Route("/vacancies", d.VacancyHandler.AdminRoutes)
				r.Route("/search", d.VacancyHandler.AdminSearchRoutes)
			})
		})
	})
	return r
}

// Pinger is a dependency /readyz checks (object storage).
type Pinger interface {
	Ping(ctx context.Context) error
}

// readiness is polled by Docker/nginx; it fails while Postgres, Redis or object storage
// are unreachable, and while the process drains before shutdown.
func readiness(d Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		status := map[string]string{"postgres": "ok", "redis": "ok"}
		code := http.StatusOK
		if err := d.DB.Ping(ctx); err != nil {
			status["postgres"], code = "down", http.StatusServiceUnavailable
		}
		if err := d.Redis.Ping(ctx).Err(); err != nil {
			status["redis"], code = "down", http.StatusServiceUnavailable
		}
		if d.Storage != nil {
			status["storage"] = "ok"
			if err := d.Storage.Ping(ctx); err != nil {
				status["storage"], code = "down", http.StatusServiceUnavailable
			}
		}
		if d.Draining != nil && d.Draining.Load() {
			status["api"], code = "draining", http.StatusServiceUnavailable
		}
		w.Header().Set("Cache-Control", "no-store")
		response.JSON(w, code, status)
	}
}
