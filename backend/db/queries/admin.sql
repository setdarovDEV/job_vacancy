-- Platform administration (mounted under /admin, admins only).

-- Deleted accounts are excluded everywhere: users_total counts active + blocked.
-- name: AdminStats :one
SELECT
    (SELECT count(*) FROM users WHERE status <> 'deleted')::int                                                AS users_total,
    (SELECT count(*) FROM users WHERE status <> 'deleted' AND created_at >= now() - interval '7 days')::int  AS users_signed_up_last_7d,
    (SELECT count(*) FROM users WHERE status = 'blocked')::int                                                 AS users_blocked,
    (SELECT count(*) FROM companies)::int                                                                       AS companies_total,
    (SELECT count(*) FROM companies WHERE status = 'active' AND verified_at IS NULL)::int                      AS companies_active_unverified,
    (SELECT count(*) FROM companies WHERE status = 'blocked')::int                                              AS companies_blocked,
    (SELECT count(*) FROM vacancies WHERE status = 'published')::int                                            AS vacancies_published,
    (SELECT count(*) FROM vacancies WHERE status = 'moderation')::int                                           AS vacancies_pending_moderation,
    (SELECT count(*) FROM applications WHERE created_at >= now() - interval '7 days')::int                     AS applications_sent_last_7d,
    (SELECT count(DISTINCT target_id) FROM reports WHERE status = 'open')::int                                  AS reports_open_targets,
    (SELECT count(*) FROM skills WHERE NOT is_verified)::int                                                    AS skills_unverified;

-- Newest first, keyset on (created_at, id). status / verified are independent filters.
-- name: AdminListCompanies :many
SELECT sqlc.embed(c),
       u.full_name AS owner_name, u.email AS owner_email,
       (SELECT count(*) FROM vacancies v WHERE v.company_id = c.id AND v.status = 'published')::int AS open_vacancies
FROM companies c
JOIN users u ON u.id = c.owner_id
WHERE (sqlc.narg(q)::text IS NULL OR lower(c.name) LIKE '%' || lower(sqlc.narg(q)::text) || '%'
       OR c.slug LIKE '%' || lower(sqlc.narg(q)::text) || '%')
  AND (sqlc.narg(status)::company_status IS NULL OR c.status = sqlc.narg(status)::company_status)
  AND (sqlc.narg(verified)::boolean IS NULL OR (c.verified_at IS NOT NULL) = sqlc.narg(verified)::boolean)
  AND (sqlc.narg(after_t)::timestamptz IS NULL
       OR (c.created_at, c.id) < (sqlc.narg(after_t)::timestamptz, sqlc.narg(after_id)::uuid))
ORDER BY c.created_at DESC, c.id DESC
LIMIT sqlc.arg(max_results);

-- Same projection as AdminListCompanies, for mutation responses.
-- name: AdminGetCompany :one
SELECT sqlc.embed(c),
       u.full_name AS owner_name, u.email AS owner_email,
       (SELECT count(*) FROM vacancies v WHERE v.company_id = c.id AND v.status = 'published')::int AS open_vacancies
FROM companies c
JOIN users u ON u.id = c.owner_id
WHERE c.id = $1;

-- Newest first, keyset on (created_at, id). Deleted accounts are never listed.
-- name: AdminListUsers :many
SELECT * FROM users u
WHERE u.status <> 'deleted'
  AND (sqlc.narg(q)::text IS NULL
       OR lower(u.full_name) LIKE '%' || lower(sqlc.narg(q)::text) || '%'
       OR u.email::text LIKE '%' || lower(sqlc.narg(q)::text) || '%'
       OR u.phone LIKE '%' || sqlc.narg(q)::text || '%')
  AND (sqlc.narg(role)::user_role IS NULL OR u.role = sqlc.narg(role)::user_role)
  AND (sqlc.narg(status)::user_status IS NULL OR u.status = sqlc.narg(status)::user_status)
  AND (sqlc.narg(after_t)::timestamptz IS NULL
       OR (u.created_at, u.id) < (sqlc.narg(after_t)::timestamptz, sqlc.narg(after_id)::uuid))
ORDER BY u.created_at DESC, u.id DESC
LIMIT sqlc.arg(max_results);

-- name: SetUserStatus :one
UPDATE users SET status = $2 WHERE id = $1 AND status <> 'deleted' RETURNING *;

-- name: SetUserRoleByID :one
UPDATE users SET role = $2 WHERE id = $1 AND status <> 'deleted' RETURNING *;

-- Skill directory (view skill_directory, migration 00015). Lists and mutation responses
-- return the same rows.
-- name: AdminGetSkill :one
SELECT * FROM skill_directory WHERE id = $1;

-- name: AdminGetSkills :many
SELECT * FROM skill_directory WHERE id = ANY(sqlc.arg(ids)::int[]) ORDER BY name, id;

-- Newest first, keyset on (created_at, id).
-- name: AdminListSkillsNewest :many
SELECT * FROM skill_directory d
WHERE (sqlc.narg(q)::text IS NULL OR lower(d.name) LIKE '%' || lower(sqlc.narg(q)::text) || '%'
       OR d.slug LIKE '%' || lower(sqlc.narg(q)::text) || '%')
  AND (sqlc.narg(verified)::boolean IS NULL OR d.is_verified = sqlc.narg(verified)::boolean)
  AND (sqlc.narg(after_t)::timestamptz IS NULL
       OR (d.created_at, d.id) < (sqlc.narg(after_t)::timestamptz, sqlc.narg(after_id)::int))
ORDER BY d.created_at DESC, d.id DESC
LIMIT sqlc.arg(max_results);

-- Most popular first (autocomplete ranking), keyset on (popularity, id).
-- name: AdminListSkillsByPopularity :many
SELECT * FROM skill_directory d
WHERE (sqlc.narg(q)::text IS NULL OR lower(d.name) LIKE '%' || lower(sqlc.narg(q)::text) || '%'
       OR d.slug LIKE '%' || lower(sqlc.narg(q)::text) || '%')
  AND (sqlc.narg(verified)::boolean IS NULL OR d.is_verified = sqlc.narg(verified)::boolean)
  AND (sqlc.narg(after_n)::int IS NULL
       OR (d.popularity, d.id) < (sqlc.narg(after_n)::int, sqlc.narg(after_id)::int))
ORDER BY d.popularity DESC, d.id DESC
LIMIT sqlc.arg(max_results);

-- Most listed right now first (vacancies + resumes), keyset on (in_use, id).
-- name: AdminListSkillsInUse :many
SELECT * FROM skill_directory d
WHERE (sqlc.narg(q)::text IS NULL OR lower(d.name) LIKE '%' || lower(sqlc.narg(q)::text) || '%'
       OR d.slug LIKE '%' || lower(sqlc.narg(q)::text) || '%')
  AND (sqlc.narg(verified)::boolean IS NULL OR d.is_verified = sqlc.narg(verified)::boolean)
  AND (sqlc.narg(after_n)::int IS NULL
       OR (d.in_use, d.id) < (sqlc.narg(after_n)::int, sqlc.narg(after_id)::int))
ORDER BY d.in_use DESC, d.id DESC
LIMIT sqlc.arg(max_results);
