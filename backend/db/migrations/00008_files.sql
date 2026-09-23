-- +goose Up

-- avatar, company_logo: public bucket, served by nginx at /media.
-- chat_image, chat_file, chat_voice: private bucket, read through short-lived signed URLs.
CREATE TYPE file_purpose AS ENUM ('avatar', 'company_logo', 'chat_image', 'chat_file', 'chat_voice');
CREATE TYPE file_status AS ENUM ('pending', 'ready');

-- Uploads go straight from the client to object storage with a presigned POST; this row
-- tracks the object. It becomes 'ready' once the server has checked what was uploaded.
CREATE TABLE files (
    id           uuid PRIMARY KEY DEFAULT uuidv7(),
    owner_id     uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose      file_purpose NOT NULL,
    status       file_status  NOT NULL DEFAULT 'pending',
    bucket       text         NOT NULL,
    object_key   text         NOT NULL UNIQUE,
    content_type text         NOT NULL,
    size         bigint       NOT NULL DEFAULT 0,
    name         text         NOT NULL DEFAULT '',
    -- voice: duration_ms; image: width/height (client-reported, used for layout only)
    meta         jsonb        NOT NULL DEFAULT '{}',
    created_at   timestamptz  NOT NULL DEFAULT now()
);
CREATE INDEX files_owner_idx ON files (owner_id, created_at DESC);
CREATE INDEX files_pending_idx ON files (created_at) WHERE status = 'pending';

-- +goose Down
DROP TABLE IF EXISTS files;
DROP TYPE IF EXISTS file_status;
DROP TYPE IF EXISTS file_purpose;
