package realtime

import (
	"fmt"
	"testing"

	"github.com/google/uuid"
)

// BenchmarkRegistry compares one global lock with the sharded registry (TZ BE-15) under
// the hub's mix: connections joining and leaving while events are fanned out to users.
// Each parallel worker registers a connection, delivers 8 events to its user (the
// dispatcher's read-locked loop) and unregisters.
func BenchmarkRegistry(b *testing.B) {
	for _, n := range []int{1, defaultShards} {
		b.Run(fmt.Sprintf("shards=%d", n), func(b *testing.B) {
			h := &Hub{shards: newShards(n)}
			b.RunParallel(func(pb *testing.PB) {
				c := &Conn{send: make(chan []byte, 16), closed: make(chan struct{})}
				payload := []byte(`{"type":"message.new"}`)
				for pb.Next() {
					user := uuid.New()
					sh := h.shardOf(user)
					sh.mu.Lock()
					add(sh.users, user, c)
					sh.mu.Unlock()
					for i := 0; i < 8; i++ {
						sh.mu.RLock()
						for conn := range sh.users[user] {
							conn.send <- payload
						}
						sh.mu.RUnlock()
						<-c.send
					}
					sh.mu.Lock()
					remove(sh.users, user, c)
					sh.mu.Unlock()
				}
			})
		})
	}
}
