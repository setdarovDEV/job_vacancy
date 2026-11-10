// Package config loads all runtime settings from environment variables.
// In development a .env file is read first; in production real env vars are used.
package config

import (
	"errors"
	"fmt"
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
	AI       AI
	Log      Log
	Sentry   Sentry
	Captcha  Captcha
}

// Sentry error tracking; off while DSN is empty.
type Sentry struct {
	DSN     string `env:"SENTRY_DSN"`
	Release string `env:"SENTRY_RELEASE"` // e.g. the deployed image tag
}

// Captcha is Cloudflare Turnstile; off while the secret is empty.
type Captcha struct {
	TurnstileSecret string `env:"TURNSTILE_SECRET_KEY"`
}

type HTTP struct {
	Addr            string        `env:"HTTP_ADDR" envDefault:":8090"`
	ReadTimeout     time.Duration `env:"HTTP_READ_TIMEOUT" envDefault:"10s"`
	WriteTimeout    time.Duration `env:"HTTP_WRITE_TIMEOUT" envDefault:"30s"`
	IdleTimeout     time.Duration `env:"HTTP_IDLE_TIMEOUT" envDefault:"120s"`
	ShutdownTimeout time.Duration `env:"HTTP_SHUTDOWN_TIMEOUT" envDefault:"15s"`
	CORSOrigins     []string      `env:"HTTP_CORS_ORIGINS" envSeparator:"," envDefault:"http://localhost:5180"`
	// Trust X-Forwarded-For / X-Real-IP only when running behind our own nginx.
	TrustProxy bool `env:"HTTP_TRUST_PROXY" envDefault:"false"`
	// Serve /metrics on a separate address so it's never exposed through nginx.
	MetricsAddr string `env:"METRICS_ADDR" envDefault:"127.0.0.1:9091"`
}

type DB struct {
	URL             string        `env:"DATABASE_URL,required"`
	MaxConns        int32         `env:"DB_MAX_CONNS" envDefault:"25"`
	MinConns        int32         `env:"DB_MIN_CONNS" envDefault:"2"`
	MaxConnLifetime time.Duration `env:"DB_MAX_CONN_LIFETIME" envDefault:"1h"`
	MaxConnIdleTime time.Duration `env:"DB_MAX_CONN_IDLE_TIME" envDefault:"15m"`
}

type Redis struct {
	URL string `env:"REDIS_URL" envDefault:"redis://localhost:6390/0"`
}

type Auth struct {
	JWTSecret       string        `env:"JWT_SECRET,required"`
	JWTIssuer       string        `env:"JWT_ISSUER" envDefault:"jobvacancy.uz"`
	AccessTokenTTL  time.Duration `env:"ACCESS_TOKEN_TTL" envDefault:"15m"`
	RefreshTokenTTL time.Duration `env:"REFRESH_TOKEN_TTL" envDefault:"720h"` // 30 days
	// Refresh cookie for the web client; mobile clients receive the token in the body.
	CookieDomain string `env:"AUTH_COOKIE_DOMAIN" envDefault:""`
	CookieSecure bool   `env:"AUTH_COOKIE_SECURE" envDefault:"false"`
	// Google OAuth client IDs whose ID tokens we accept (web, android, ios).
	GoogleClientIDs []string `env:"GOOGLE_CLIENT_IDS" envSeparator:","`
	// Key that seals TOTP secrets at rest (>= 32 characters). Empty: derived from JWT_SECRET,
	// which then must never change, or every enrolled admin has to enroll again.
	TOTPEncKey string `env:"TOTP_ENC_KEY"`
	// Admins must have two-factor sign-in on to use /admin. Only for local development can
	// it be turned off (the e2e suites sign in as freshly made admins).
	Admin2FARequired bool `env:"ADMIN_2FA_REQUIRED" envDefault:"true"`
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
	// Team chat that receives new feedback (needs the bot token); 0 = off.
	FeedbackChatID int64 `env:"FEEDBACK_TELEGRAM_CHAT_ID"`
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

type AI struct {
	// Anthropic API key. Empty in development: the service returns a placeholder.
	AnthropicAPIKey string `env:"ANTHROPIC_API_KEY"`
	Model           string `env:"AI_MODEL" envDefault:"claude-3-5-sonnet-20241022"`
	MaxTokens       int    `env:"AI_MAX_TOKENS" envDefault:"1024"`
}

type Log struct {
	Level  string `env:"LOG_LEVEL" envDefault:"info"`
	Format string `env:"LOG_FORMAT" envDefault:"text"` // text | json
}

// Load reads .env (if present) and then the process environment.
func Load() (*Config, error) {
	_ = godotenv.Load() // missing .env is fine
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
	if c.Auth.TOTPEncKey != "" && len(c.Auth.TOTPEncKey) < 32 {
		return errors.New("TOTP_ENC_KEY must be at least 32 characters")
	}
	if c.IsProduction() {
		if !c.Auth.CookieSecure {
			return errors.New("AUTH_COOKIE_SECURE must be true in production")
		}
		if !c.Auth.Admin2FARequired {
			return errors.New("ADMIN_2FA_REQUIRED cannot be turned off in production")
		}
	}
	return nil
}
