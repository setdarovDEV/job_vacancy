// Package app wires dependencies for each binary (api, worker, migrate).
package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sync/atomic"
	"time"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/config"
	"jobvacancy.uz/backend/internal/jobs"
	"jobvacancy.uz/backend/internal/modules/account"
	"jobvacancy.uz/backend/internal/modules/admin"
	"jobvacancy.uz/backend/internal/modules/application"
	"jobvacancy.uz/backend/internal/modules/auth"
	"jobvacancy.uz/backend/internal/modules/catalog"
	"jobvacancy.uz/backend/internal/modules/chat"
	"jobvacancy.uz/backend/internal/modules/company"
	"jobvacancy.uz/backend/internal/modules/file"
	"jobvacancy.uz/backend/internal/modules/media"
	"jobvacancy.uz/backend/internal/modules/notification"
	"jobvacancy.uz/backend/internal/modules/report"
	"jobvacancy.uz/backend/internal/modules/resume"
	"jobvacancy.uz/backend/internal/modules/savedsearch"
	"jobvacancy.uz/backend/internal/modules/telemetry"
	"jobvacancy.uz/backend/internal/modules/user"
	"jobvacancy.uz/backend/internal/modules/vacancy"
	"jobvacancy.uz/backend/internal/pkg/otp"
	"jobvacancy.uz/backend/internal/pkg/ratelimit"
	"jobvacancy.uz/backend/internal/platform/metrics"
	"jobvacancy.uz/backend/internal/platform/postgres"
	"jobvacancy.uz/backend/internal/platform/redis"
	"jobvacancy.uz/backend/internal/platform/storage"
	"jobvacancy.uz/backend/internal/platform/telegram"
	"jobvacancy.uz/backend/internal/platform/turnstile"
	"jobvacancy.uz/backend/internal/realtime"
	httpapi "jobvacancy.uz/backend/internal/transport/http"
	mw "jobvacancy.uz/backend/internal/transport/http/middleware"
)

