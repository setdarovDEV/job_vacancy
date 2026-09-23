// Package realtime delivers live events to connected clients.
//
// Every user has a Redis pub/sub channel "rt:u:<id>". Any API instance publishes to it;
// the instance(s) holding that user's WebSocket connections are subscribed and forward
// the event. Nothing is buffered: an offline user simply misses live events and catches
// up through the REST API (and gets push/Telegram notifications instead).
package realtime

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// Event is what clients receive on the WebSocket: {"type": "...", "data": {...}}.
type Event struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

func userChannel(id uuid.UUID) string { return "rt:u:" + id.String() }

func presenceChannel(id uuid.UUID) string { return "rt:p:" + id.String() }

type Publisher struct{ RDB *redis.Client }

// ToUsers publishes one event to each user's channel in a single round trip.
func (p *Publisher) ToUsers(ctx context.Context, users []uuid.UUID, ev Event) error {
	if len(users) == 0 {
		return nil
	}
	b, err := json.Marshal(ev)
	if err != nil {
		return err
	}
	_, err = p.RDB.Pipelined(ctx, func(pipe redis.Pipeliner) error {
		for _, u := range users {
			pipe.Publish(ctx, userChannel(u), b)
		}
		return nil
	})
	return err
}
