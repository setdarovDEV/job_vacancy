package config

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"slices"
	"strings"
)

// Placeholder values shipped in .env.example, docker-compose.dev.yml and CI. They are fine
// on a laptop and fatal on the internet (TZ SEC-01).
var (
	devJWTSecrets = []string{
		"dev-only-secret-change-me-0123456789abcdef",
		"ci-secret-0123456789abcdef0123456789abcdef",
	}
	devWebhookSecrets = []string{"", "dev-webhook-secret"}
	devS3Keys         = []string{"jobvacancy", "jobvacancy-secret", "minioadmin"}
	// Telegram accepts 1-256 characters A-Z, a-z, 0-9, _ and - as a webhook secret_token.
	webhookSecretRe = regexp.MustCompile(`^[A-Za-z0-9_-]{16,256}$`)
)

// CompressEnabled reports whether the API gzips responses itself. In production nginx
// compresses (brotli + gzip), so Go only does it when nothing sits in front (dev/staging).
func (c *Config) CompressEnabled() bool {
	switch c.HTTP.Compress {
	case "on":
		return true
	case "off":
		return false
	default:
		return !c.HTTP.TrustProxy
	}
}

// RedactLogs reports whether log lines are scrubbed of secrets and personal data.
func (c *Config) RedactLogs() bool {
	switch c.Log.Redact {
	case "on":
		return true
	case "off":
		return false
	default:
		return c.Env != "development"
	}
}

// validateCommon checks settings whose invalid values are bugs in any environment.
func (c *Config) validateCommon() error {
	var errs []error
	oneOf := func(name, v string, allowed ...string) {
		if !slices.Contains(allowed, v) {
			errs = append(errs, fmt.Errorf("%s must be one of %s (got %q)", name, strings.Join(allowed, ", "), v))
		}
	}
	oneOf("HTTP_COMPRESS", c.HTTP.Compress, "auto", "on", "off")
	oneOf("LOG_REDACT", c.Log.Redact, "auto", "on", "off")
	oneOf("SMTP_TLS", c.SMTP.TLS, "none", "starttls", "tls")

	if c.Auth.JWTKeyID == "" {
		errs = append(errs, errors.New("JWT_KID must not be empty"))
	}
	if c.Auth.JWTPreviousSecret != "" {
		if len(c.Auth.JWTPreviousSecret) < 32 {
			errs = append(errs, errors.New("JWT_PREVIOUS_SECRET must be at least 32 characters"))
		}
		if c.Auth.JWTPreviousKeyID == "" || c.Auth.JWTPreviousKeyID == c.Auth.JWTKeyID {
			errs = append(errs, errors.New("JWT_PREVIOUS_KID must be set and differ from JWT_KID"))
		}
		if c.Auth.JWTPreviousSecret == c.Auth.JWTSecret {
			errs = append(errs, errors.New("JWT_PREVIOUS_SECRET must differ from JWT_SECRET"))
		}
	}
	if c.HTTP.TrustProxy && len(c.HTTP.TrustedProxies) == 0 {
		errs = append(errs, errors.New("HTTP_TRUSTED_PROXIES must list nginx's network when HTTP_TRUST_PROXY=true"))
	}
	if c.HTTP.RequestTimeout <= 0 || c.HTTP.SlowRequestTimeout < c.HTTP.RequestTimeout {
		errs = append(errs, errors.New("HTTP_REQUEST_TIMEOUT must be > 0 and ≤ HTTP_SLOW_REQUEST_TIMEOUT"))
	}
	if c.DB.MaxConns < 0 || c.DB.StatementTimeout < 0 || c.DB.LockTimeout < 0 || c.DB.IdleInTxTimeout < 0 {
		errs = append(errs, errors.New("DB_MAX_CONNS and DB_*_TIMEOUT must not be negative"))
	}
	if c.Worker.CriticalWorkers < 1 || c.Worker.DefaultWorkers < 1 {
		errs = append(errs, errors.New("WORKER_CRITICAL_WORKERS and WORKER_DEFAULT_WORKERS must be ≥ 1"))
	}
	return errors.Join(errs...)
}

// validateProduction refuses to start with development defaults (TZ SEC-01). Every
// problem is reported at once so a broken deploy is fixed in one round.
func (c *Config) validateProduction() error {
	var errs []error
	bad := func(format string, a ...any) { errs = append(errs, fmt.Errorf(format, a...)) }

	if slices.Contains(devJWTSecrets, c.Auth.JWTSecret) || strings.Contains(strings.ToLower(c.Auth.JWTSecret), "change-me") {
		bad("JWT_SECRET is a development placeholder; generate one with: openssl rand -base64 48")
	}
	if c.Auth.JWTPreviousSecret != "" && slices.Contains(devJWTSecrets, c.Auth.JWTPreviousSecret) {
		bad("JWT_PREVIOUS_SECRET is a development placeholder")
	}
	if slices.Contains(devWebhookSecrets, c.Telegram.WebhookSecret) || !webhookSecretRe.MatchString(c.Telegram.WebhookSecret) {
		bad("TELEGRAM_WEBHOOK_SECRET must be a random 16-256 character [A-Za-z0-9_-] string, not the default")
	}
	if slices.Contains(devS3Keys, c.S3.AccessKey) || slices.Contains(devS3Keys, c.S3.SecretKey) {
		bad("S3_ACCESS_KEY / S3_SECRET_KEY must not be the development credentials")
	}
	if c.SMTP.TLS == "none" {
		bad("SMTP_TLS=none sends mail in clear text; use starttls or tls")
	}
	if !c.HTTP.TrustProxy {
		bad("HTTP_TRUST_PROXY must be true behind nginx, otherwise every client shares one IP for rate limits")
	}
	if c.Log.Redact == "off" {
		bad("LOG_REDACT=off would write tokens, codes and personal data to production logs")
	}
	if u, err := url.Parse(c.WebURL); err != nil || u.Scheme != "https" {
		bad("WEB_URL must be an https URL in production (got %q)", c.WebURL)
	}
	return errors.Join(errs...)
}
