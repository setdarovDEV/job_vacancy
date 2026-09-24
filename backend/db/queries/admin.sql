-- Admin panel (TZ FN-01). Every write here is paired with an InsertAuditLog row in the
-- same transaction. Lists page by keyset on uuidv7 ids (newest first) and run with
-- postgres.PlanPerCall, so the optional filters fold away and the right index is chosen.

-- name: InsertAuditLog :exec
INSERT INTO admin_audit_log (admin_id, action, object_type, object_id, details, ip)
VALUES (sqlc.narg(admin_id), sqlc.arg(action), sqlc.arg(object_type), sqlc.arg(object_id),
        sqlc.arg(details)::jsonb, sqlc.narg(ip));

-- name: ListAuditLog :many
SELECT l.id, l.admin_id, l.action, l.object_type, l.object_id, l.details, l.ip, l.created_at,
       u.full_name AS admin_name, u.email AS admin_email
FROM admin_audit_log l
LEFT JOIN users u ON u.id = l.admin_id
WHERE (sqlc.narg(object_type)::text IS NULL OR l.object_type = sqlc.narg(object_type)::text)
  AND (sqlc.narg(object_id)::text IS NULL OR l.object_id = sqlc.narg(object_id)::text)
  AND (sqlc.narg(admin_id)::uuid IS NULL OR l.admin_id = sqlc.narg(admin_id)::uuid)
  AND (sqlc.narg(before_id)::uuid IS NULL OR l.id < sqlc.narg(before_id)::uuid)
ORDER BY l.id DESC
LIMIT sqlc.arg(max_results);

-- ---- users -----------------------------------------------------------------------------

-- q is lower-cased with LIKE wildcards escaped by the caller; the expression matches
-- users_admin_search_idx (trigram GIN).
-- name: AdminSearchUsers :many
SELECT id, email, phone, full_name, avatar_url, role, status, email_verified_at,
       phone_verified_at, last_seen_at, created_at, deleted_at
FROM users
WHERE (sqlc.narg(q)::text IS NULL
       OR (lower(full_name) || ' ' || coalesce(lower(email::text), '') || ' ' || coalesce(phone, ''))
          LIKE '%' || sqlc.narg(q)::text || '%')
  AND (sqlc.narg(role)::user_role IS NULL OR role = sqlc.narg(role)::user_role)
  AND (sqlc.narg(status)::user_status IS NULL OR status = sqlc.narg(status)::user_status)
  AND (sqlc.narg(before_id)::uuid IS NULL OR id < sqlc.narg(before_id)::uuid)
ORDER BY id DESC
LIMIT sqlc.arg(max_results);

-- name: SetUserStatus :one
UPDATE users SET status = sqlc.arg(status)
WHERE id = sqlc.arg(id) AND status = sqlc.arg(from_status)
RETURNING *;

-- Unpublishing (a blocked user's or company's vacancies, a closed company): live
-- vacancies are archived and stamped as moderated now, so republishing them later goes
-- through moderation again (TZ FN-04). Returns what the response caches must drop.
-- Served by vacancies_created_by_live_idx.
-- name: UnpublishUserVacancies :many
UPDATE vacancies v
SET status = 'archived', moderated_by = sqlc.narg(admin_id), moderated_at = now()
FROM companies c
WHERE c.id = v.company_id AND v.created_by = sqlc.arg(user_id) AND v.status IN ('published', 'moderation')
RETURNING v.id, v.slug, v.company_id, c.slug AS company_slug;

-- Served by vacancies_company_idx.
-- name: UnpublishCompanyVacancies :many
UPDATE vacancies v
SET status = 'archived', moderated_by = sqlc.narg(admin_id), moderated_at = now()
FROM companies c
WHERE c.id = v.company_id AND v.company_id = sqlc.arg(company_id) AND v.status IN ('published', 'moderation')
RETURNING v.id, v.slug, v.company_id, c.slug AS company_slug;

-- ---- companies ---------------------------------------------------------------------------

-- name: AdminListCompanies :many
SELECT sqlc.embed(c), u.full_name AS owner_name, u.email AS owner_email
FROM companies c
JOIN users u ON u.id = c.owner_id
WHERE (sqlc.narg(q)::text IS NULL OR lower(c.name) LIKE '%' || sqlc.narg(q)::text || '%')
  AND (sqlc.narg(status)::company_status IS NULL OR c.status = sqlc.narg(status)::company_status)
  AND (sqlc.narg(verified)::boolean IS NULL OR (c.verified_at IS NOT NULL) = sqlc.narg(verified)::boolean)
  AND (sqlc.narg(before_id)::uuid IS NULL OR c.id < sqlc.narg(before_id)::uuid)
ORDER BY c.id DESC
LIMIT sqlc.arg(max_results);

-- name: SetCompanyStatus :one
UPDATE companies SET status = sqlc.arg(status)
WHERE id = sqlc.arg(id) AND status = sqlc.arg(from_status)
RETURNING *;

-- ---- skills ------------------------------------------------------------------------------

-- Usage counts are index-only scans of vacancy_skills_skill_idx / resume_skills_skill_idx.
-- name: AdminListSkills :many
SELECT s.id, s.name, s.slug, s.is_verified, s.usage_count, s.created_at,
       (SELECT count(*) FROM vacancy_skills vs WHERE vs.skill_id = s.id)::bigint AS vacancies,
       (SELECT count(*) FROM resume_skills rs WHERE rs.skill_id = s.id)::bigint AS resumes
