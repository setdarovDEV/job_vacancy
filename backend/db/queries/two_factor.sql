-- name: GetUserTOTP :one
SELECT * FROM user_totp WHERE user_id = $1;

-- name: IsTOTPEnabled :one
SELECT EXISTS (SELECT 1 FROM user_totp WHERE user_id = $1 AND confirmed_at IS NOT NULL);

-- Replaces a pending (unconfirmed) secret; an enabled one is left alone (no row).
-- name: UpsertPendingTOTP :one
INSERT INTO user_totp (user_id, secret_enc) VALUES ($1, $2)
ON CONFLICT (user_id) DO UPDATE
SET secret_enc = EXCLUDED.secret_enc, last_step = 0, created_at = now()
WHERE user_totp.confirmed_at IS NULL
RETURNING *;

-- name: ConfirmTOTP :one
UPDATE user_totp SET confirmed_at = now(), last_step = $2
WHERE user_id = $1 AND confirmed_at IS NULL
RETURNING *;

-- Accepts a step only if it is newer than every accepted one (atomic replay guard).
-- name: UseTOTPStep :execrows
UPDATE user_totp SET last_step = $2 WHERE user_id = $1 AND confirmed_at IS NOT NULL AND last_step < $2;

-- name: DeleteTOTP :exec
DELETE FROM user_totp WHERE user_id = $1;

-- name: DeleteRecoveryCodes :exec
DELETE FROM user_recovery_codes WHERE user_id = $1;

-- name: InsertRecoveryCodes :exec
INSERT INTO user_recovery_codes (user_id, code_hash)
SELECT sqlc.arg(user_id)::uuid, unnest(sqlc.arg(hashes)::bytea[]);

-- name: UseRecoveryCode :execrows
UPDATE user_recovery_codes SET used_at = now()
WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL;

-- name: CountRecoveryCodesLeft :one
SELECT count(*)::int FROM user_recovery_codes WHERE user_id = $1 AND used_at IS NULL;
