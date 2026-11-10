-- Platform administration (mounted under /admin, admins only).

-- Deleted accounts are excluded everywhere: users_total counts active + blocked (admins
-- included). The *_last_7d counters use the same window and rules as the statistics
-- series for days = 7 (see below): signups are seekers and employers only, applications
-- are the ones seekers sent. vacancies_live is what is published right now.
-- name: AdminStats :one
SELECT
    (SELECT count(*) FROM users WHERE status <> 'deleted')::int                                                AS users_total,
    (SELECT count(*) FROM users WHERE status <> 'deleted' AND role <> 'admin'
                                  AND created_at >= stats_period_start(7))::int                                 AS users_signed_up_last_7d,
    (SELECT count(*) FROM users WHERE status = 'blocked')::int                                                 AS users_blocked,
    (SELECT count(*) FROM companies)::int                                                                       AS companies_total,
    (SELECT count(*) FROM companies WHERE status = 'active' AND verified_at IS NULL)::int                      AS companies_active_unverified,
    (SELECT count(*) FROM companies WHERE status = 'blocked')::int                                              AS companies_blocked,
    (SELECT count(*) FROM vacancies WHERE status = 'published')::int                                            AS vacancies_live,
    (SELECT count(*) FROM vacancies WHERE status = 'moderation')::int                                           AS vacancies_pending_moderation,
    (SELECT count(*) FROM applications WHERE source = 'apply' AND created_at >= stats_period_start(7))::int    AS applications_sent_last_7d,
    (SELECT count(DISTINCT target_id) FROM reports WHERE status = 'open')::int                                  AS reports_open_targets,
    (SELECT count(*) FROM skills WHERE NOT is_verified)::int                                                    AS skills_unverified,
    (SELECT count(*) FROM feedback WHERE handled_at IS NULL)::int                                               AS feedback_unhandled;

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

-- ---- statistics ---------------------------------------------------------------------------
-- Days are calendar days in Asia/Tashkent; a period of N days ends today and includes it
-- (stats_today / stats_period_start, migration 00016). Deleted accounts are excluded and
-- signups are split by the account's current role; applications count only those a seeker
-- sent (source = 'apply'), not employer invitations. Vacancies count by published_at,
-- whatever their status now.

-- name: AdminStatsToday :one
SELECT stats_today()::date AS today;

-- One zero-filled row per day for the last 2 × days days, oldest first: the older half
-- is the previous period.
-- name: AdminDailyActivity :many
WITH days AS (
    SELECT d::date AS day
    FROM generate_series(stats_today() - (2 * sqlc.arg(days)::int - 1), stats_today(), interval '1 day') AS d
), u AS (
    SELECT (created_at AT TIME ZONE 'Asia/Tashkent')::date AS day,
           count(*) FILTER (WHERE role = 'seeker')   AS seekers,
           count(*) FILTER (WHERE role = 'employer') AS employers
    FROM users
    WHERE created_at >= stats_period_start(2 * sqlc.arg(days)::int) AND status <> 'deleted'
    GROUP BY 1
), v AS (
    SELECT (published_at AT TIME ZONE 'Asia/Tashkent')::date AS day, count(*) AS n
    FROM vacancies
    WHERE published_at >= stats_period_start(2 * sqlc.arg(days)::int)
    GROUP BY 1
), a AS (
    SELECT (created_at AT TIME ZONE 'Asia/Tashkent')::date AS day, count(*) AS n
    FROM applications
    WHERE created_at >= stats_period_start(2 * sqlc.arg(days)::int) AND source = 'apply'
    GROUP BY 1
), r AS (
    SELECT (created_at AT TIME ZONE 'Asia/Tashkent')::date AS day, count(*) AS n
    FROM reports
    WHERE created_at >= stats_period_start(2 * sqlc.arg(days)::int)
    GROUP BY 1
)
SELECT days.day::date                  AS day,
       coalesce(u.seekers, 0)::int     AS signups_seeker,
       coalesce(u.employers, 0)::int   AS signups_employer,
       coalesce(v.n, 0)::int           AS vacancies_published,
       coalesce(a.n, 0)::int           AS applications_sent,
       coalesce(r.n, 0)::int           AS reports_filed
FROM days
LEFT JOIN u ON u.day = days.day
LEFT JOIN v ON v.day = days.day
LEFT JOIN a ON a.day = days.day
LEFT JOIN r ON r.day = days.day
ORDER BY days.day;

-- Top-level categories (a vacancy's leaf category rolls up to its parent) by vacancies
-- published in the period.
-- name: AdminTopCategories :many
SELECT c.id, c.slug, c.name_uz, c.name_uz_cyrl, c.name_ru, c.name_en, count(*)::int AS vacancies_published
FROM vacancies v
JOIN categories leaf ON leaf.id = v.category_id
JOIN categories c ON c.id = coalesce(leaf.parent_id, leaf.id)
WHERE v.published_at >= stats_period_start(sqlc.arg(days)::int)
GROUP BY c.id
ORDER BY count(*) DESC, c.sort_order, c.id
LIMIT sqlc.arg(max_results);

-- Regions (vacancies always carry the top-level region) by vacancies published in the period.
-- name: AdminTopRegions :many
SELECT g.id, g.slug, g.name_uz, g.name_uz_cyrl, g.name_ru, g.name_en, count(*)::int AS vacancies_published
FROM vacancies v
JOIN regions g ON g.id = v.region_id
WHERE v.published_at >= stats_period_start(sqlc.arg(days)::int)
GROUP BY g.id
ORDER BY count(*) DESC, g.sort_order, g.id
LIMIT sqlc.arg(max_results);

-- Applications sent in the period and how many reached each later stage, ever (the
-- history counts, so an application later rejected still counts as invited):
--   viewed  = the employer opened it (viewed_at) or moved it to invited/interview/hired;
--   invited = it was ever invited, at interview or hired;
--   hired   = it was ever hired.
-- Keep in step with application_status (migration 00007) and the employer transitions in
-- application.Service.
-- name: AdminApplicationFunnel :one
WITH a AS (
    SELECT a.id, a.status, a.viewed_at,
           a.status IN ('invited', 'interview', 'hired') OR EXISTS (
               SELECT 1 FROM application_events e
               WHERE e.application_id = a.id AND e.to_status IN ('invited', 'interview', 'hired')) AS invited,
           a.status = 'hired' OR EXISTS (
               SELECT 1 FROM application_events e
               WHERE e.application_id = a.id AND e.to_status = 'hired') AS hired
    FROM applications a
    WHERE a.source = 'apply' AND a.created_at >= stats_period_start(sqlc.arg(days)::int)
)
SELECT count(*)::int                                                 AS sent,
       count(*) FILTER (WHERE viewed_at IS NOT NULL OR invited)::int AS viewed,
       count(*) FILTER (WHERE invited)::int                          AS invited,
       count(*) FILTER (WHERE hired)::int                            AS hired
FROM a;
