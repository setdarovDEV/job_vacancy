// Package respcache caches ready-to-send JSON responses in Redis (TZ BE-05).
//
// What is cached are the final response bytes, gzip-compressed once per load, with an
// ETag, so a hit costs one Redis round trip and no JSON encoding; clients that send
// If-None-Match get a 304. Entries have a jittered fresh period (TTL ±20%) and are then
// served stale for a while (stale-while-revalidate) while exactly one instance refreshes
// them in the background under a Redis lock. Writes invalidate precisely:
//
//   - Invalidate(key) deletes an entry and bumps its invalidation marker, so a load that
//     started before the write can't store its outdated result afterwards;
//   - Generation.Bump marks every entry of a namespace stale at once (listings, where the
//     affected keys can't be enumerated); they are refreshed on their next request.
//
// Concurrent misses of one key inside an instance share a single load that runs on a
// context detached from the caller (TZ BE-01), bounded by LoadTimeout. Round trips: a hit
// is one MGET; a miss adds one script call that stores the result.
package respcache

import (
	"context"
	"errors"
	"log/slog"
	"math/rand/v2"
	"strconv"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/singleflight"
)

// Status says how a response was served; it is also sent as the X-Cache header.
type Status uint8

const (
	Miss  Status = iota // loaded now
	Hit                 // fresh entry
	Stale               // expired or invalidated entry, a refresh runs in the background
)

func (s Status) String() string {
	switch s {
	case Hit:
		return "HIT"
	case Stale:
		return "STALE"
	default:
		return "MISS"
	}
}

// Loaded is what a loader produces: the response body and optional caller metadata
// (at most 64 KiB).
type Loaded struct {
	Body []byte
	Meta []byte
}

// Loader builds a response. Errors are returned to the caller and never cached.
type Loader func(ctx context.Context) (Loaded, error)

const (
	defaultLoadTimeout = 3 * time.Second
	invMarkerTTL       = time.Minute // must outlive any load
	jitter             = 0.2
)

// Cache is one named response cache ("vacancy_list", "vacancy_detail", …).
type Cache struct {
	RDB *redis.Client
	Log *slog.Logger
	// Name prefixes the Redis keys and labels the metrics.
	Name string
	// TTL is the fresh period; every write draws it from TTL ±20% so entries written
	// together don't all expire together.
	TTL time.Duration
	// Stale is how long after TTL an entry may still be served while it is refreshed.
	Stale time.Duration
	// LoadTimeout bounds one load; 0 means 3s.
	LoadTimeout time.Duration
	// Gen, if set, is the namespace generation: bumping it makes every entry stale.
	Gen *Generation

	group      singleflight.Group
	refreshing sync.Map // key → struct{}: at most one background refresh per key here
	now        func() time.Time
}

// Generation is a counter in Redis; entries remember the value they were loaded under.
type Generation struct {
	RDB *redis.Client
	Key string
}

// Bump marks every entry of the namespace stale.
func (g *Generation) Bump(ctx context.Context) error { return g.RDB.Incr(ctx, g.Key).Err() }

func (c *Cache) entryKey(k string) string { return "rc:" + c.Name + ":" + k }
func (c *Cache) invKey(k string) string   { return "rc:" + c.Name + ":" + k + ":inv" }
func (c *Cache) lockKey(k string) string  { return "rc:" + c.Name + ":" + k + ":lock" }

func (c *Cache) clock() time.Time {
	if c.now != nil {
		return c.now()
	}
	return time.Now()
}

func (c *Cache) loadTimeout() time.Duration {
	if c.LoadTimeout > 0 {
		return c.LoadTimeout
	}
	return defaultLoadTimeout
}

// state is what one read saw besides the entry: the key's invalidation marker and the
// namespace generation. A load stores its result only if the marker is still the same.
type state struct {
	inv string
	gen int64
}

// Get returns the cached response for key, loading it on a miss. A stale entry is
// returned as is (Status Stale) while a background refresh replaces it. If Redis is
// unavailable the loader's result is served uncached.
func (c *Cache) Get(ctx context.Context, key string, load Loader) (*Entry, Status, error) {
	keys := []string{c.entryKey(key), c.invKey(key)}
	if c.Gen != nil {
		keys = append(keys, c.Gen.Key)
	}
	vals, err := c.RDB.MGet(ctx, keys...).Result()
	if err != nil {
		if ctx.Err() != nil {
			return nil, Miss, ctx.Err()
		}
		c.Log.WarnContext(ctx, "response cache read failed; serving uncached", "cache", c.Name, "err", err)
		requests.WithLabelValues(c.Name, "error").Inc()
		e, err := c.fill(ctx, key, load, state{}, false)
		return e, Miss, err
	}
	st := state{inv: str(vals[1])}
	if c.Gen != nil {
		st.gen, _ = strconv.ParseInt(str(vals[2]), 10, 64)
	}
	if raw := str(vals[0]); raw != "" {
		e, err := decode([]byte(raw))
		if err == nil {
			if c.clock().Before(e.FreshUntil) && (c.Gen == nil || e.Gen == st.gen) {
				requests.WithLabelValues(c.Name, "hit").Inc()
				return e, Hit, nil
			}
			requests.WithLabelValues(c.Name, "stale").Inc()
			c.refreshAsync(ctx, key, load, st)
			return e, Stale, nil
		}
		c.Log.WarnContext(ctx, "response cache entry unreadable; reloading", "cache", c.Name, "err", err)
	}
	requests.WithLabelValues(c.Name, "miss").Inc()
	e, err := c.fill(ctx, key, load, st, true)
	return e, Miss, err
}

