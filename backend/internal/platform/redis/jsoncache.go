package redis

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

// JSONCache stores values as JSON under string keys with a TTL.
type JSONCache struct{ RDB *goredis.Client }

// Get fills dst and reports true on a hit; a miss is (false, nil).
func (c JSONCache) Get(ctx context.Context, key string, dst any) (bool, error) {
	raw, err := c.RDB.Get(ctx, key).Bytes()
	if errors.Is(err, goredis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, json.Unmarshal(raw, dst)
}

func (c JSONCache) Set(ctx context.Context, key string, v any, ttl time.Duration) error {
	raw, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return c.RDB.Set(ctx, key, raw, ttl).Err()
}
