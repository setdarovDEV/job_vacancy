-- +goose Up
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Keeps updated_at current on every UPDATE. Shared by all tables that have the column.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TYPE user_role AS ENUM ('seeker', 'employer', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'blocked', 'deleted');
CREATE TYPE app_locale AS ENUM ('uz', 'uz-Cyrl', 'ru', 'en');

CREATE TABLE users (
    -- uuidv7 is time-ordered, so the primary key index stays append-mostly.
    id                uuid PRIMARY KEY DEFAULT uuidv7(),
    email             citext UNIQUE,
    email_verified_at timestamptz,
    phone             text UNIQUE,            -- E.164, e.g. +998901234567
    phone_verified_at timestamptz,
    password_hash     text,                   -- NULL for Google-only accounts
    google_sub        text UNIQUE,
    full_name         text        NOT NULL,
    avatar_url        text,
    role              user_role   NOT NULL DEFAULT 'seeker',
    status            user_status NOT NULL DEFAULT 'active',
    locale            app_locale  NOT NULL DEFAULT 'uz',
    last_seen_at      timestamptz,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_login_method CHECK (email IS NOT NULL OR phone IS NOT NULL OR google_sub IS NOT NULL),
    CONSTRAINT users_phone_e164 CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$')
);

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One row per logged-in device. The refresh token itself is never stored, only its SHA-256.
-- prev_refresh_hash lets us detect reuse of an already-rotated token (a sign of theft).
CREATE TABLE user_sessions (
    id                uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id           uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    refresh_hash      bytea       NOT NULL UNIQUE,
    prev_refresh_hash bytea,
    platform          text        NOT NULL DEFAULT 'web', -- web | android | ios
    user_agent        text        NOT NULL DEFAULT '',
    ip                inet,
    created_at        timestamptz NOT NULL DEFAULT now(),
    last_used_at      timestamptz NOT NULL DEFAULT now(),
    expires_at        timestamptz NOT NULL,
    revoked_at        timestamptz
);

CREATE INDEX user_sessions_user_active_idx ON user_sessions (user_id, last_used_at DESC)
    WHERE revoked_at IS NULL;
CREATE INDEX user_sessions_prev_hash_idx ON user_sessions (prev_refresh_hash)
    WHERE prev_refresh_hash IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS users;
DROP TYPE IF EXISTS app_locale;
DROP TYPE IF EXISTS user_status;
DROP TYPE IF EXISTS user_role;
DROP FUNCTION IF EXISTS set_updated_at();
