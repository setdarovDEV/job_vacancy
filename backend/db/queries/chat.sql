-- name: GetConversationByApplication :one
SELECT * FROM conversations WHERE application_id = $1;

-- name: CreateConversation :one
INSERT INTO conversations (application_id, company_id, seeker_id, vacancy_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (application_id) DO UPDATE SET application_id = EXCLUDED.application_id
RETURNING *;

-- name: GetConversation :one
SELECT * FROM conversations WHERE id = $1;

-- Conversations of a user, most recently active first (TZ BE-04). Two branches, each on
-- its own index and LIMIT: conversations where the user is the seeker
-- (conversations_seeker_idx) and conversations of each company the user belongs to
-- (conversations_company_idx, one LATERAL scan per membership). The first page passes
-- before_at = far future, before_id = max uuid, so the seek is always an index condition.
-- Unread counts come from conversation_reads.unread_count (kept by triggers, 00017).
-- name: ListConversations :many
WITH page AS (
    (SELECT c.id, c.application_id, c.company_id, c.seeker_id, c.vacancy_id,
            c.last_message_id, c.last_message_at, c.created_at,
            COALESCE(c.last_message_at, c.created_at) AS sort_at
     FROM conversations c
     WHERE c.seeker_id = sqlc.arg(user_id)::uuid
       AND (COALESCE(c.last_message_at, c.created_at), c.id)
           < (sqlc.arg(before_at)::timestamptz, sqlc.arg(before_id)::uuid)
     ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
     LIMIT sqlc.arg(max_results))
    UNION ALL
    (SELECT x.id, x.application_id, x.company_id, x.seeker_id, x.vacancy_id,
            x.last_message_id, x.last_message_at, x.created_at, x.sort_at
     FROM company_members cm
     CROSS JOIN LATERAL (
         SELECT c.id, c.application_id, c.company_id, c.seeker_id, c.vacancy_id,
                c.last_message_id, c.last_message_at, c.created_at,
                COALESCE(c.last_message_at, c.created_at) AS sort_at
         FROM conversations c
         WHERE c.company_id = cm.company_id AND c.seeker_id <> sqlc.arg(user_id)::uuid
           AND (COALESCE(c.last_message_at, c.created_at), c.id)
               < (sqlc.arg(before_at)::timestamptz, sqlc.arg(before_id)::uuid)
         ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
         LIMIT sqlc.arg(max_results)) x
     WHERE cm.user_id = sqlc.arg(user_id)::uuid)
    ORDER BY sort_at DESC, id DESC
    LIMIT sqlc.arg(max_results)
)
SELECT p.id, p.application_id, p.company_id, p.seeker_id, p.vacancy_id,
       p.last_message_id, p.last_message_at, p.created_at,
       v.title AS vacancy_title,
       co.name AS company_name, co.slug AS company_slug, co.logo_url AS company_logo,
       u.full_name AS seeker_name, u.avatar_url AS seeker_avatar,
       COALESCE(r.last_read_id, 0)::bigint AS last_read_id,
       LEAST(COALESCE(r.unread_count, 0), 100)::int AS unread
FROM page p
JOIN vacancies v ON v.id = p.vacancy_id
JOIN companies co ON co.id = p.company_id
JOIN users u ON u.id = p.seeker_id
LEFT JOIN conversation_reads r ON r.conversation_id = p.id AND r.user_id = sqlc.arg(user_id)::uuid
ORDER BY p.sort_at DESC, p.id DESC;

-- Conversations with unread messages for the header badge (TZ BE-04): only rows with
-- unread_count > 0 are in conversation_reads_unread_idx. Rows left from a company the user
-- no longer belongs to are skipped.
-- name: CountUnreadConversations :one
SELECT count(*) FROM conversation_reads r
JOIN conversations c ON c.id = r.conversation_id
WHERE r.user_id = sqlc.arg(user_id)::uuid AND r.unread_count > 0
  AND (c.seeker_id = sqlc.arg(user_id)::uuid
       OR EXISTS (SELECT 1 FROM company_members m
                  WHERE m.company_id = c.company_id AND m.user_id = sqlc.arg(user_id)::uuid));

-- name: GetMessageByClientID :one
SELECT * FROM messages WHERE sender_id = $1 AND client_id = $2;

-- name: GetMessage :one
SELECT * FROM messages WHERE id = $1;

-- Pages go backwards from before_id (history) or forwards from after_id (catch-up
-- after a reconnect); results are always newest first. Sender and attachment come in the
-- same query.
-- name: ListMessages :many
SELECT sqlc.embed(m),
       u.full_name AS sender_name, u.avatar_url AS sender_avatar,
       f.id AS file_ref_id, f.owner_id AS file_owner_id, f.purpose AS file_purpose,
       f.status AS file_status, f.bucket AS file_bucket, f.object_key AS file_object_key,
       f.content_type AS file_content_type, f.size AS file_size, f.name AS file_name,
       f.meta AS file_meta, f.created_at AS file_created_at
FROM messages m
LEFT JOIN users u ON u.id = m.sender_id
LEFT JOIN files f ON f.id = m.file_id
WHERE m.conversation_id = sqlc.arg(conversation_id)
  AND (sqlc.narg(before_id)::bigint IS NULL OR m.id < sqlc.narg(before_id))
  AND (sqlc.narg(after_id)::bigint IS NULL OR m.id > sqlc.narg(after_id))
ORDER BY m.id DESC
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
SELECT c.id, c.application_id, c.company_id, c.seeker_id, c.vacancy_id,
       c.last_message_id, c.last_message_at, c.created_at,
       v.title AS vacancy_title,
       co.name AS company_name, co.slug AS company_slug, co.logo_url AS company_logo,
       u.full_name AS seeker_name, u.avatar_url AS seeker_avatar,
       COALESCE(r.last_read_id, 0)::bigint AS last_read_id,
       LEAST(COALESCE(r.unread_count, 0), 100)::int AS unread
FROM conversations c
JOIN vacancies v ON v.id = c.vacancy_id
JOIN companies co ON co.id = c.company_id
JOIN users u ON u.id = c.seeker_id
LEFT JOIN conversation_reads r ON r.conversation_id = c.id AND r.user_id = sqlc.arg(user_id)::uuid
WHERE c.id = sqlc.arg(id);

-- name: ListReadPositionsFor :many
SELECT conversation_id, user_id, last_read_id FROM conversation_reads
WHERE conversation_id = ANY(sqlc.arg(ids)::uuid[]);

-- Messages by id with sender and attachment in one query (last messages of a list page,
-- a message just sent).
-- name: GetMessagesWithRefs :many
SELECT sqlc.embed(m),
       u.full_name AS sender_name, u.avatar_url AS sender_avatar,
       f.id AS file_ref_id, f.owner_id AS file_owner_id, f.purpose AS file_purpose,
       f.status AS file_status, f.bucket AS file_bucket, f.object_key AS file_object_key,
       f.content_type AS file_content_type, f.size AS file_size, f.name AS file_name,
       f.meta AS file_meta, f.created_at AS file_created_at
FROM messages m
LEFT JOIN users u ON u.id = m.sender_id
LEFT JOIN files f ON f.id = m.file_id
WHERE m.id = ANY(sqlc.arg(ids)::bigint[]);

-- Conversations with everyone on the company side, for a page of ids (the participants
-- cache fills all its misses of a page with this one query).
-- name: GetConversationsWithMembers :many
SELECT sqlc.embed(c),
       ARRAY(SELECT m.user_id FROM company_members m WHERE m.company_id = c.company_id
             ORDER BY m.user_id)::uuid[] AS members
FROM conversations c
WHERE c.id = ANY(sqlc.arg(ids)::uuid[]);

-- Insert a message, move the conversation's last message and the sender's read position
-- in one statement. No row: the client_id was already used (a retried send). Unread
-- counters of the other participants are bumped by the messages trigger (00017).
-- name: SendMessage :one
WITH m AS (
    INSERT INTO messages (conversation_id, sender_id, kind, body, file_id, meta, client_id)
    VALUES (sqlc.arg(conversation_id), sqlc.arg(sender_id), sqlc.arg(kind), sqlc.arg(body),
            sqlc.narg(file_id), sqlc.arg(meta), sqlc.arg(client_id))
    ON CONFLICT (sender_id, client_id) DO NOTHING
    RETURNING *
), t AS (
    UPDATE conversations c SET last_message_id = m.id, last_message_at = m.created_at
    FROM m WHERE c.id = m.conversation_id
), r AS (
    INSERT INTO conversation_reads (conversation_id, user_id, last_read_id)
    SELECT m.conversation_id, m.sender_id, m.id FROM m
    ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET last_read_id = GREATEST(conversation_reads.last_read_id, EXCLUDED.last_read_id)
)
SELECT * FROM m;

-- Presence audience (TZ SEC-05): which of ids the viewer may see online — people they
-- share a conversation with (seeker ↔ members of the company, or colleagues in a company
-- that has conversations) and themselves. hide_online makes a user read as offline.
-- Each branch is an index lookup: conversations_seeker_idx, company_members_pkey,
-- company_members_user_idx, conversations_company_idx.
-- name: PresenceAudience :many
SELECT u.id, u.hide_online
FROM users u
WHERE u.id = ANY(sqlc.arg(ids)::uuid[])
  AND (u.id = sqlc.arg(viewer)::uuid
       OR EXISTS (SELECT 1 FROM conversations c
                  JOIN company_members m ON m.company_id = c.company_id AND m.user_id = u.id
                  WHERE c.seeker_id = sqlc.arg(viewer)::uuid)
       OR EXISTS (SELECT 1 FROM conversations c
                  JOIN company_members m ON m.company_id = c.company_id AND m.user_id = sqlc.arg(viewer)::uuid
                  WHERE c.seeker_id = u.id)
       OR EXISTS (SELECT 1 FROM company_members a
                  JOIN company_members b ON b.company_id = a.company_id AND b.user_id = u.id
                  WHERE a.user_id = sqlc.arg(viewer)::uuid
                    AND EXISTS (SELECT 1 FROM conversations c WHERE c.company_id = a.company_id)));

-- name: GetHideOnline :one
SELECT hide_online FROM users WHERE id = $1;
