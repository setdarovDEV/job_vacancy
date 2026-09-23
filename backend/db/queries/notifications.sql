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
