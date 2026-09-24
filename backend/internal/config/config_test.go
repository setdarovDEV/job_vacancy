package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/caarlos0/env/v11"
)

// prodEnv is a production configuration that must be accepted.
func prodEnv() map[string]string {
	return map[string]string{
		"APP_ENV":                 "production",
		"WEB_URL":                 "https://jobvacancy.uz",
		"DATABASE_URL":            "postgres://jv:pw@db-1:5432/jobvacancy?sslmode=require",
		"JWT_SECRET":              strings.Repeat("Kx8-pQ2v", 6),
		"AUTH_COOKIE_SECURE":      "true",
		"TELEGRAM_GATEWAY_TOKEN":  "gateway-token",
		"TELEGRAM_WEBHOOK_SECRET": "Zq9v_2kLmN8pR4tX7yB1",
		"S3_ACCESS_KEY":           "jv-prod-access",
		"S3_SECRET_KEY":           "jv-prod-secret-9f8e7d",
		"SMTP_TLS":                "starttls",
		"HTTP_TRUST_PROXY":        "true",
	}
}

func parse(t *testing.T, vars map[string]string) (*Config, error) {
	t.Helper()
	var c Config
	if err := env.ParseWithOptions(&c, env.Options{Environment: vars}); err != nil {
		t.Fatalf("parse: %v", err)
	}
	return &c, c.validate()
}

func TestProductionRejectsUnsafeSettings(t *testing.T) {
	if _, err := parse(t, prodEnv()); err != nil {
		t.Fatalf("valid production config rejected: %v", err)
	}
	cases := []struct {
		name, key, value, want string
	}{
		{"dev jwt secret", "JWT_SECRET", "dev-only-secret-change-me-0123456789abcdef", "JWT_SECRET"},
		{"short jwt secret", "JWT_SECRET", "short", "JWT_SECRET"},
		{"default webhook secret", "TELEGRAM_WEBHOOK_SECRET", "dev-webhook-secret", "TELEGRAM_WEBHOOK_SECRET"},
		{"empty webhook secret", "TELEGRAM_WEBHOOK_SECRET", "", "TELEGRAM_WEBHOOK_SECRET"},
		{"weak webhook secret", "TELEGRAM_WEBHOOK_SECRET", "abc", "TELEGRAM_WEBHOOK_SECRET"},
		{"dev s3 access key", "S3_ACCESS_KEY", "jobvacancy", "S3_ACCESS_KEY"},
		{"dev s3 secret key", "S3_SECRET_KEY", "jobvacancy-secret", "S3_SECRET_KEY"},
		{"smtp without tls", "SMTP_TLS", "none", "SMTP_TLS"},
		{"no trusted proxy", "HTTP_TRUST_PROXY", "false", "HTTP_TRUST_PROXY"},
		{"insecure cookie", "AUTH_COOKIE_SECURE", "false", "AUTH_COOKIE_SECURE"},
		{"no sms gateway", "TELEGRAM_GATEWAY_TOKEN", "", "TELEGRAM_GATEWAY_TOKEN"},
		{"redaction off", "LOG_REDACT", "off", "LOG_REDACT"},
		{"http web url", "WEB_URL", "http://jobvacancy.uz", "WEB_URL"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			vars := prodEnv()
			vars[tc.key] = tc.value
			_, err := parse(t, vars)
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("want error about %s, got %v", tc.want, err)
			}
		})
	}
}

func TestProductionReportsEveryProblemAtOnce(t *testing.T) {
	vars := prodEnv()
	vars["SMTP_TLS"] = "none"
	vars["HTTP_TRUST_PROXY"] = "false"
	vars["S3_ACCESS_KEY"] = "jobvacancy"
	_, err := parse(t, vars)
	for _, want := range []string{"SMTP_TLS", "HTTP_TRUST_PROXY", "S3_ACCESS_KEY"} {
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("error %v does not mention %s", err, want)
		}
	}
}

func TestDevelopmentDefaultsAreAccepted(t *testing.T) {
	c, err := parse(t, map[string]string{
		"DATABASE_URL": "postgres://localhost/jv",
		"JWT_SECRET":   "dev-only-secret-change-me-0123456789abcdef",
	})
	if err != nil {
		t.Fatalf("dev defaults rejected: %v", err)
	}
	if !c.CompressEnabled() || c.RedactLogs() {
		t.Fatalf("dev: compress=%v redact=%v, want compress on and redaction off", c.CompressEnabled(), c.RedactLogs())
	}
	if c.HTTP.RequestTimeout.Seconds() != 8 || c.DB.StatementTimeout.Seconds() != 5 {
		t.Fatalf("unexpected deadlines: request %v statement %v", c.HTTP.RequestTimeout, c.DB.StatementTimeout)
	}
}

func TestProductionDefaultsDeriveFromProxy(t *testing.T) {
	c, err := parse(t, prodEnv())
	if err != nil {
		t.Fatal(err)
	}
	if c.CompressEnabled() || !c.RedactLogs() {
		t.Fatalf("prod: compress=%v redact=%v, want nginx to compress and logs redacted", c.CompressEnabled(), c.RedactLogs())
	}
}

func TestJWTRotationSettings(t *testing.T) {
	vars := prodEnv()
	vars["JWT_PREVIOUS_SECRET"] = strings.Repeat("old-key-", 5)
	if _, err := parse(t, vars); err == nil || !strings.Contains(err.Error(), "JWT_PREVIOUS_KID") {
		t.Fatalf("previous secret without kid accepted: %v", err)
	}
	vars["JWT_PREVIOUS_KID"] = "k1" // same as JWT_KID default
	if _, err := parse(t, vars); err == nil {
		t.Fatal("previous kid equal to current kid accepted")
	}
	vars["JWT_KID"] = "k2"
	if _, err := parse(t, vars); err != nil {
		t.Fatalf("valid rotation rejected: %v", err)
	}
}

// Load must not read .env in production: a stray file on the server can't inject values.
func TestLoadIgnoresDotenvInProduction(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte("APP_NAME=from-dotenv\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Chdir(dir)
	for k, v := range prodEnv() {
		t.Setenv(k, v)
	}
	t.Setenv("APP_NAME", "")
	os.Unsetenv("APP_NAME")

	c, err := Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if c.AppName == "from-dotenv" {
		t.Fatal(".env was read in production")
	}

	// The same process refuses to start with a development secret.
	t.Setenv("JWT_SECRET", "dev-only-secret-change-me-0123456789abcdef")
	if _, err := Load(); err == nil {
		t.Fatal("production start with the development JWT secret was allowed")
	}
}

func TestLoadReadsDotenvInDevelopment(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte("APP_NAME=from-dotenv\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Chdir(dir)
	t.Setenv("APP_ENV", "development")
	t.Setenv("DATABASE_URL", "postgres://localhost/jv")
	t.Setenv("JWT_SECRET", "dev-only-secret-change-me-0123456789abcdef")
	t.Setenv("APP_NAME", "")
	os.Unsetenv("APP_NAME")
	t.Cleanup(func() { os.Unsetenv("APP_NAME") })

	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if c.AppName != "from-dotenv" {
		t.Fatalf("AppName = %q, want value from .env", c.AppName)
	}
}
