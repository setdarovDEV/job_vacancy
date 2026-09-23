package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// RevocationStore remembers revoked session IDs for as long as an access token issued
// for them could still be valid. The auth middleware checks it on every request.
type RevocationStore struct {
	rdb *redis.Client
	ttl time.Duration
}

func NewRevocationStore(rdb *redis.Client, accessTTL time.Duration) *RevocationStore {
	// Small margin over the token TTL to cover clock skew / JWT leeway.
	return &RevocationStore{rdb: rdb, ttl: accessTTL + time.Minute}
}

func key(id uuid.UUID) string { return "sess:revoked:" + id.String() }

func (s *RevocationStore) Revoke(ctx context.Context, ids ...uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := s.rdb.Pipelined(ctx, func(p redis.Pipeliner) error {
		for _, id := range ids {
			p.Set(ctx, key(id), 1, s.ttl)
		}
		return nil
	})
	return err
}

func (s *RevocationStore) IsRevoked(ctx context.Context, id uuid.UUID) (bool, error) {
	n, err := s.rdb.Exists(ctx, key(id)).Result()
	return n > 0, err
}
