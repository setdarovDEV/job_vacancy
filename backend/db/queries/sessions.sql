-- name: CreateSession :one
INSERT INTO user_sessions (user_id, refresh_hash, platform, user_agent, ip, expires_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetSessionByRefreshHash :one
SELECT * FROM user_sessions WHERE refresh_hash = $1;

-- name: GetSessionByPrevRefreshHash :one
SELECT * FROM user_sessions WHERE prev_refresh_hash = $1;

-- Rotation is conditional on the old hash so two concurrent refreshes can't both win.
-- name: RotateSession :execrows
UPDATE user_sessions
SET prev_refresh_hash = refresh_hash,
    refresh_hash      = sqlc.arg(new_hash),
    last_used_at      = now(),
    expires_at        = sqlc.arg(expires_at),
    ip                = sqlc.arg(ip),
    user_agent        = sqlc.arg(user_agent)
WHERE id = sqlc.arg(id)
  AND refresh_hash = sqlc.arg(old_hash)
  AND revoked_at IS NULL;

-- name: RevokeSession :exec
UPDATE user_sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL;

-- name: RevokeUserSession :execrows
UPDATE user_sessions SET revoked_at = now()
WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL;

-- name: RevokeAllUserSessions :many
UPDATE user_sessions SET revoked_at = now()
WHERE user_id = $1 AND revoked_at IS NULL
RETURNING id;

-- name: ListActiveSessions :many
SELECT * FROM user_sessions
WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
ORDER BY last_used_at DESC;

-- name: DeleteExpiredSessions :execrows
DELETE FROM user_sessions
WHERE expires_at < now() - interval '7 days'
   OR revoked_at < now() - interval '7 days';
