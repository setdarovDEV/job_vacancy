-- name: InsertNotifications :many
INSERT INTO notifications (user_id, type, payload)
SELECT unnest(sqlc.arg(user_ids)::uuid[]), sqlc.arg(type), sqlc.arg(payload)
RETURNING id, user_id, created_at;

-- name: ListNotifications :many
SELECT * FROM notifications
WHERE user_id = sqlc.arg(user_id)
  AND (sqlc.narg(before_id)::bigint IS NULL OR id < sqlc.narg(before_id))
  AND (NOT sqlc.arg(unread_only)::boolean OR read_at IS NULL)
ORDER BY id DESC
LIMIT sqlc.arg(max_results);

-- name: CountUnreadNotifications :one
SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL;

-- name: MarkNotificationsRead :execrows
UPDATE notifications SET read_at = now()
WHERE user_id = sqlc.arg(user_id) AND read_at IS NULL
  AND (sqlc.narg(ids)::bigint[] IS NULL OR id = ANY(sqlc.narg(ids)::bigint[]));

-- name: GetNotificationTarget :one
SELECT id, email, email_verified_at, locale, telegram_chat_id, notify_email, notify_telegram, status
FROM users WHERE id = $1;

-- name: SetTelegramChat :exec
UPDATE users SET telegram_chat_id = $2 WHERE id = $1;

-- name: ClearTelegramChat :exec
UPDATE users SET telegram_chat_id = NULL WHERE telegram_chat_id = $1;

-- name: SetNotificationSettings :one
UPDATE users SET notify_email = $2, notify_telegram = $3 WHERE id = $1
RETURNING notify_email, notify_telegram, telegram_chat_id;

-- name: GetNotificationSettings :one
SELECT notify_email, notify_telegram, telegram_chat_id FROM users WHERE id = $1;

-- name: UpsertDeviceToken :exec
INSERT INTO device_tokens (token, user_id, platform) VALUES ($1, $2, $3)
ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, last_seen_at = now();

-- name: DeleteDeviceToken :exec
DELETE FROM device_tokens WHERE token = $1 AND user_id = $2;

-- name: ListDeviceTokens :many
SELECT token, platform FROM device_tokens WHERE user_id = $1;

-- name: ListCompanyMemberIDs :many
SELECT user_id FROM company_members WHERE company_id = $1;

-- Notifications made inside a business transaction (TZ BE-08): store them (when store),
-- and report which delivery channels each recipient actually has, so jobs are enqueued
-- only for those. One round trip. Payloads are per recipient (JSON text).
-- name: NotifyUsers :many
WITH t AS (
    SELECT DISTINCT ON (x.user_id) x.user_id, x.payload
    FROM (SELECT (sqlc.arg(user_ids)::uuid[])[i] AS user_id, (sqlc.arg(payloads)::text[])[i] AS payload
          FROM generate_subscripts(sqlc.arg(user_ids)::uuid[], 1) AS i) x
), ins AS (
    INSERT INTO notifications (user_id, type, payload)
    SELECT t.user_id, sqlc.arg(type), t.payload::jsonb FROM t WHERE sqlc.arg(store)::boolean
    RETURNING id, user_id, created_at
)
SELECT u.id AS user_id, ins.id AS notification_id, ins.created_at AS notified_at,
       (u.status = 'active' AND u.notify_email AND u.email IS NOT NULL
        AND u.email_verified_at IS NOT NULL)::boolean AS has_email,
       (u.status = 'active' AND u.notify_telegram AND u.telegram_chat_id IS NOT NULL)::boolean AS has_telegram,
       (u.status = 'active' AND EXISTS (SELECT 1 FROM device_tokens d WHERE d.user_id = u.id))::boolean AS has_push
FROM t
JOIN users u ON u.id = t.user_id
LEFT JOIN ins ON ins.user_id = t.user_id;

-- Same for every member of a company, one payload for all.
-- name: NotifyCompanyMembers :many
WITH ins AS (
    INSERT INTO notifications (user_id, type, payload)
    SELECT m.user_id, sqlc.arg(type), sqlc.arg(payload)::jsonb
    FROM company_members m WHERE m.company_id = sqlc.arg(company_id)
    RETURNING id, user_id, created_at
)
SELECT u.id AS user_id, ins.id AS notification_id, ins.created_at AS notified_at,
       (u.status = 'active' AND u.notify_email AND u.email IS NOT NULL
        AND u.email_verified_at IS NOT NULL)::boolean AS has_email,
       (u.status = 'active' AND u.notify_telegram AND u.telegram_chat_id IS NOT NULL)::boolean AS has_telegram,
       (u.status = 'active' AND EXISTS (SELECT 1 FROM device_tokens d WHERE d.user_id = u.id))::boolean AS has_push
FROM ins
JOIN users u ON u.id = ins.user_id;
