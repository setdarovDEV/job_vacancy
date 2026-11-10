-- name: CreateFeedback :one
INSERT INTO feedback (user_id, category, message, contact, page_url, ip)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- Keyset page, newest first; handled filters on whether it was dealt with.
-- name: ListFeedback :many
SELECT f.*, u.full_name AS user_name, u.email AS user_email
FROM feedback f LEFT JOIN users u ON u.id = f.user_id
WHERE (f.handled_at IS NOT NULL) = sqlc.arg(handled)::boolean
  AND (sqlc.narg(after_at)::timestamptz IS NULL OR (f.created_at, f.id) < (sqlc.narg(after_at)::timestamptz, sqlc.narg(after_id)::uuid))
ORDER BY f.created_at DESC, f.id DESC
LIMIT sqlc.arg(max_results);

-- name: GetFeedback :one
SELECT f.*, u.full_name AS user_name, u.email AS user_email
FROM feedback f LEFT JOIN users u ON u.id = f.user_id
WHERE f.id = $1;

-- name: SetFeedbackHandled :execrows
UPDATE feedback
SET handled_at = CASE WHEN sqlc.arg(handled)::boolean THEN coalesce(handled_at, now()) END,
    handled_by = CASE WHEN sqlc.arg(handled)::boolean THEN coalesce(handled_by, sqlc.narg(admin_id)::uuid) END
WHERE id = sqlc.arg(id);
