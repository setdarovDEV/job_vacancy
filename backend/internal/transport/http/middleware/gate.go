package middleware

import (
	"context"
	"log/slog"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/internal/pkg/apperr"
	"jobvacancy.uz/backend/internal/pkg/ratelimit"
	"jobvacancy.uz/backend/internal/pkg/reqctx"
	"jobvacancy.uz/backend/internal/pkg/token"
	"jobvacancy.uz/backend/internal/transport/http/response"
)

// gateScript does everything a request needs from Redis before its handler, in one round
// trip (TZ BE-09): count the client IP; with a valid access token also check that its
// session isn't revoked and count the user. A revoked token doesn't spend the user's
// budget. Returns {ip_count, ip_ttl_ms[, revoked[, user_count, user_ttl_ms]]}.
//
// KEYS[1] IP counter; KEYS[2] revocation marker and KEYS[3] user counter (token only).
// ARGV[1] IP window ms; ARGV[2] user window ms. The keys are those of ratelimit.Limiter
// and auth.RevocationStore, so budgets carry over and revocations apply at once.
var gateScript = redis.NewScript(`
local n = redis.call("INCR", KEYS[1])
if n == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
local ipttl = redis.call("PTTL", KEYS[1])
if #KEYS < 3 then return {n, ipttl} end
if redis.call("EXISTS", KEYS[2]) == 1 then return {n, ipttl, 1} end
local u = redis.call("INCR", KEYS[3])
if u == 1 then redis.call("PEXPIRE", KEYS[3], ARGV[2]) end
return {n, ipttl, 0, u, redis.call("PTTL", KEYS[3])}
`)

// Gate replaces three Redis calls per authenticated request (IP limit, revocation EXISTS,
// user limit) with one script call. It runs in front of every /api/v1 route: anonymous
// requests are counted per IP; requests with a valid access token are also counted per
// user (all of that user's API traffic) and have their revocation checked. The result is
// kept in the request context, so Authenticator.Require/Optional don't go to Redis again.
//
// Redis errors fail open, as the separate checks did: limits are skipped and the token,
// still signature-checked and short-lived, is accepted.
type Gate struct {
	RDB    *redis.Client
	Tokens *token.Manager
	IP     ratelimit.Rule
	User   ratelimit.Rule
	// RevokedKey is the revocation marker key of a session (auth.RevokedKey).
	RevokedKey func(sessionID uuid.UUID) string
}

type gateKey struct{}

// gateResult is what the gate learned about the request's bearer token.
type gateResult struct {
	raw       string // the token checked; Authenticator compares it before trusting the result
	principal reqctx.Principal
	valid     bool
}

func (g *Gate) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		keys := []string{"rl:" + g.IP.Name + ":" + KeyByIP(r)}
		res := gateResult{}
		var claims *token.Claims
		if raw, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer "); ok && raw != "" {
			res.raw = raw
			if c, err := g.Tokens.Parse(raw); err == nil {
				claims = c
				keys = append(keys, g.RevokedKey(c.SessionID), "rl:"+g.User.Name+":u:"+c.UserID.String())
			}
		}
		out, err := gateScript.Run(ctx, g.RDB, keys, g.IP.Window.Milliseconds(), g.User.Window.Milliseconds()).Int64Slice()
		if err != nil {
			slog.WarnContext(ctx, "request gate unavailable; limits skipped", "err", err)
			if claims != nil {
				res.principal, res.valid = principalOf(claims), true
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, gateKey{}, res)))
			return
		}
		if len(out) >= 2 && int(out[0]) > g.IP.Limit {
			tooMany(w, r, out[1])
			return
		}
		if claims != nil && len(out) >= 3 && out[2] == 0 {
			if len(out) >= 5 && int(out[3]) > g.User.Limit {
				tooMany(w, r, out[4])
				return
			}
			res.principal, res.valid = principalOf(claims), true
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, gateKey{}, res)))
	})
}

func principalOf(c *token.Claims) reqctx.Principal {
	return reqctx.Principal{UserID: c.UserID, SessionID: c.SessionID, Role: c.Role}
}

func tooMany(w http.ResponseWriter, r *http.Request, ttlMs int64) {
	retry := time.Duration(max(ttlMs, 0)) * time.Millisecond
	response.Error(w, r, apperr.TooManyRequests(max(int(math.Ceil(retry.Seconds())), 1)))
}

// gated returns the gate's verdict on raw, if the gate saw this same token.
func gated(ctx context.Context, raw string) (gateResult, bool) {
	res, ok := ctx.Value(gateKey{}).(gateResult)
	if !ok || res.raw != raw || raw == "" {
		return gateResult{}, false
	}
	return res, true
}
