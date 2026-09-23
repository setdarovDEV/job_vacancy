-- name: GetConversationByApplication :one
SELECT * FROM conversations WHERE application_id = $1;

-- name: CreateConversation :one
INSERT INTO conversations (application_id, company_id, seeker_id, vacancy_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (application_id) DO UPDATE SET application_id = EXCLUDED.application_id
RETURNING *;

-- name: GetConversation :one
SELECT * FROM conversations WHERE id = $1;

-- Conversations of a seeker, or of every company the user is a member of.
-- name: ListConversations :many
SELECT c.*, v.title AS vacancy_title,
       co.name AS company_name, co.slug AS company_slug, co.logo_url AS company_logo,
       u.full_name AS seeker_name, u.avatar_url AS seeker_avatar,
       COALESCE(r.last_read_id, 0)::bigint AS last_read_id,
       (SELECT count(*) FROM (SELECT 1 FROM messages m
            WHERE m.conversation_id = c.id AND m.id > COALESCE(r.last_read_id, 0)
              AND m.sender_id IS DISTINCT FROM sqlc.arg(user_id)::uuid AND m.deleted_at IS NULL
            LIMIT 100) x)::int AS unread
FROM conversations c
JOIN vacancies v ON v.id = c.vacancy_id
JOIN companies co ON co.id = c.company_id
JOIN users u ON u.id = c.seeker_id
LEFT JOIN conversation_reads r ON r.conversation_id = c.id AND r.user_id = sqlc.arg(user_id)::uuid
WHERE (c.seeker_id = sqlc.arg(user_id)::uuid
       OR c.company_id IN (SELECT company_id FROM company_members WHERE user_id = sqlc.arg(user_id)::uuid))
  AND (sqlc.narg(before_at)::timestamptz IS NULL
       OR (COALESCE(c.last_message_at, c.created_at), c.id) < (sqlc.narg(before_at), sqlc.narg(before_id)::uuid))
ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
LIMIT sqlc.arg(max_results);

-- name: CountUnreadConversations :one
SELECT count(*) FROM conversations c
LEFT JOIN conversation_reads r ON r.conversation_id = c.id AND r.user_id = sqlc.arg(user_id)::uuid
WHERE (c.seeker_id = sqlc.arg(user_id)::uuid
       OR c.company_id IN (SELECT company_id FROM company_members WHERE user_id = sqlc.arg(user_id)::uuid))
  AND c.last_message_id > COALESCE(r.last_read_id, 0)
  AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.id > COALESCE(r.last_read_id, 0)
              AND m.sender_id IS DISTINCT FROM sqlc.arg(user_id)::uuid AND m.deleted_at IS NULL);

-- name: InsertMessage :one
INSERT INTO messages (conversation_id, sender_id, kind, body, file_id, meta, client_id)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (sender_id, client_id) DO NOTHING
RETURNING *;

-- name: GetMessageByClientID :one
SELECT * FROM messages WHERE sender_id = $1 AND client_id = $2;

-- name: GetMessage :one
SELECT * FROM messages WHERE id = $1;

-- name: TouchConversation :exec
UPDATE conversations SET last_message_id = $2, last_message_at = $3 WHERE id = $1;

-- Pages go backwards from before_id (history) or forwards from after_id (catch-up
-- after a reconnect); results are always newest first.
-- name: ListMessages :many
SELECT * FROM messages
WHERE conversation_id = sqlc.arg(conversation_id)
  AND (sqlc.narg(before_id)::bigint IS NULL OR id < sqlc.narg(before_id))
  AND (sqlc.narg(after_id)::bigint IS NULL OR id > sqlc.narg(after_id))
ORDER BY id DESC
LIMIT sqlc.arg(max_results);

-- name: SoftDeleteMessage :one
UPDATE messages SET deleted_at = now(), body = '', file_id = NULL, meta = '{}'
WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL
RETURNING *;

-- Read positions only move forward.
-- name: MarkConversationRead :one
INSERT INTO conversation_reads (conversation_id, user_id, last_read_id) VALUES ($1, $2, $3)
ON CONFLICT (conversation_id, user_id) DO UPDATE
SET last_read_id = GREATEST(conversation_reads.last_read_id, EXCLUDED.last_read_id)
RETURNING last_read_id;

-- name: ListReadPositions :many
SELECT user_id, last_read_id FROM conversation_reads WHERE conversation_id = $1;

-- name: GetFilesByIDs :many
SELECT * FROM files WHERE id = ANY(sqlc.arg(ids)::uuid[]);

-- name: GetUsersBrief :many
SELECT id, full_name, avatar_url FROM users WHERE id = ANY(sqlc.arg(ids)::uuid[]);

-- name: GetMessagesByIDs :many
SELECT * FROM messages WHERE id = ANY(sqlc.arg(ids)::bigint[]);

-- Same shape as ListConversations, for one conversation.
-- name: GetConversationView :one
SELECT c.*, v.title AS vacancy_title,
       co.name AS company_name, co.slug AS company_slug, co.logo_url AS company_logo,
       u.full_name AS seeker_name, u.avatar_url AS seeker_avatar,
       COALESCE(r.last_read_id, 0)::bigint AS last_read_id,
       (SELECT count(*) FROM (SELECT 1 FROM messages m
            WHERE m.conversation_id = c.id AND m.id > COALESCE(r.last_read_id, 0)
              AND m.sender_id IS DISTINCT FROM sqlc.arg(user_id)::uuid AND m.deleted_at IS NULL
            LIMIT 100) x)::int AS unread
FROM conversations c
JOIN vacancies v ON v.id = c.vacancy_id
JOIN companies co ON co.id = c.company_id
JOIN users u ON u.id = c.seeker_id
LEFT JOIN conversation_reads r ON r.conversation_id = c.id AND r.user_id = sqlc.arg(user_id)::uuid
WHERE c.id = sqlc.arg(id);

-- name: ListReadPositionsFor :many
SELECT conversation_id, user_id, last_read_id FROM conversation_reads
WHERE conversation_id = ANY(sqlc.arg(ids)::uuid[]);
