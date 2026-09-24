package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"net/netip"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/internal/pkg/apperr"
)

// Login protection without lockouts (TZ SEC-04).
//
// A hard lock per e-mail lets anyone lock the owner out by typing wrong passwords, and a
// strict lock per IP punishes everyone behind a carrier's CGNAT address. Instead failed
// sign-ins are counted, for 15 minutes, per e-mail (from anywhere), per client IP (for any
// e-mail) and per IP+e-mail pair, and they only ever make signing in slower or ask for a
// captcha; the right password always works:
//
//   - the pair's first 3 failures are free, then each attempt waits 0.5 s, 1 s, 2 s, 4 s
//     (capped) before the password is checked. Someone guessing from another address
//     doesn't slow the owner down;
//   - after 5 failures on an e-mail, or 20 from one IP, the next attempt needs a solved
//     Cloudflare Turnstile captcha (when TURNSTILE_SECRET is set). A solved captcha skips
//     the delay. Without a captcha the same thresholds add a delay instead;
//   - a successful sign-in clears the pair's and the e-mail's counters.
//
// The hard per-IP ceiling for the login route (login_ip) stays in the router, sized so
// ~50 people behind one address can sign in within the same minute.

// CaptchaVerifier checks a captcha token (turnstile.Verifier).
type CaptchaVerifier interface {
	Verify(ctx context.Context, token string, ip netip.Addr) (bool, error)
}

var (
	ErrCaptchaRequired = apperr.Forbidden("captcha_required", "too many failed sign-ins: solve the captcha and try again")
	ErrCaptchaInvalid  = apperr.Forbidden("captcha_invalid", "the captcha could not be verified, try again")
)

// LoginGuard counts failed sign-ins in Redis and decides on delays and captchas.
type LoginGuard struct {
	RDB     *redis.Client
	Captcha CaptchaVerifier // nil: captcha disabled, thresholds only add delays
	Log     *slog.Logger

	Window         time.Duration // how long failures are remembered
	FreeFailures   int64         // per IP+e-mail pair before delays start
	CaptchaAfter   int64         // failures on one e-mail
	IPCaptchaAfter int64         // failures from one IP
	BaseDelay      time.Duration
	MaxDelay       time.Duration

	// sleep waits d or until ctx ends (tests replace it).
	sleep func(ctx context.Context, d time.Duration) error
}

// NewLoginGuard returns the guard with the TZ SEC-04 settings.
func NewLoginGuard(rdb *redis.Client, captcha CaptchaVerifier, log *slog.Logger) *LoginGuard {
	return &LoginGuard{RDB: rdb, Captcha: captcha, Log: log, Window: 15 * time.Minute,
		FreeFailures: 3, CaptchaAfter: 5, IPCaptchaAfter: 20,
		BaseDelay: 500 * time.Millisecond, MaxDelay: 4 * time.Second}
}

var (
	loginGuardEvents = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "login_guard_total",
		Help: "Sign-in protection decisions (TZ SEC-04) by result.",
	}, []string{"result"})
	loginGuardDelay = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "login_guard_delay_seconds",
		Help:    "Delay added before checking a password after earlier failures.",
		Buckets: []float64{.5, 1, 2, 4},
	})
)

// LoginState is what the counters say about one attempt.
type LoginState struct {
	Pair, Email, IP int64
}

func emailTag(email string) string {
	h := sha256.Sum256([]byte(email))
	return hex.EncodeToString(h[:12]) // e-mails never appear in Redis keys
}

func (g *LoginGuard) keys(ip netip.Addr, email string) []string {
	e := emailTag(email)
	return []string{"lg:p:" + ip.String() + ":" + e, "lg:e:" + e, "lg:i:" + ip.String()}
}

