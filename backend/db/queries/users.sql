-- consent_version is the privacy policy version the user agreed to at sign-up (TZ FN-08);
-- the agreement time is the insert time.
-- name: CreateUser :one
INSERT INTO users (email, password_hash, full_name, role, locale, consent_version, consent_at)
VALUES ($1, $2, $3, $4, $5, sqlc.arg(consent_version)::text, now())
RETURNING *;

-- name: CreateGoogleUser :one
INSERT INTO users (email, email_verified_at, google_sub, full_name, avatar_url, role, locale,
                   consent_version, consent_at)
VALUES ($1, now(), $2, $3, $4, $5, $6, sqlc.arg(consent_version)::text, now())
RETURNING *;

-- name: SetUserConsent :one
UPDATE users SET consent_version = sqlc.arg(consent_version)::text, consent_at = now()
WHERE id = $1
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: GetUserByGoogleSub :one
SELECT * FROM users WHERE google_sub = $1;

-- name: LinkGoogleAccount :one
UPDATE users
SET google_sub        = $2,
    email_verified_at = COALESCE(email_verified_at, now()),
    avatar_url        = COALESCE(avatar_url, $3)
WHERE id = $1
RETURNING *;

-- name: MarkEmailVerified :one
UPDATE users SET email_verified_at = COALESCE(email_verified_at, now())
WHERE id = $1
RETURNING *;

-- name: SetVerifiedPhone :one
UPDATE users SET phone = $2, phone_verified_at = now()
WHERE id = $1
RETURNING *;

-- name: IsPhoneTaken :one
SELECT EXISTS (SELECT 1 FROM users WHERE phone = $1 AND id <> $2);

-- name: UpdatePassword :exec
UPDATE users SET password_hash = $2 WHERE id = $1;

-- name: UpdateProfile :one
UPDATE users
SET full_name   = COALESCE(sqlc.narg(full_name), full_name),
    locale      = COALESCE(sqlc.narg(locale), locale),
    hide_online = COALESCE(sqlc.narg(hide_online), hide_online)
WHERE id = $1
RETURNING *;

-- name: TouchLastSeen :exec
UPDATE users SET last_seen_at = now() WHERE id = $1;

-- name: SetUserRole :one
UPDATE users SET role = $2 WHERE email = $1 RETURNING *;
