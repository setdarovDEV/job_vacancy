-- Image processing (TZ BE-14). The owner's choice is recorded in *_file_id at once; the
-- worker publishes the variants and swaps the shown URL only if that choice still holds.

-- name: ChooseUserAvatar :exec
UPDATE users SET avatar_file_id = sqlc.arg(file_id) WHERE id = sqlc.arg(id);

-- name: ChooseCompanyLogo :exec
UPDATE companies SET logo_file_id = sqlc.arg(file_id) WHERE id = sqlc.arg(id);

-- name: ChooseCompanyCover :exec
UPDATE companies SET cover_file_id = sqlc.arg(file_id) WHERE id = sqlc.arg(id);

-- ClearUserAvatar removes the avatar; it returns the URL that was shown (for cleanup).
-- name: ClearUserAvatar :one
UPDATE users u SET avatar_url = NULL, avatar_file_id = NULL
FROM (SELECT o.id, o.avatar_url FROM users o WHERE o.id = sqlc.arg(user_id) FOR UPDATE) old
WHERE u.id = old.id
RETURNING old.avatar_url AS old_url;

-- name: ClearCompanyLogo :one
UPDATE companies c SET logo_url = NULL, logo_file_id = NULL
FROM (SELECT o.id, o.logo_url FROM companies o WHERE o.id = sqlc.arg(company_id) FOR UPDATE) old
WHERE c.id = old.id
RETURNING old.logo_url AS old_url;

-- name: ClearCompanyCover :one
UPDATE companies c SET cover_url = NULL, cover_file_id = NULL, cover_lqip = NULL
FROM (SELECT o.id, o.cover_url FROM companies o WHERE o.id = sqlc.arg(company_id) FOR UPDATE) old
WHERE c.id = old.id
RETURNING old.cover_url AS old_url;

-- PublishUserAvatar shows the processed avatar if the user still wants this upload;
-- no row means they chose something else meanwhile.
-- name: PublishUserAvatar :one
UPDATE users u SET avatar_url = sqlc.arg(url)
FROM (SELECT o.id, o.avatar_url FROM users o WHERE o.id = sqlc.arg(user_id) FOR UPDATE) old
WHERE u.id = old.id AND u.avatar_file_id = sqlc.arg(file_id)
RETURNING old.avatar_url AS old_url;

-- name: PublishCompanyLogo :one
UPDATE companies c SET logo_url = sqlc.arg(url)
FROM (SELECT o.id, o.logo_url FROM companies o WHERE o.id = sqlc.arg(company_id) FOR UPDATE) old
WHERE c.id = old.id AND c.logo_file_id = sqlc.arg(file_id)
RETURNING old.logo_url AS old_url;

-- name: PublishCompanyCover :one
UPDATE companies c SET cover_url = sqlc.arg(url), cover_lqip = sqlc.narg(lqip)
FROM (SELECT o.id, o.cover_url FROM companies o WHERE o.id = sqlc.arg(company_id) FOR UPDATE) old
WHERE c.id = old.id AND c.cover_file_id = sqlc.arg(file_id)
RETURNING old.cover_url AS old_url;

-- AbandonUserAvatar forgets an upload that can't be processed, if it's still the choice.
-- name: AbandonUserAvatar :exec
UPDATE users SET avatar_file_id = NULL WHERE id = sqlc.arg(id) AND avatar_file_id = sqlc.arg(file_id);

-- name: AbandonCompanyLogo :exec
UPDATE companies SET logo_file_id = NULL WHERE id = sqlc.arg(id) AND logo_file_id = sqlc.arg(file_id);

-- name: AbandonCompanyCover :exec
UPDATE companies SET cover_file_id = NULL WHERE id = sqlc.arg(id) AND cover_file_id = sqlc.arg(file_id);

-- name: GetFileByKey :one
SELECT * FROM files WHERE object_key = $1;

-- name: SetFileMeta :exec
UPDATE files SET meta = $2 WHERE id = $1;

-- Legacy images (uploaded before processing existed) still shown straight from the
-- original upload; `ctl reprocess-images` queues them. Keyset by id.
-- name: LegacyAvatars :many
SELECT u.id, f.id AS file_id
FROM users u JOIN files f ON f.object_key = substr(u.avatar_url, length(sqlc.arg(base)::text) + 2)
WHERE u.avatar_url LIKE sqlc.arg(base)::text || '/avatar/%' AND u.id > sqlc.arg(after)
ORDER BY u.id LIMIT sqlc.arg(lim);

-- name: LegacyLogos :many
SELECT c.id, f.id AS file_id
FROM companies c JOIN files f ON f.object_key = substr(c.logo_url, length(sqlc.arg(base)::text) + 2)
WHERE c.logo_url LIKE sqlc.arg(base)::text || '/company-logo/%' AND c.id > sqlc.arg(after)
ORDER BY c.id LIMIT sqlc.arg(lim);

-- name: DeleteFiles :exec
DELETE FROM files WHERE id = ANY(sqlc.arg(ids)::uuid[]);
