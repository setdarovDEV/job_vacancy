package vacancy

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"jobvacancy.uz/backend/db/gen"
)

// ViewCounter counts vacancy page views in Redis and flushes them to Postgres in batches,
// so a popular vacancy doesn't turn every page view into a row update.
// A viewer is counted at most once per hour per vacancy.
type ViewCounter struct{ RDB *redis.Client }

const (
	viewsKey    = "vacancy:views"
	flushingKey = "vacancy:views:flushing"
	dedupeTTL   = time.Hour
)

var hitScript = redis.NewScript(`
if redis.call("SET", KEYS[1], 1, "NX", "EX", ARGV[2]) then
  redis.call("HINCRBY", KEYS[2], ARGV[1], 1)
  return 1
end
return 0
`)

// Hit records a view; viewer is a user id or client IP.
func (v *ViewCounter) Hit(ctx context.Context, id uuid.UUID, viewer string) error {
	dedupe := "vacancy:viewed:" + id.String() + ":" + viewer
	return hitScript.Run(ctx, v.RDB, []string{dedupe, viewsKey}, id.String(), int(dedupeTTL.Seconds())).Err()
}

// Flush moves accumulated counts into vacancies.views_count. The hash is renamed first,
// so hits arriving during the flush land in a fresh hash and are never lost. A batch
// left over from a crashed flush is processed before taking a new one.
func (v *ViewCounter) Flush(ctx context.Context, q *gen.Queries) (int, error) {
	exists, err := v.RDB.Exists(ctx, flushingKey).Result()
	if err != nil {
		return 0, err
	}
	if exists == 0 {
		if err := v.RDB.Rename(ctx, viewsKey, flushingKey).Err(); err != nil {
			if err.Error() == "ERR no such key" {
				return 0, nil
			}
			return 0, err
		}
	}
	counts, err := v.RDB.HGetAll(ctx, flushingKey).Result()
	if err != nil {
		return 0, err
	}
	ids := make([]uuid.UUID, 0, len(counts))
	ns := make([]int32, 0, len(counts))
	for k, val := range counts {
		id, err1 := uuid.Parse(k)
		n, err2 := strconv.Atoi(val)
		if errors.Join(err1, err2) != nil {
			continue
		}
		ids = append(ids, id)
		ns = append(ns, int32(n))
	}
	if len(ids) > 0 {
		if err := q.AddVacancyViews(ctx, gen.AddVacancyViewsParams{Ids: ids, Counts: ns}); err != nil {
			return 0, err // keep the hash; the next run retries it
		}
	}
	return len(ids), v.RDB.Del(ctx, flushingKey).Err()
}
