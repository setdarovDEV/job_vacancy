package auth

import (
	"context"
	"strings"
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

// RevokedKey is the Redis key marking a revoked session; the request gate checks it in
// its single script call (TZ BE-09).
func RevokedKey(id uuid.UUID) string { return key(id) }

// RevokeChannel is where revoked session ids are announced; every API instance's
// WebSocket hub listens and closes the sockets opened with them (TZ BE-15, SEC-05).
const RevokeChannel = "rt:revoke"

// Revoke marks the sessions revoked (their access tokens stop working at once) and
// announces them to the WebSocket hubs, in one pipelined round trip.
func (s *RevocationStore) Revoke(ctx context.Context, ids ...uuid.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	list := make([]string, len(ids))
	for i, id := range ids {
		list[i] = id.String()
	}
	_, err := s.rdb.Pipelined(ctx, func(p redis.Pipeliner) error {
		for _, id := range ids {
			p.Set(ctx, key(id), 1, s.ttl)
		}
		p.Publish(ctx, RevokeChannel, strings.Join(list, ","))
		return nil
	})
	return err
}

func (s *RevocationStore) IsRevoked(ctx context.Context, id uuid.UUID) (bool, error) {
	n, err := s.rdb.Exists(ctx, key(id)).Result()
	return n > 0, err
}