// RunAPI starts the HTTP API and blocks until ctx is cancelled, then drains connections.
func RunAPI(ctx context.Context, cfg *config.Config, log *slog.Logger) error {
	pool, err := postgres.NewPool(ctx, cfg.DB, postgres.Named("api"), postgres.DefaultMaxConns(APIPoolSize),
		postgres.WithSessionLimits())
	if err != nil {
		return err
	}
	defer pool.Close()

	rdb, err := redis.New(ctx, cfg.Redis.URL)
	if err != nil {
		return err
	}
	defer rdb.Close()
	registerPoolMetrics(ctx, "api", pool, rdb, log)

	enq, err := jobs.NewEnqueuer(pool, log)
	if err != nil {
		return fmt.Errorf("river: %w", err)
	}

	google, err := auth.NewGoogleVerifier(ctx, cfg.Auth.GoogleClientIDs)
	if err != nil {
		return err
	}
	if google == nil {
		log.Warn("GOOGLE_CLIENT_IDS not set: Google sign-in disabled")
	}

	var phoneSender telegram.CodeSender = telegram.NewGateway(cfg.Telegram.GatewayToken)
	if cfg.Telegram.GatewayToken == "" {
		log.Warn("TELEGRAM_GATEWAY_TOKEN not set: phone codes are logged, not sent")
		phoneSender = telegram.LogSender{Log: log}
	}

	st, err := storage.New(cfg.S3)
	if err != nil {
		return err
	}
	if err := st.EnsureBuckets(ctx); err != nil {
		return err
	}

	// TZ SEC-04: repeated failed sign-ins need a Cloudflare Turnstile captcha.
	var captcha auth.CaptchaVerifier
	if cfg.Auth.TurnstileSecret != "" {
		captcha = turnstile.New(cfg.Auth.TurnstileSecret, cfg.TurnstileHost())
	} else {
		log.Warn("TURNSTILE_SECRET not set: no captcha after failed sign-ins, only delays")
	}

	q := gen.New(pool)
	tokens := accessTokens(cfg.Auth)
	revoked := auth.NewRevocationStore(rdb, cfg.Auth.AccessTokenTTL)
	limiter := ratelimit.New(rdb)

	authSvc := &auth.Service{
		Q:          q,
		Tokens:     tokens,
		OTP:        otp.NewStore(rdb, cfg.Auth.JWTSecret),
		Revoked:    revoked,
		Emails:     enq,
		Phone:      phoneSender,
		Google:     google,
		Guard:      auth.NewLoginGuard(rdb, captcha, log),
		RefreshTTL: cfg.Auth.RefreshTokenTTL,
		// TZ FN-08: sign-up records consent to this privacy policy version.
		ConsentVersion: cfg.Product.ConsentVersion,
		Log:            log,
	}
	user.SetConsentVersion(cfg.Product.ConsentVersion)

	var bot telegram.Bot = telegram.LogBot{Log: log}
	if cfg.Telegram.BotToken != "" {
		bot = telegram.NewBot(cfg.Telegram.BotToken, cfg.Telegram.BotUsername)
	} else {
		log.Warn("TELEGRAM_BOT_TOKEN not set: bot messages are logged, not sent")
	}
	publisher := &realtime.Publisher{RDB: rdb}
	notifySvc := &notification.Service{Pool: pool, Q: q, Publisher: publisher, Jobs: enq, Log: log}

	catalogSvc := &catalog.Service{Q: q, Log: log}
	if err := catalogSvc.Start(ctx); err != nil {
		return err
	}
	publicCache := vacancy.NewPublicCache(rdb, log)
	publicCache.PopularMinIPs = cfg.Search.PopularMinIPs
	companySvc := &company.Service{Pool: pool, Q: q, Catalog: catalogSvc, Notify: notifySvc, Limiter: limiter,
		// Profile, logo and verification changes show on vacancy pages and cards too.
		Changed: func(ctx context.Context, c gen.Company) { publicCache.CompanyChanged(ctx, q, c) }}
	vacancySvc := &vacancy.Service{
		Pool: pool, Q: q, Companies: companySvc, Catalog: catalogSvc,
		Views:  &vacancy.ViewCounter{RDB: rdb},
		Cache:  publicCache,
		Notify: notifySvc,
		Log:    log,
	}

	fileSvc := &file.Service{Q: q, Storage: st, Log: log}
	// TZ BE-14: avatars, logos and covers are published by the worker as WebP variants.
	mediaSvc := &media.Service{Pool: pool, Q: q, Files: fileSvc, Storage: st, Jobs: enq, RDB: rdb, Log: log,
		CompanyChanged: func(ctx context.Context, c gen.Company) { publicCache.CompanyChanged(ctx, q, c) }}
	resumeSvc := &resume.Service{Pool: pool, Q: q, Catalog: catalogSvc}
	hub := realtime.NewHub(ctx, rdb, log)
	hub.Audience = realtime.DBAudience{Q: q} // TZ SEC-05: presence only among conversation partners
	hub.RevokedKey = auth.RevokedKey         // TZ BE-15: revoked sessions lose their sockets
	defer hub.Close()
	chatSvc := &chat.Service{Pool: pool, Q: q, Companies: companySvc, Files: fileSvc, Publisher: publisher,
		Hub: hub, Notify: notifySvc, RDB: rdb, Log: log}
	appSvc := &application.Service{
		Pool: pool, Q: q, Companies: companySvc, Resumes: resumeSvc, Vacancies: vacancySvc,
		Notify: notifySvc, Log: log,
	}

	adminSvc := &admin.Service{Pool: pool, Q: q, Companies: companySvc, Revoked: revoked, Cache: publicCache,
		Jobs: enq, Log: log}
	reportSvc := &report.Service{Pool: pool, Q: q, Limiter: limiter, Vacancies: vacancySvc, Notify: notifySvc,
		Threshold: cfg.Product.ReportThreshold, Log: log}
	accountSvc := &account.Service{Pool: pool, Q: q, Limiter: limiter, Revoked: revoked, Jobs: enq, Cache: publicCache,
		PublicBucket: st.PublicBucket(), Log: log}
	if google != nil {
		accountSvc.Google = google
	}
	cookie := auth.CookieConfig{Domain: cfg.Auth.CookieDomain, Secure: cfg.Auth.CookieSecure}

	var draining atomic.Bool
	handler := httpapi.NewRouter(httpapi.Deps{
		Log:         log,
		DB:          pool,
		Redis:       rdb,
		Limiter:     limiter,
		Auth:        &mw.Authenticator{Tokens: tokens, Revoked: revoked},
		CORSOrigins: cfg.HTTP.CORSOrigins,
		TrustProxy:  cfg.HTTP.TrustProxy,

		TrustedProxies:     cfg.HTTP.TrustedProxies,
		RequestTimeout:     cfg.HTTP.RequestTimeout,
		SlowRequestTimeout: cfg.HTTP.SlowRequestTimeout,
		Compress:           cfg.CompressEnabled(),
		Storage:            st,
		Draining:           &draining,
		AuthHandler:        &auth.Handler{Svc: authSvc, Cookie: cookie, CaptchaSiteKey: cfg.Auth.TurnstileSiteKey},
		AccountHandler:     &account.Handler{Svc: accountSvc, Cookie: cookie},
		AdminHandler:       &admin.Handler{Svc: adminSvc, StatsCache: admin.NewStatsCache(rdb, log)},
		ReportHandler:      &report.Handler{Svc: reportSvc},
		UserHandler:        &user.Handler{Q: q, Presence: hub},
		CatalogHandler:     &catalog.Handler{Svc: catalogSvc},
		CompanyHandler: &company.Handler{Svc: companySvc, Files: fileSvc, Media: mediaSvc, Cache: publicCache.Company,
			Directory: &company.Directory{Q: q, RDB: rdb, Log: log}},
		FileHandler: &file.Handler{Svc: fileSvc, Avatars: mediaSvc},
		ChatHandler: &chat.Handler{Svc: chatSvc},
		SavedHandler: &savedsearch.Handler{Svc: &savedsearch.Service{Q: q, Vacancies: vacancySvc,
			Notify: notifySvc, Log: log}},
		WSHandler: &realtime.Handler{Hub: hub, RDB: rdb, Frames: chatSvc, Origins: cfg.HTTP.CORSOrigins, Log: log},
		NotifyHandler: &notification.Handler{Svc: notifySvc, RDB: rdb, Bot: bot,
			WebhookSecret: cfg.Telegram.WebhookSecret},
		VacancyHandler:   &vacancy.Handler{Svc: vacancySvc},
		ResumeHandler:    &resume.Handler{Svc: resumeSvc},
		AppHandler:       &application.Handler{Svc: appSvc},
		TelemetryHandler: &telemetry.Handler{},
	})

	srv := &http.Server{
		Addr:              cfg.HTTP.Addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       cfg.HTTP.ReadTimeout,
		WriteTimeout:      cfg.HTTP.WriteTimeout,
		IdleTimeout:       cfg.HTTP.IdleTimeout,
		MaxHeaderBytes:    1 << 16,
	}

	go metrics.Serve(ctx, cfg.HTTP.MetricsAddr, log)

	errCh := make(chan error, 1)
	go func() {
		log.Info("api listening", "addr", cfg.HTTP.Addr, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}
	// Fail /readyz first so the load balancer stops routing here, then close the listener
	// and let in-flight requests finish (TZ OPS-07).
	draining.Store(true)
	log.Info("shutting down api", "drain_delay", cfg.HTTP.DrainDelay)
	time.Sleep(cfg.HTTP.DrainDelay)
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.HTTP.ShutdownTimeout)
	defer cancel()
	// http.Server.Shutdown doesn't track hijacked (WebSocket) connections: close them with
	// 1012 first so clients reconnect to another instance and fetch what they missed over
	// REST (TZ BE-15), then drain the plain requests.
	wsCtx, wsCancel := context.WithTimeout(shutdownCtx, 6*time.Second)
	n := hub.Shutdown(wsCtx)
	wsCancel()
	log.Info("websocket connections closed", "count", n)
	return srv.Shutdown(shutdownCtx)
}
