-- +goose Up
-- Second factor (TOTP) for sign-in; mandatory for platform admins (ADMIN_2FA_REQUIRED).
-- The secret is sealed with AES-GCM (key from TOTP_ENC_KEY, see auth.SecondFactor);
-- last_step is the newest accepted 30 s step, so a code can't be replayed.
CREATE TABLE user_totp (
    user_id      uuid        PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    secret_enc   bytea       NOT NULL,
    confirmed_at timestamptz,
    last_step    bigint      NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- Single-use recovery codes, stored as SHA-256 (they are random, ~51 bits each).
CREATE TABLE user_recovery_codes (
    user_id   uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    code_hash bytea       NOT NULL,
    used_at   timestamptz,
    PRIMARY KEY (user_id, code_hash)
);

-- +goose Down
DROP TABLE IF EXISTS user_recovery_codes;
DROP TABLE IF EXISTS user_totp;
