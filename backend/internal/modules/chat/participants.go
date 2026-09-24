package chat

import (
	"context"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/hashicorp/golang-lru/v2/expirable"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"

	"jobvacancy.uz/backend/db/gen"
)

const (
	participantsTTL  = 30 * time.Second // membership changes show up within this
	participantsSize = 10_000           // bounded memory (TZ BE-04): ~1.5 MB at 3 members each
)

var participantLookups = promauto.NewCounterVec(prometheus.CounterOpts{
	Name: "chat_participants_cache_total",
	Help: "Chat participant cache lookups by result (hit, miss).",
}, []string{"result"})

type cachedParticipants struct {
	conv  gen.Conversation
	users []uuid.UUID // seeker + every company member
}

func newParticipantsCache() *expirable.LRU[uuid.UUID, cachedParticipants] {
	return expirable.NewLRU[uuid.UUID, cachedParticipants](participantsSize, nil, participantsTTL)
}

func (s *Service) lru() *expirable.LRU[uuid.UUID, cachedParticipants] {
	s.cacheOnce.Do(func() {
		if s.cache == nil {
			s.cache = newParticipantsCache()
		}
	})
	return s.cache
}

// participants returns the conversation and everyone on it. Checked on every request and
// typing frame, so it's cached (an expirable LRU: 10k conversations, 30 s).
func (s *Service) participants(ctx context.Context, id uuid.UUID) (gen.Conversation, []uuid.UUID, error) {
	m, err := s.participantsMany(ctx, []uuid.UUID{id})
	if err != nil {
		return gen.Conversation{}, nil, err
	}
	p, ok := m[id]
	if !ok {
		return gen.Conversation{}, nil, ErrNotFound
	}
	return p.conv, p.users, nil
}

// participantsMany resolves a page of conversations with one query for all cache misses
// (TZ BE-04: no query per row). Unknown ids are absent from the result.
func (s *Service) participantsMany(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]cachedParticipants, error) {
	cache := s.lru()
	out := make(map[uuid.UUID]cachedParticipants, len(ids))
	var missing []uuid.UUID
	for _, id := range ids {
		if p, ok := cache.Get(id); ok {
			out[id] = p
			continue
		}
		if !slices.Contains(missing, id) {
			missing = append(missing, id)
		}
	}
	participantLookups.WithLabelValues("hit").Add(float64(len(ids) - len(missing)))
	if len(missing) == 0 {
		return out, nil
	}
	participantLookups.WithLabelValues("miss").Add(float64(len(missing)))
	rows, err := s.Q.GetConversationsWithMembers(ctx, missing)
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		p := cachedParticipants{conv: r.Conversation, users: append([]uuid.UUID{r.Conversation.SeekerID}, r.Members...)}
		cache.Add(r.Conversation.ID, p)
		out[r.Conversation.ID] = p
	}
	return out, nil
}
