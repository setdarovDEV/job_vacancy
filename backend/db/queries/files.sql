-- name: CreateFile :one
INSERT INTO files (owner_id, purpose, bucket, object_key, content_type, name, meta)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetFile :one
SELECT * FROM files WHERE id = $1;

-- name: MarkFileReady :one
UPDATE files SET status = 'ready', size = $2, content_type = $3
WHERE id = $1 AND status = 'pending'
RETURNING *;

-- name: ListStalePendingFiles :many
SELECT * FROM files WHERE status = 'pending' AND created_at < now() - interval '1 day' LIMIT 500;

-- name: DeleteFile :exec
DELETE FROM files WHERE id = $1;
