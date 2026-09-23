-- +goose Up

CREATE TABLE notifications (
    id         bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type       text        NOT NULL,   -- application.new, application.status, vacancy.approved, …
    payload    jsonb       NOT NULL DEFAULT '{}',
    read_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, id DESC);
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE users
    ADD COLUMN telegram_chat_id bigint UNIQUE,
    ADD COLUMN notify_email     boolean NOT NULL DEFAULT true,
    ADD COLUMN notify_telegram  boolean NOT NULL DEFAULT true;

-- Push tokens (FCM for Android/iOS).
CREATE TABLE device_tokens (
    token        text PRIMARY KEY,
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    platform     text        NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX device_tokens_user_idx ON device_tokens (user_id);

-- +goose Down
DROP TABLE IF EXISTS device_tokens;
ALTER TABLE users
    DROP COLUMN IF EXISTS notify_telegram,
    DROP COLUMN IF EXISTS notify_email,
    DROP COLUMN IF EXISTS telegram_chat_id;
DROP TABLE IF EXISTS notifications;
