package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"net/netip"
	"strings"
	"time"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/ratelimit"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

// CaptchaHeader carries the Turnstile token from the web client.
const CaptchaHeader = "X-Turnstile-Token"

var (
	ErrCaptchaRequired    = apperr.BadRequest("captcha_required", "complete the check that you are not a robot")
	ErrCaptchaInvalid     = apperr.BadRequest("captcha_invalid", "the robot check failed, try again")
	ErrCaptchaUnavailable = apperr.New(http.StatusServiceUnavailable, "captcha_unavailable", "the robot check is unavailable, try again later")
)

// CaptchaVerifier is the siteverify call (turnstile.Client).
type CaptchaVerifier interface {
	Verify(ctx context.Context, token string, ip netip.Addr) (bool, error)
}

// Mobile apps have no Turnstile widget; they get this stricter per-IP limit instead.
var mobileCaptchaRule = ratelimit.Rule{Name: "captcha_mobile", Limit: 10, Window: 10 * time.Minute}

// Captcha requires a valid Turnstile token on web requests. With a nil verifier (no
// TURNSTILE_SECRET_KEY) it lets everything through. Requests marked X-Client-Type
// android|ios skip the check but share a tighter per-IP budget: the header is
// spoofable, so this only trades the CAPTCHA for a hard rate limit.
// Cloudflare outages fail closed (503).
func Captcha(v CaptchaVerifier, l *ratelimit.Limiter, log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if v == nil {
			return next
		}
		mobile := RateLimit(l, mobileCaptchaRule, KeyByIP)(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch strings.ToLower(r.Header.Get("X-Client-Type")) {
			case "android", "ios":
				mobile.ServeHTTP(w, r)
				return
			}
			token := strings.TrimSpace(r.Header.Get(CaptchaHeader))
			if token == "" || len(token) > 2048 {
				response.Error(w, r, ErrCaptchaRequired)
				return
			}
			ok, err := v.Verify(r.Context(), token, reqctx.ClientIP(r.Context()))
			if err != nil {
				log.WarnContext(r.Context(), "turnstile verify failed", "err", err)
				response.Error(w, r, ErrCaptchaUnavailable)
				return
			}
			if !ok {
				response.Error(w, r, ErrCaptchaInvalid)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