// Peek returns the entry for key without loading or refreshing it (nil if absent).
func (c *Cache) Peek(ctx context.Context, key string) (*Entry, error) {
	raw, err := c.RDB.Get(ctx, c.entryKey(key)).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	e, err := decode(raw)
	if err != nil {
		return nil, nil
	}
	return e, nil
}

// Invalidate drops the entries and bumps their invalidation markers, so a load already
// running for one of these keys doesn't write its (now outdated) result back.
func (c *Cache) Invalidate(ctx context.Context, keys ...string) error {
	if len(keys) == 0 {
		return nil
	}
	_, err := c.RDB.TxPipelined(ctx, func(p redis.Pipeliner) error {
		for _, k := range keys {
			p.Incr(ctx, c.invKey(k))
			p.PExpire(ctx, c.invKey(k), invMarkerTTL)
			p.Del(ctx, c.entryKey(k))
		}
		return nil
	})
	return err
}

// fill loads key once per instance (singleflight) on a context detached from the caller;
// every caller still stops waiting when its own ctx ends. A cold miss takes no Redis
// lock: at worst each API instance loads a new key once, which is cheaper than two more
// round trips on every long-tail miss. Hot keys are refreshed under the lock instead.
func (c *Cache) fill(ctx context.Context, key string, load Loader, st state, write bool) (*Entry, error) {
	ch := c.group.DoChan(key, func() (any, error) {
		lctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), c.loadTimeout())
		defer cancel()
		return c.load(lctx, key, load, st, write, "")
	})
	select {
	case r := <-ch:
		if r.Err != nil {
			return nil, r.Err
		}
		return r.Val.(*Entry), nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// refreshAsync reloads a stale entry in the background. Only the instance that wins the
// key's Redis lock refreshes it; everybody keeps serving the stale bytes meanwhile.
func (c *Cache) refreshAsync(ctx context.Context, key string, load Loader, st state) {
	if _, busy := c.refreshing.LoadOrStore(key, struct{}{}); busy {
		return
	}
	go func() {
		defer c.refreshing.Delete(key)
		lctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), c.loadTimeout())
		defer cancel()
		token, ok := c.lock(lctx, key)
		if !ok {
			return // another instance is refreshing it
		}
		_, err, shared := c.group.Do(key, func() (any, error) { return c.load(lctx, key, load, st, true, token) })
		if err != nil || shared {
			c.unlock(key, token) // normally the store released it; a joined flight may not have
		}
	}()
}

// load runs the loader and stores the result unless the key was invalidated meanwhile;
// the same script releases the refresh lock identified by token ("" = none held).
func (c *Cache) load(ctx context.Context, key string, load Loader, st state, write bool, token string) (*Entry, error) {
	start := time.Now()
	l, err := load(ctx)
	loadSeconds.WithLabelValues(c.Name).Observe(time.Since(start).Seconds())
	if err != nil {
		return nil, err
	}
	if len(l.Meta) > 0xffff {
		return nil, errors.New("respcache: meta larger than 64 KiB")
	}
	gz, err := compress(l.Body)
	if err != nil {
		return nil, err
	}
	fresh := jittered(c.TTL)
	e := &Entry{ETag: etagOf(l.Body), Gzip: gz, Meta: l.Meta, Gen: st.gen, FreshUntil: c.clock().Add(fresh)}
	if write {
		stored, err := storeScript.Run(ctx, c.RDB, []string{c.entryKey(key), c.invKey(key), c.lockKey(key)},
			e.encode(), (fresh + c.Stale).Milliseconds(), st.inv, token).Int()
		switch {
		case err != nil:
			c.Log.WarnContext(ctx, "response cache write failed", "cache", c.Name, "err", err)
		case stored == 0:
			writesSkipped.WithLabelValues(c.Name).Inc() // invalidated while loading
		}
	}
	return e, nil
}

// storeScript writes the entry only if the key wasn't invalidated since it was read,
// and releases the refresh lock if this load held it (one round trip for both).
var storeScript = redis.NewScript(`
if ARGV[4] ~= "" and redis.call("GET", KEYS[3]) == ARGV[4] then redis.call("DEL", KEYS[3]) end
local cur = redis.call("GET", KEYS[2]) or ""
if cur ~= ARGV[3] then return 0 end
redis.call("SET", KEYS[1], ARGV[1], "PX", ARGV[2])
return 1
`)

var unlockScript = redis.NewScript(`
if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) end
return 0
`)

// lock takes the key's refresh lock; it expires on its own if the holder dies.
func (c *Cache) lock(ctx context.Context, key string) (string, bool) {
	token := strconv.FormatUint(rand.Uint64(), 36)
	ok, err := c.RDB.SetNX(ctx, c.lockKey(key), token, c.loadTimeout()+time.Second).Result()
	if err != nil {
		return "", false // Redis trouble: keep serving the stale entry
	}
	return token, ok
}

func (c *Cache) unlock(key, token string) {
	if token == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	_ = unlockScript.Run(ctx, c.RDB, []string{c.lockKey(key)}, token).Err()
}

// jittered spreads expiry over TTL ±20%.
func jittered(ttl time.Duration) time.Duration {
	if ttl <= 0 {
		return ttl
	}
	return time.Duration(float64(ttl) * (1 - jitter + 2*jitter*rand.Float64()))
}

func str(v any) string {
	s, _ := v.(string)
	return s
}