FROM skills s
WHERE (sqlc.narg(q)::text IS NULL OR lower(s.name) LIKE '%' || sqlc.narg(q)::text || '%')
  AND (sqlc.narg(verified)::boolean IS NULL OR s.is_verified = sqlc.narg(verified)::boolean)
  AND (sqlc.narg(before_id)::int IS NULL OR s.id < sqlc.narg(before_id)::int)
ORDER BY s.id DESC
LIMIT sqlc.arg(max_results);

-- name: SetSkillVerified :one
UPDATE skills SET is_verified = sqlc.arg(verified) WHERE id = sqlc.arg(id)
RETURNING id, name, slug, is_verified, usage_count, created_at;

-- name: LockSkills :many
SELECT id, name, slug, is_verified, usage_count FROM skills
WHERE id = ANY(sqlc.arg(ids)::int[])
ORDER BY id
FOR UPDATE;

-- Merging moves every vacancy and resume of skill from_id to into_id (keeping into_id's
-- rows where both exist) and adds the usage count. All CTEs read the same snapshot, so the
-- returned ids are the vacancies that had from_id. from_id is deleted afterwards (its
-- remaining rows cascade) by DeleteSkill.
-- name: MergeSkill :one
WITH mv AS (
    INSERT INTO vacancy_skills (vacancy_id, skill_id)
    SELECT vacancy_id, sqlc.arg(into_id)::int FROM vacancy_skills WHERE skill_id = sqlc.arg(from_id)::int
    ON CONFLICT DO NOTHING
), mr AS (
    INSERT INTO resume_skills (resume_id, skill_id)
    SELECT resume_id, sqlc.arg(into_id)::int FROM resume_skills WHERE skill_id = sqlc.arg(from_id)::int
    ON CONFLICT DO NOTHING
), mu AS (
    UPDATE skills SET usage_count = usage_count + (SELECT f.usage_count FROM skills f WHERE f.id = sqlc.arg(from_id)::int)
    WHERE id = sqlc.arg(into_id)::int
)
SELECT coalesce((SELECT array_agg(vacancy_id) FROM vacancy_skills WHERE skill_id = sqlc.arg(from_id)::int), '{}')::uuid[] AS vacancy_ids,
       (SELECT count(*) FROM resume_skills WHERE skill_id = sqlc.arg(from_id)::int)::bigint AS resumes;

-- name: DeleteSkill :execrows
DELETE FROM skills WHERE id = $1;

-- ---- statistics --------------------------------------------------------------------------

-- New users, vacancies and applications per day (Asia/Tashkent days) over the last
-- `days` days, oldest first; one range scan per table over its BRIN index (00020).
-- name: AdminDailyStats :many
WITH days AS (
    SELECT d::date AS day
    FROM generate_series(((now() AT TIME ZONE 'Asia/Tashkent')::date - (sqlc.arg(days)::int - 1))::timestamp,
                         (now() AT TIME ZONE 'Asia/Tashkent')::date::timestamp, interval '1 day') AS d
), since AS (
    SELECT (min(day)::timestamp AT TIME ZONE 'Asia/Tashkent') AS t FROM days
), u AS (
    SELECT (created_at AT TIME ZONE 'Asia/Tashkent')::date AS day, count(*) AS n
    FROM users WHERE created_at >= (SELECT t FROM since) GROUP BY 1
), v AS (
    SELECT (created_at AT TIME ZONE 'Asia/Tashkent')::date AS day, count(*) AS n
    FROM vacancies WHERE created_at >= (SELECT t FROM since) GROUP BY 1
), a AS (
    SELECT (created_at AT TIME ZONE 'Asia/Tashkent')::date AS day, count(*) AS n
    FROM applications WHERE created_at >= (SELECT t FROM since) GROUP BY 1
)
SELECT days.day::date AS day, coalesce(u.n, 0)::bigint AS registrations,
       coalesce(v.n, 0)::bigint AS vacancies, coalesce(a.n, 0)::bigint AS applications
FROM days
LEFT JOIN u ON u.day = days.day
LEFT JOIN v ON v.day = days.day
LEFT JOIN a ON a.day = days.day
ORDER BY days.day;

-- Current totals for the dashboard. The user counts share one scan; the others are
-- index-only counts over partial indexes.
-- name: AdminTotals :one
SELECT u.users, u.seekers, u.employers, u.blocked_users,
       (SELECT count(*) FROM companies WHERE status = 'active')::bigint AS companies,
       (SELECT count(*) FROM vacancies WHERE status = 'published')::bigint AS published_vacancies,
       (SELECT count(*) FROM vacancies WHERE status = 'moderation')::bigint AS moderation_queue,
       (SELECT count(*) FROM reports WHERE status = 'open')::bigint AS open_reports
FROM (SELECT count(*) FILTER (WHERE status <> 'deleted')::bigint AS users,
             count(*) FILTER (WHERE status = 'active' AND role = 'seeker')::bigint AS seekers,
             count(*) FILTER (WHERE status = 'active' AND role = 'employer')::bigint AS employers,
             count(*) FILTER (WHERE status = 'blocked')::bigint AS blocked_users
      FROM users) u;
