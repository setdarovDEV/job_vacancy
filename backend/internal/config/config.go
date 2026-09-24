// Package config loads all runtime settings from environment variables.
// In development a .env file is read first; in production real env vars are used.
package config

import (
	"errors"
	"fmt"
	"net/netip"
	"os"
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	Env     string `env:"APP_ENV" envDefault:"development"` // development | staging | production
	AppName string `env:"APP_NAME" envDefault:"Job Vacancy"`
	// Public URL of the web app, used in e-mail links and CORS.
	WebURL string `env:"WEB_URL" envDefault:"http://localhost:5180"`

	HTTP     HTTP
	DB       DB
	Redis    Redis
	Auth     Auth
	SMTP     SMTP
	Telegram Telegram
	S3       S3
	Log      Log
	Worker   Worker
	Search   Search
	Product  Product
}

type HTTP struct {
	Addr            string        `env:"HTTP_ADDR" envDefault:":8090"`
	ReadTimeout     time.Duration `env:"HTTP_READ_TIMEOUT" envDefault:"10s"`
	WriteTimeout    time.Duration `env:"HTTP_WRITE_TIMEOUT" envDefault:"30s"`
	IdleTimeout     time.Duration `env:"HTTP_IDLE_TIMEOUT" envDefault:"120s"`
	ShutdownTimeout time.Duration `env:"HTTP_SHUTDOWN_TIMEOUT" envDefault:"15s"`
	CORSOrigins     []string      `env:"HTTP_CORS_ORIGINS" envSeparator:"," envDefault:"http://localhost:5180"`
	// Trust X-Real-IP only when running behind our own nginx, and only from the peers in
	// TrustedProxies (nginx's network). X-Forwarded-For is never trusted (TZ SEC-02).
	TrustProxy     bool           `env:"HTTP_TRUST_PROXY" envDefault:"false"`
	TrustedProxies []netip.Prefix `env:"HTTP_TRUSTED_PROXIES" envSeparator:"," envDefault:"127.0.0.0/8,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,fc00::/7"`
	// Deadline for a whole request (WebSocket exempt, PDF export gets SlowRequestTimeout).
	RequestTimeout     time.Duration `env:"HTTP_REQUEST_TIMEOUT" envDefault:"8s"`
	SlowRequestTimeout time.Duration `env:"HTTP_SLOW_REQUEST_TIMEOUT" envDefault:"25s"`
	// gzip in Go: auto = on only when nginx is not in front (HTTP_TRUST_PROXY=false).
	Compress string `env:"HTTP_COMPRESS" envDefault:"auto"` // auto | on | off
	// On SIGTERM /readyz turns 503 for this long before the listener closes, so the load
	// balancer stops sending new requests first (rolling deploys).
	DrainDelay time.Duration `env:"HTTP_DRAIN_DELAY" envDefault:"0s"`
	// Serve /metrics on a separate address so it's never exposed through nginx.
	MetricsAddr string `env:"METRICS_ADDR" envDefault:"127.0.0.1:9091"`
}

type DB struct {
	URL string `env:"DATABASE_URL,required"`
	// 0 = the process default: api 20, worker = River workers + 5 (35), migrate/ctl pgx's.
	// Budget: Postgres max_connections=200 ≥ api instances × 20 + worker 35 + tools.
	MaxConns        int32         `env:"DB_MAX_CONNS" envDefault:"0"`
	MinConns        int32         `env:"DB_MIN_CONNS" envDefault:"2"`
	MaxConnLifetime time.Duration `env:"DB_MAX_CONN_LIFETIME" envDefault:"1h"`
	MaxConnIdleTime time.Duration `env:"DB_MAX_CONN_IDLE_TIME" envDefault:"15m"`
	// Server-side limits for the API and worker pools only (migrate/ctl run without them,
	// otherwise CREATE INDEX CONCURRENTLY and backfills would be cut off).
	StatementTimeout time.Duration `env:"DB_STATEMENT_TIMEOUT" envDefault:"5s"`
	LockTimeout      time.Duration `env:"DB_LOCK_TIMEOUT" envDefault:"3s"`
	IdleInTxTimeout  time.Duration `env:"DB_IDLE_IN_TX_TIMEOUT" envDefault:"10s"`
}

type Redis struct {
	URL string `env:"REDIS_URL" envDefault:"redis://localhost:6390/0"`
}

type Auth struct {
	// Access tokens are signed with JWTSecret and carry JWTKeyID as "kid". To rotate, move
	// the old pair to JWT_PREVIOUS_* (still accepted) and deploy a new JWT_SECRET/JWT_KID;
	// drop the previous pair after ACCESS_TOKEN_TTL.
	JWTSecret         string        `env:"JWT_SECRET,required"`
	JWTKeyID          string        `env:"JWT_KID" envDefault:"k1"`
	JWTPreviousSecret string        `env:"JWT_PREVIOUS_SECRET"`
	JWTPreviousKeyID  string        `env:"JWT_PREVIOUS_KID"`
	JWTIssuer         string        `env:"JWT_ISSUER" envDefault:"jobvacancy.uz"`
	AccessTokenTTL    time.Duration `env:"ACCESS_TOKEN_TTL" envDefault:"15m"`
	RefreshTokenTTL   time.Duration `env:"REFRESH_TOKEN_TTL" envDefault:"720h"` // 30 days
	// Refresh cookie for the web client; mobile clients receive the token in the body.
	CookieDomain string `env:"AUTH_COOKIE_DOMAIN" envDefault:""`
	CookieSecure bool   `env:"AUTH_COOKIE_SECURE" envDefault:"false"`
	// Google OAuth client IDs whose ID tokens we accept (web, android, ios).
	GoogleClientIDs []string `env:"GOOGLE_CLIENT_IDS" envSeparator:","`
}

