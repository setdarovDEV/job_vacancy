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

-- ctl two-factor enroll: an enabled secret in one step (the operator hands over the QR).
-- name: InsertConfirmedTOTP :exec
INSERT INTO user_totp (user_id, secret_enc, confirmed_at) VALUES ($1, $2, now());

-- name: MarkSessionSecondFactor :execrows
UPDATE user_sessions SET mfa_at = now()
WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL;

-- name: RevokeOtherUserSessions :many
UPDATE user_sessions SET revoked_at = now()
WHERE user_id = $1 AND id <> sqlc.arg(keep)::uuid AND revoked_at IS NULL
RETURNING id;

-- What the /admin gate needs: is 2FA on, and did this session prove it.
-- name: SecondFactorState :one
SELECT
    EXISTS (SELECT 1 FROM user_totp t WHERE t.user_id = sqlc.arg(user_id)::uuid AND t.confirmed_at IS NOT NULL) AS enabled,
    EXISTS (SELECT 1 FROM user_sessions s WHERE s.id = sqlc.arg(session_id)::uuid AND s.user_id = sqlc.arg(user_id)::uuid
                                          AND s.revoked_at IS NULL AND s.mfa_at IS NOT NULL) AS session_verified;
