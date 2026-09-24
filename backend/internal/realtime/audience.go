package realtime

import (
	"context"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
	"jobvacancy.uz/backend/internal/pkg/apperr"
)

// Presence is private (TZ SEC-05): a user's online status is visible only to people who
// share a conversation with them, and not at all when they turn on "hide online status".
// The hub still tracks hidden users (offline pushes depend on it); it just never reports
// them online to anyone else.

// ErrPresenceForbidden answers a REST presence request that names someone the caller
// doesn't share a conversation with.
var ErrPresenceForbidden = apperr.Forbidden("presence_forbidden",
	"online status is visible only to people you have a conversation with")

// Audience decides whose presence a viewer may see.
type Audience interface {
	// Visible returns the ids among ids that viewer may see, each mapped to whether that
	// user hides their status.
	Visible(ctx context.Context, viewer uuid.UUID, ids []uuid.UUID) (map[uuid.UUID]bool, error)
	// HideOnline reports a user's own setting.
	HideOnline(ctx context.Context, id uuid.UUID) (bool, error)
}

// DBAudience answers from Postgres: one indexed query per check.
type DBAudience struct{ Q *gen.Queries }

func (a DBAudience) Visible(ctx context.Context, viewer uuid.UUID, ids []uuid.UUID) (map[uuid.UUID]bool, error) {
	rows, err := a.Q.PresenceAudience(ctx, gen.PresenceAudienceParams{Ids: ids, Viewer: viewer})
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]bool, len(rows))
	for _, r := range rows {
		out[r.ID] = r.HideOnline
	}
	return out, nil
}

func (a DBAudience) HideOnline(ctx context.Context, id uuid.UUID) (bool, error) {
	return a.Q.GetHideOnline(ctx, id)
}

// hiddenKey marks a user who hides their status; announcements skip them. It mirrors
// users.hide_online and is rewritten on every connection, so a lost key heals itself.
func hiddenKey(id uuid.UUID) string { return "presence:hidden:" + id.String() }

// audience returns the visible subset of ids for viewer. The viewer always sees
// themselves; without an Audience nobody else is visible.
func (h *Hub) audience(ctx context.Context, viewer uuid.UUID, ids []uuid.UUID) (map[uuid.UUID]bool, error) {
	if h.Audience == nil {
		out := map[uuid.UUID]bool{}
		for _, id := range ids {
			if id == viewer {
				out[id] = false
			}
		}
		return out, nil
	}
	return h.Audience.Visible(ctx, viewer, ids)
}

// VisiblePresence is Presence as viewer may see it. With strict, naming anyone the viewer
// may not see fails with ErrPresenceForbidden; otherwise they are left out. Users who hide
// their status read as offline with no last-seen time.
func (h *Hub) VisiblePresence(ctx context.Context, viewer uuid.UUID, ids []uuid.UUID, strict bool) ([]PresenceState, error) {
	if len(ids) == 0 {
		return []PresenceState{}, nil
	}
	vis, err := h.audience(ctx, viewer, ids)
	if err != nil {
		return nil, err
	}
	allowed := make([]uuid.UUID, 0, len(ids))
	for _, id := range ids {
		if _, ok := vis[id]; ok {
			allowed = append(allowed, id)
		} else if strict {
			return nil, ErrPresenceForbidden
		}
	}
	st, err := h.Presence(ctx, allowed)
	if err != nil {
		return nil, err
	}
	for i := range st {
		if vis[st[i].UserID] && st[i].UserID != viewer {
			st[i] = PresenceState{UserID: st[i].UserID}
		}
	}
	return st, nil
}

// SetHidden applies a change of the "hide online status" setting at once: watchers see
// the user go offline (hidden) or their real status (visible again).
func (h *Hub) SetHidden(ctx context.Context, id uuid.UUID, hidden bool) {
	var err error
	if hidden {
		err = h.rdb.Set(ctx, hiddenKey(id), 1, 0).Err()
	} else {
		err = h.rdb.Del(ctx, hiddenKey(id)).Err()
	}
	if err != nil {
		h.log.Warn("presence visibility", "err", err)
		return
	}
	st := PresenceState{UserID: id}
	if !hidden {
		if cur, err := h.Presence(ctx, []uuid.UUID{id}); err == nil && len(cur) == 1 {
			st = cur[0]
		}
	}
	h.publish(ctx, st)
}

// syncHidden copies the user's setting into Redis when they connect.
func (h *Hub) syncHidden(ctx context.Context, id uuid.UUID) {
	if h.Audience == nil {
		return
	}
	hidden, err := h.Audience.HideOnline(ctx, id)
	if err != nil {
		h.log.Warn("presence visibility lookup", "err", err)
		return
	}
	var cmd redis.Cmder
	if hidden {
		cmd = h.rdb.Set(ctx, hiddenKey(id), 1, 0)
	} else {
		cmd = h.rdb.Del(ctx, hiddenKey(id))
	}
	if err := cmd.Err(); err != nil {
		h.log.Warn("presence visibility sync", "err", err)
	}
}
