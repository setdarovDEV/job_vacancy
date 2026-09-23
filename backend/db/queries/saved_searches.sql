-- name: CreateSavedSearch :one
INSERT INTO saved_searches (user_id, name, params, notify) VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: CountSavedSearches :one
SELECT count(*) FROM saved_searches WHERE user_id = $1;

-- name: ListSavedSearches :many
SELECT * FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC;

-- name: UpdateSavedSearch :one
UPDATE saved_searches SET name = $3, notify = $4
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: DeleteSavedSearch :execrows
DELETE FROM saved_searches WHERE id = $1 AND user_id = $2;

-- Oldest-checked first; SKIP LOCKED lets several workers split the batch safely.
-- name: ClaimDueSavedSearches :many
UPDATE saved_searches s SET last_checked_at = now()
FROM (SELECT id, last_checked_at AS since FROM saved_searches
      WHERE notify AND last_checked_at < now() - make_interval(secs => sqlc.arg(min_age_secs)::int)
      ORDER BY last_checked_at LIMIT sqlc.arg(max_results)
      FOR UPDATE SKIP LOCKED) due
WHERE s.id = due.id
RETURNING s.id, s.user_id, s.name, s.params, due.since;
