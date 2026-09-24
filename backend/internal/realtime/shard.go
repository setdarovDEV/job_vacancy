package realtime

import (
	"encoding/binary"
	"sync"

	"github.com/google/uuid"
)

// defaultShards splits the hub's connection registry so that fan-out to one user never
// waits for connects, disconnects or presence watches of unrelated users (TZ BE-15). A
// power of two keeps the index a mask.
const defaultShards = 32

// connSet is the set of local connections of one key (a user, a watched user, a session).
type connSet map[*Conn]struct{}

// shard owns the registry entries whose key hashes to it. Every map is keyed by the id
// that picked the shard: users and watchers by user id, sessions by session id.
type shard struct {
	mu       sync.RWMutex
	users    map[uuid.UUID]connSet // connections of a user
	watchers map[uuid.UUID]connSet // connections watching a user's presence
	sessions map[uuid.UUID]connSet // connections opened with a session (revocation)
}

func newShards(n int) []shard {
	if n <= 0 || n&(n-1) != 0 {
		n = defaultShards
	}
	s := make([]shard, n)
	for i := range s {
		s[i] = shard{users: map[uuid.UUID]connSet{}, watchers: map[uuid.UUID]connSet{}, sessions: map[uuid.UUID]connSet{}}
	}
	return s
}

// shardOf picks the shard of id. uuidv7 ids carry 62 random bits in their tail, so the
// low bits of the last eight bytes spread evenly.
func (h *Hub) shardOf(id uuid.UUID) *shard {
	return &h.shards[binary.LittleEndian.Uint64(id[8:])&uint64(len(h.shards)-1)]
}

// add puts c into m[id]; it reports whether c is the first connection there.
func add(m map[uuid.UUID]connSet, id uuid.UUID, c *Conn) bool {
	set := m[id]
	first := len(set) == 0
	if set == nil {
		set = connSet{}
		m[id] = set
	}
	set[c] = struct{}{}
	return first
}

// remove takes c out of m[id]; it reports whether that was the last connection there.
func remove(m map[uuid.UUID]connSet, id uuid.UUID, c *Conn) bool {
	set, ok := m[id]
	if !ok {
		return false
	}
	delete(set, c)
	if len(set) == 0 {
		delete(m, id)
		return true
	}
	return false
}
