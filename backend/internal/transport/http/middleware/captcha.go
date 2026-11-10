package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"net/netip"
	"strings"

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

// CaptchaGuard puts Turnstile in front of endpoints bots like. Off (everything passes)
// without a verifier, i.e. without TURNSTILE_SECRET_KEY.
type CaptchaGuard struct {
	Verifier CaptchaVerifier
	Limiter  *ratelimit.Limiter
	Log      *slog.Logger
}

// Require asks web requests for a valid token. Requests marked X-Client-Type android|ios
// (the apps have no widget) skip it and pass the endpoint's own per-IP backstop instead:
// the header is spoofable, so that rule is what a bot claiming to be the app runs into,
// on top of the endpoint's per-account limits. Cloudflare outages fail closed (503).
func (g *CaptchaGuard) Require(mobile ratelimit.Rule) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if g == nil || g.Verifier == nil {
			return next
		}
		app := RateLimit(g.Limiter, mobile, KeyByIP)(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch strings.ToLower(r.Header.Get("X-Client-Type")) {
			case "android", "ios":
				app.ServeHTTP(w, r)
				return
			}
			token := strings.TrimSpace(r.Header.Get(CaptchaHeader))
			if token == "" || len(token) > 2048 {
				response.Error(w, r, ErrCaptchaRequired)
				return
			}
			ok, err := g.Verifier.Verify(r.Context(), token, reqctx.ClientIP(r.Context()))
			if err != nil {
				g.Log.WarnContext(r.Context(), "turnstile verify failed", "err", err)
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