// State reads the three counters in one round trip. Redis errors read as zero (fail open).
func (g *LoginGuard) State(ctx context.Context, ip netip.Addr, email string) LoginState {
	vals, err := g.RDB.MGet(ctx, g.keys(ip, email)...).Result()
	if err != nil {
		g.Log.WarnContext(ctx, "login guard unavailable", "err", err)
		return LoginState{}
	}
	n := func(v any) int64 {
		s, _ := v.(string)
		x, _ := strconv.ParseInt(s, 10, 64)
		return x
	}
	return LoginState{Pair: n(vals[0]), Email: n(vals[1]), IP: n(vals[2])}
}

// NeedsCaptcha reports whether the attempt must carry a solved captcha.
func (g *LoginGuard) NeedsCaptcha(st LoginState) bool {
	return g.Captcha != nil && (st.Email >= g.CaptchaAfter || st.IP >= g.IPCaptchaAfter)
}

// Delay is how long the attempt waits before its password is checked.
func (g *LoginGuard) Delay(st LoginState) time.Duration {
	// past(n, limit): BaseDelay × 2^(n-limit) once n reached limit, capped; 0 before.
	past := func(n, limit int64) time.Duration {
		if n < limit {
			return 0
		}
		return min(g.BaseDelay<<min(n-limit, 8), g.MaxDelay)
	}
	d := past(st.Pair, g.FreeFailures)
	if g.Captcha == nil { // no captcha to ask for: the e-mail and IP thresholds slow down instead
		d = max(d, past(st.Email, g.CaptchaAfter), past(st.IP, g.IPCaptchaAfter))
	}
	return d
}

// Check runs before the password is verified: it demands (and verifies) a captcha or
// waits out the delay. It returns ErrCaptchaRequired/ErrCaptchaInvalid, or ctx's error.
func (g *LoginGuard) Check(ctx context.Context, ip netip.Addr, email, captcha string) error {
	st := g.State(ctx, ip, email)
	if g.NeedsCaptcha(st) {
		if captcha == "" {
			loginGuardEvents.WithLabelValues("captcha_required").Inc()
			return ErrCaptchaRequired
		}
		ok, err := g.Captcha.Verify(ctx, captcha, ip)
		switch {
		case err != nil:
			// Cloudflare unreachable: don't lock everyone out; fall back to the delay.
			g.Log.WarnContext(ctx, "captcha verification unavailable; falling back to delays", "err", err)
			loginGuardEvents.WithLabelValues("captcha_unavailable").Inc()
			return g.wait(ctx, max(g.Delay(st), g.MaxDelay))
		case !ok:
			loginGuardEvents.WithLabelValues("captcha_failed").Inc()
			return ErrCaptchaInvalid
		}
		loginGuardEvents.WithLabelValues("captcha_ok").Inc()
		return nil // a person solved it: no delay on top
	}
	return g.wait(ctx, g.Delay(st))
}

func (g *LoginGuard) wait(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	loginGuardEvents.WithLabelValues("delayed").Inc()
	loginGuardDelay.Observe(d.Seconds())
	if g.sleep != nil {
		return g.sleep(ctx, d)
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-t.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// failScript increments each counter and starts its window on the first hit.
var failScript = redis.NewScript(`
for i, k in ipairs(KEYS) do
  if redis.call("INCR", k) == 1 then redis.call("PEXPIRE", k, ARGV[1]) end
end
return 1
`)

// Failed records a wrong password (or an unknown e-mail: both look the same).
func (g *LoginGuard) Failed(ctx context.Context, ip netip.Addr, email string) {
	if err := failScript.Run(ctx, g.RDB, g.keys(ip, email), g.Window.Milliseconds()).Err(); err != nil {
		g.Log.WarnContext(ctx, "login guard: failure not recorded", "err", err)
	}
	loginGuardEvents.WithLabelValues("failed").Inc()
}

// Succeeded forgets the pair's and the e-mail's failures; the IP's stay (others behind the
// same address may be guessing).
func (g *LoginGuard) Succeeded(ctx context.Context, ip netip.Addr, email string) {
	k := g.keys(ip, email)
	if err := g.RDB.Del(ctx, k[0], k[1]).Err(); err != nil {
		g.Log.WarnContext(ctx, "login guard: reset failed", "err", err)
	}
}
