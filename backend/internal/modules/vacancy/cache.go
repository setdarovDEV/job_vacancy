package vacancy

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/singleflight"
)

// ListCache keeps public listing pages in Redis for a short time. Listings are the same
// for every visitor, so a popular search ("dasturchi", the home page feed) is computed
// once per TTL across all API instances. Concurrent misses for the same key inside one
// instance are collapsed into a single database query.
type ListCache struct {
	RDB *redis.Client
	TTL time.Duration
	Log *slog.Logger
	// LoadTimeout bounds one shared load; 0 means defaultLoadTimeout.
	LoadTimeout time.Duration
	group       singleflight.Group
}

func cacheKey(f Filter) string {
	b, _ := json.Marshal(f) // struct fields marshal in a fixed order
	sum := sha256.Sum256(b)
	return "vacancy:list:" + hex.EncodeToString(sum[:12])
}

// defaultLoadTimeout bounds a shared cache fill. The fill runs detached from the request
// that happened to start it (TZ BE-01): if that client disconnects, everybody else
// waiting on the same key must still get the result.
const defaultLoadTimeout = 3 * time.Second

// Get returns the cached page for f or loads it. Concurrent misses for one key share a
// single load; load receives a context detached from any one caller (values such as the
// request id are kept) with its own LoadTimeout. Each caller still stops waiting when its
// own ctx is done.
func (c *ListCache) Get(ctx context.Context, f Filter, load func(ctx context.Context) (ListResult, error)) (ListResult, error) {
	key := cacheKey(f)
	if raw, err := c.RDB.Get(ctx, key).Bytes(); err == nil {
		var res ListResult
		if json.Unmarshal(raw, &res) == nil {
			return res, nil
		}
	} else if err != redis.Nil {
		c.Log.WarnContext(ctx, "list cache read failed", "err", err)
	}

	ch := c.group.DoChan(key, func() (any, error) {
		timeout := c.LoadTimeout
		if timeout <= 0 {
			timeout = defaultLoadTimeout
		}
		lctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), timeout)
		defer cancel()
		res, err := load(lctx)
		if err != nil {
			return res, err
		}
		if raw, err := json.Marshal(res); err == nil {
			if err := c.RDB.Set(lctx, key, raw, c.TTL).Err(); err != nil {
				c.Log.WarnContext(lctx, "list cache write failed", "err", err)
			}
		}
		return res, nil
	})
	select {
	case r := <-ch:
		if r.Err != nil {
			return ListResult{}, r.Err
		}
		return r.Val.(ListResult), nil
	case <-ctx.Done():
		return ListResult{}, ctx.Err()
	}
}

// ---- popular searches ------------------------------------------------------------------

const (
	popularDays     = 7
	popularCacheKey = "search:popular:top"
)

func popularKey(t time.Time) string { return "search:popular:" + t.UTC().Format("20060102") }

// RecordSearch counts a query that returned results, in a per-day sorted set.
func (c *ListCache) RecordSearch(ctx context.Context, raw string) {
	q := strings.ToLower(strings.Join(strings.Fields(raw), " "))
	if len([]rune(q)) < 2 || len([]rune(q)) > 60 {
		return
	}
	key := popularKey(time.Now())
	pipe := c.RDB.Pipeline()
	pipe.ZIncrBy(ctx, key, 1, q)
	pipe.Expire(ctx, key, (popularDays+1)*24*time.Hour)
	if _, err := pipe.Exec(ctx); err != nil {
		c.Log.WarnContext(ctx, "record search failed", "err", err)
	}
}

// Popular returns the most searched queries of the last week (cached for 10 minutes).
func (c *ListCache) Popular(ctx context.Context, limit int) ([]string, error) {
	if cached, err := c.RDB.LRange(ctx, popularCacheKey, 0, int64(limit-1)).Result(); err == nil && len(cached) > 0 {
		return cached, nil
	}
	keys := make([]string, popularDays)
	for i := range keys {
		keys[i] = popularKey(time.Now().AddDate(0, 0, -i))
	}
	top, err := c.RDB.ZUnion(ctx, redis.ZStore{Keys: keys}).Result()
	if err != nil {
		return nil, err
	}
	// ZUNION returns ascending by score; take the tail.
	out := make([]string, 0, 20)
	for i := len(top) - 1; i >= 0 && len(out) < 20; i-- {
		out = append(out, top[i])
	}
	if len(out) > 0 {
		pipe := c.RDB.TxPipeline()
		pipe.Del(ctx, popularCacheKey)
		pipe.RPush(ctx, popularCacheKey, toAny(out)...)
		pipe.Expire(ctx, popularCacheKey, 10*time.Minute)
		_, _ = pipe.Exec(ctx)
	}
	if len(out) > limit {
		out = out[:limit]
	}
	return out, nil
}

func toAny(ss []string) []any {
	out := make([]any, len(ss))
	for i, s := range ss {
		out[i] = s
	}
	return out
}
