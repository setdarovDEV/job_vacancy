package config

import (
	"strings"
	"testing"
)

func TestProductionTOTPKey(t *testing.T) {
	base := func() Config {
		var c Config
		c.Env = "production"
		c.Auth.JWTSecret = strings.Repeat("j", 32)
		c.Auth.CookieSecure = true
		c.Auth.Admin2FARequired = true
		return c
	}
	c := base()
	if err := c.validate(); err == nil || !strings.Contains(err.Error(), "TOTP_ENC_KEY") {
		t.Fatalf("missing key: %v", err)
	}
	c.Auth.TOTPEncKey = c.Auth.JWTSecret
	if err := c.validate(); err == nil || !strings.Contains(err.Error(), "differ") {
		t.Fatalf("same as JWT_SECRET: %v", err)
	}
	c.Auth.TOTPEncKey = strings.Repeat("t", 32)
	if err := c.validate(); err != nil {
		t.Fatalf("valid: %v", err)
	}
	dev := base()
	dev.Env = "development"
	if err := dev.validate(); err != nil {
		t.Fatalf("development may derive the key: %v", err)
	}
}

func TestTurnstileHostname(t *testing.T) {
	for in, want := range map[string]string{"": "jobvacancy.uz", "*": "", "other.uz": "other.uz"} {
		if got := (Captcha{TurnstileHostname: in}).Hostname("https://jobvacancy.uz"); got != want {
			t.Errorf("%q: got %q want %q", in, got, want)
		}
	}
}
