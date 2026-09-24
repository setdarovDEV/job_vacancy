package logger

import (
	"context"
	"log/slog"
	"regexp"
	"strconv"
	"strings"
)

// Redacted replaces secret values in log output.
const Redacted = "[REDACTED]"

// Attribute keys whose value is a secret and is dropped entirely.
var secretKeys = map[string]bool{
	"password": true, "pass": true, "secret": true, "token": true, "code": true, "otp": true,
	"ticket": true, "authorization": true, "cookie": true, "set-cookie": true, "api_key": true,
	"access_token": true, "refresh_token": true, "id_token": true, "signature": true,
}

// Attribute keys holding personal data that is masked but stays recognisable for support.
var (
	emailKeys = map[string]bool{"email": true, "to": true, "recipient": true}
	phoneKeys = map[string]bool{"phone": true, "phone_number": true, "chat_id": true}
)

var (
	emailRe  = regexp.MustCompile(`[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`)
	phoneRe  = regexp.MustCompile(`\+?\d{9,15}`)
	jwtRe    = regexp.MustCompile(`eyJ[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,}`)
	bearerRe = regexp.MustCompile(`(?i)(bearer\s+)[A-Za-z0-9._~+/\-]+=*`)
)

// redactHandler scrubs attributes and messages before they reach the real handler
// (TZ SEC-09): secrets by key, e-mails and phone numbers by key and inside free text
// (error messages from SMTP, Telegram, etc.).
type redactHandler struct{ next slog.Handler }

// NewRedactHandler wraps h so that it never sees secrets or full contact details.
func NewRedactHandler(h slog.Handler) slog.Handler { return &redactHandler{next: h} }

func (h *redactHandler) Enabled(ctx context.Context, l slog.Level) bool {
	return h.next.Enabled(ctx, l)
}

func (h *redactHandler) Handle(ctx context.Context, r slog.Record) error {
	out := slog.NewRecord(r.Time, r.Level, ScrubText(r.Message), r.PC)
	r.Attrs(func(a slog.Attr) bool {
		out.AddAttrs(redactAttr(a))
		return true
	})
	return h.next.Handle(ctx, out)
}

func (h *redactHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	clean := make([]slog.Attr, len(attrs))
	for i, a := range attrs {
		clean[i] = redactAttr(a)
	}
	return &redactHandler{next: h.next.WithAttrs(clean)}
}

func (h *redactHandler) WithGroup(name string) slog.Handler {
	return &redactHandler{next: h.next.WithGroup(name)}
}

func redactAttr(a slog.Attr) slog.Attr {
	v := a.Value.Resolve()
	key := strings.ToLower(a.Key)
	if v.Kind() == slog.KindGroup {
		attrs := v.Group()
		clean := make([]slog.Attr, len(attrs))
		for i, g := range attrs {
			clean[i] = redactAttr(g)
		}
		return slog.Attr{Key: a.Key, Value: slog.GroupValue(clean...)}
	}
	switch {
	case isSecretKey(key):
		return slog.String(a.Key, Redacted)
	case emailKeys[key]:
		return slog.String(a.Key, MaskEmail(valueString(v)))
	case phoneKeys[key]:
		return slog.String(a.Key, MaskDigits(valueString(v)))
	}
	switch v.Kind() {
	case slog.KindString:
		if s := v.String(); needsScrub(s) {
			return slog.String(a.Key, ScrubText(s))
		}
	case slog.KindAny:
		// errors and fmt.Stringers can carry addresses and tokens in their text
		var s string
		switch x := v.Any().(type) {
		case error:
			s = x.Error()
		case interface{ String() string }:
			s = x.String()
		default:
			return slog.Attr{Key: a.Key, Value: v}
		}
		if needsScrub(s) {
			return slog.String(a.Key, ScrubText(s))
		}
	}
	return slog.Attr{Key: a.Key, Value: v}
}

// Keys ending in "_code" are one-time codes unless they are one of these.
var nonSecretCodes = map[string]bool{"status_code": true, "error_code": true, "exit_code": true, "http_code": true}

func isSecretKey(k string) bool {
	return secretKeys[k] || strings.HasSuffix(k, "_token") || strings.HasSuffix(k, "_secret") ||
		strings.HasSuffix(k, "_password") || (strings.HasSuffix(k, "_code") && !nonSecretCodes[k])
}

func valueString(v slog.Value) string {
	if v.Kind() == slog.KindInt64 {
		return strconv.FormatInt(v.Int64(), 10)
	}
	return v.String()
}

// needsScrub is a cheap pre-check so ordinary log values never touch a regexp.
func needsScrub(s string) bool {
	if strings.ContainsAny(s, "@") || strings.Contains(s, "eyJ") || strings.Contains(strings.ToLower(s), "bearer") {
		return true
	}
	run := 0
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			if run++; run >= 9 {
				return true
			}
		} else {
			run = 0
		}
	}
	return false
}

// ScrubText masks e-mails, phone numbers and bearer/JWT tokens inside free text.
func ScrubText(s string) string {
	if !needsScrub(s) {
		return s
	}
	s = jwtRe.ReplaceAllString(s, Redacted)
	s = bearerRe.ReplaceAllString(s, "${1}"+Redacted)
	s = emailRe.ReplaceAllStringFunc(s, MaskEmail)
	return maskPhones(s)
}

// maskPhones masks standalone runs of 9-15 digits (optionally "+"-prefixed). Runs glued
// to letters, dashes or more digits are ids, hashes or UUID segments and stay intact.
func maskPhones(s string) string {
	locs := phoneRe.FindAllStringIndex(s, -1)
	if locs == nil {
		return s
	}
	var b strings.Builder
	last := 0
	for _, l := range locs {
		start, end := l[0], l[1]
		if (start > 0 && isIDChar(s[start-1])) || (end < len(s) && isIDChar(s[end])) {
			continue
		}
		b.WriteString(s[last:start])
		b.WriteString(MaskDigits(s[start:end]))
		last = end
	}
	b.WriteString(s[last:])
	return b.String()
}

func isIDChar(c byte) bool {
	return c >= '0' && c <= '9' || c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c == '-' || c == '_'
}

// MaskEmail keeps the first character of the local part and the domain:
// "seeker@demo.uz" → "s***@demo.uz".
func MaskEmail(s string) string {
	local, domain, ok := strings.Cut(s, "@")
	if !ok || local == "" {
		return "***"
	}
	return local[:1] + "***@" + domain
}

// MaskDigits keeps a leading "+", the first 3 and the last 2 digits of a phone number or
// chat id: "+998901234567" → "+998*******67".
func MaskDigits(s string) string {
	plus := strings.HasPrefix(s, "+")
	d := strings.TrimPrefix(s, "+")
	if len(d) <= 5 {
		return strings.Repeat("*", len(s))
	}
	masked := d[:3] + strings.Repeat("*", len(d)-5) + d[len(d)-2:]
	if plus {
		return "+" + masked
	}
	return masked
}