type SMTP struct {
	Host     string `env:"SMTP_HOST" envDefault:"localhost"`
	Port     int    `env:"SMTP_PORT" envDefault:"1025"`
	Username string `env:"SMTP_USERNAME"`
	Password string `env:"SMTP_PASSWORD"`
	From     string `env:"SMTP_FROM" envDefault:"Job Vacancy <no-reply@jobvacancy.uz>"`
	// none | starttls | tls
	TLS string `env:"SMTP_TLS" envDefault:"none"`
}

type Telegram struct {
	// Telegram Gateway API token (https://gateway.telegram.org). Empty in development:
	// codes are then written to the log instead of being sent.
	GatewayToken string `env:"TELEGRAM_GATEWAY_TOKEN"`
	// Notification bot from @BotFather. Empty in development: messages are logged.
	BotToken    string `env:"TELEGRAM_BOT_TOKEN"`
	BotUsername string `env:"TELEGRAM_BOT_USERNAME" envDefault:"jobvacancy_uz_bot"`
	// Random string Telegram echoes back on every webhook call.
	WebhookSecret string `env:"TELEGRAM_WEBHOOK_SECRET" envDefault:"dev-webhook-secret"`
}

// S3 is any S3-compatible object store (MinIO in dev and on the VPS).
type S3 struct {
	Endpoint  string `env:"S3_ENDPOINT" envDefault:"localhost:9200"` // used by the server
	UseSSL    bool   `env:"S3_USE_SSL" envDefault:"false"`
	AccessKey string `env:"S3_ACCESS_KEY" envDefault:"jobvacancy"`
	SecretKey string `env:"S3_SECRET_KEY" envDefault:"jobvacancy-secret"`
	Region    string `env:"S3_REGION" envDefault:"us-east-1"`
	// Host that browsers and apps reach for presigned uploads/downloads.
	PublicEndpoint string `env:"S3_PUBLIC_ENDPOINT" envDefault:"localhost:9200"`
	PublicUseSSL   bool   `env:"S3_PUBLIC_USE_SSL" envDefault:"false"`
	PublicBucket   string `env:"S3_PUBLIC_BUCKET" envDefault:"jv-public"`
	PrivateBucket  string `env:"S3_PRIVATE_BUCKET" envDefault:"jv-private"`
	// Base URL of public objects (production: https://jobvacancy.uz/media).
	PublicBaseURL string `env:"S3_PUBLIC_BASE_URL" envDefault:"http://localhost:9200/jv-public"`
}

type Log struct {
	Level  string `env:"LOG_LEVEL" envDefault:"info"`
	Format string `env:"LOG_FORMAT" envDefault:"text"` // text | json
	// Mask tokens, codes, passwords, phones and e-mails in log lines (TZ SEC-09).
	// auto = on everywhere except APP_ENV=development (dev e2e reads codes from the log).
	Redact string `env:"LOG_REDACT" envDefault:"auto"` // auto | on | off
}

// Worker settings (cmd/worker).
type Worker struct {
	// River concurrency per queue; the worker's DB pool defaults to their sum + 5.
	CriticalWorkers int           `env:"WORKER_CRITICAL_WORKERS" envDefault:"10"`
	DefaultWorkers  int           `env:"WORKER_DEFAULT_WORKERS" envDefault:"20"`
	ShutdownTimeout time.Duration `env:"WORKER_SHUTDOWN_TIMEOUT" envDefault:"30s"`
	// /metrics and /healthz of the worker process (never exposed through nginx).
	MetricsAddr string `env:"WORKER_METRICS_ADDR" envDefault:"127.0.0.1:9092"`
}

// Search settings.
type Search struct {
	// A query appears in the public "popular searches" only after this many different
	// client IPs ran it within a week (TZ SEC-07). Local development sends everything from
	// 127.0.0.1, so .env may lower it to 1 there.
	PopularMinIPs int `env:"SEARCH_POPULAR_MIN_IPS" envDefault:"3"`
}

// Product rules of the MVP features.
type Product struct {
	// Version of the privacy policy / terms users agree to at sign-up (TZ FN-08). Bump it
	// when the text changes: accounts with an older consent get consent_outdated=true.
	ConsentVersion string `env:"LEGAL_CONSENT_VERSION" envDefault:"2026-09-24"`
	// Open reports from different users that send a published vacancy back to moderation
	// (TZ FN-02).
	ReportThreshold int `env:"REPORTS_AUTO_MODERATION" envDefault:"3"`
}

// Load reads .env (if present, never in production) and then the process environment.
func Load() (*Config, error) {
	if os.Getenv("APP_ENV") != "production" {
		_ = godotenv.Load() // missing .env is fine
	}
	var c Config
	if err := env.Parse(&c); err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}
	if err := c.validate(); err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}
	return &c, nil
}

func (c *Config) IsProduction() bool { return c.Env == "production" }

func (c *Config) validate() error {
	if len(c.Auth.JWTSecret) < 32 {
		return errors.New("JWT_SECRET must be at least 32 characters")
	}
	if err := c.validateCommon(); err != nil {
		return err
	}
	if c.IsProduction() {
		if !c.Auth.CookieSecure {
			return errors.New("AUTH_COOKIE_SECURE must be true in production")
		}
		if c.Telegram.GatewayToken == "" {
			return errors.New("TELEGRAM_GATEWAY_TOKEN is required in production")
		}
		return c.validateProduction()
	}
	return nil
}
