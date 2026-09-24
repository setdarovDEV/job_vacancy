package logger

import (
	"bytes"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestRedactionLogSample(t *testing.T) {
	var buf bytes.Buffer
	log := slog.New(NewRedactHandler(slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})))
	uid := uuid.MustParse("01923456-7890-7abc-8def-123456789012")
	jwt := "eyJhbGciOiJIUzI1NiIsImtpZCI6ImsxIn0.eyJzaWQiOiJ4In0.c2lnbmF0dXJlLXNpZw"

	log.Warn("DEV: telegram verification code (not sent)", "phone", "+998901234567", "code", "482913")
	log.Info("DEV: push (not sent)", "token", "fcm-device-token-abc", "title", "Yangi xabar")
	log.Info("email queued", "to", "seeker@demo.uz", "user_id", uid)
	log.Error("smtp send failed", "err", errors.New("550 mailbox hr@demo.uz unavailable"))
	log.Info("telegram", "chat_id", int64(123456789), "refresh_token", "rt-secret", "password", "Secret123")
	log.Info("auth header", "header", "Bearer "+jwt, "raw", jwt)
	log.Info("login for admin@demo.uz from +998 phone 998901112233")
	log.With("email", "x.y@mail.ru").Info("scoped", slog.Group("req", "otp", "123456", "phone", "+998935556677"))

	out := buf.String()
	t.Log("\n" + out)
	for _, leak := range []string{
		"901234567", "482913", "fcm-device-token-abc", "seeker@demo.uz", "hr@demo.uz", "rt-secret",
		"Secret123", jwt, "admin@demo.uz", "998901112233", "x.y@mail.ru", "123456\n", "935556677", "123456789 ",
	} {
		if strings.Contains(out, leak) {
			t.Errorf("log leaks %q", leak)
		}
	}
	for _, keep := range []string{
		"+998*******67", "s***@demo.uz", "h***@demo.uz", uid.String(), "Yangi xabar", "a***@demo.uz",
		"chat_id=123****89", "title=",
	} {
		if !strings.Contains(out, keep) {
			t.Errorf("log lost %q", keep)
		}
	}
}

func TestScrubLeavesIdentifiersAlone(t *testing.T) {
	for _, s := range []string{
		"01923456-7890-7abc-8def-123456789012", // UUID with an all-digit segment
		"took 1234567890123456789ns",           // long digit run is not a phone
		"vacancy:list:abc123456789def",
		"plain message",
	} {
		if got := ScrubText(s); got != s {
			t.Errorf("ScrubText(%q) = %q, want unchanged", s, got)
		}
	}
}

func TestMaskers(t *testing.T) {
	if got := MaskEmail("seeker@demo.uz"); got != "s***@demo.uz" {
		t.Errorf("MaskEmail = %q", got)
	}
	if got := MaskDigits("+998901234567"); got != "+998*******67" {
		t.Errorf("MaskDigits = %q", got)
	}
	if got := MaskDigits("1234"); got != "****" {
		t.Errorf("MaskDigits(short) = %q", got)
	}
}
