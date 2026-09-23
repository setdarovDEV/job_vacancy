// Package ratelimit implements a Redis fixed-window limiter shared by all API instances.
package ratelimit

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// INCR and set the expiry on first hit in one round trip; returns {count, ttl_ms}.
var script = redis.NewScript(`
local n = redis.call("INCR", KEYS[1])
if n == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
return {n, redis.call("PTTL", KEYS[1])}
`)

type Limiter struct{ rdb *redis.Client }

func New(rdb *redis.Client) *Limiter { return &Limiter{rdb: rdb} }

type Rule struct {
	Name   string
	Limit  int
	Window time.Duration
}

// Allow counts one hit for key under rule. When the limit is exceeded it returns
// false and how long until the window resets.
func (l *Limiter) Allow(ctx context.Context, r Rule, key string) (bool, time.Duration, error) {
	k := fmt.Sprintf("rl:%s:%s", r.Name, key)
	res, err := script.Run(ctx, l.rdb, []string{k}, r.Window.Milliseconds()).Int64Slice()
	if err != nil {
		return true, 0, fmt.Errorf("ratelimit: %w", err) // fail open: Redis hiccups mustn't lock users out
	}
	if int(res[0]) > r.Limit {
		return false, time.Duration(res[1]) * time.Millisecond, nil
	}
	return true, 0, nil
}
