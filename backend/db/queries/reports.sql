-- Reports ("shikoyat") on public vacancies and companies.

-- The company behind a vacancy anyone can see (the vacancy_is_public rule, migration 00013).
-- name: GetReportableVacancyCompany :one
SELECT company_id FROM vacancies WHERE id = $1 AND vacancy_is_public(status, company_id);

-- name: IsReportableCompany :one
SELECT EXISTS (SELECT 1 FROM companies WHERE id = $1 AND company_is_public(status));

-- name: CreateReport :one
INSERT INTO reports (reporter_id, target_type, vacancy_id, company_id, reason, comment)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- Targets having reports in the given status, newest report first, keyset on
-- (last_reported_at, target_id). Counts are over the reports in that status;
-- last_activity_at is the newest report or, for closed ones, when they were closed.
-- name: ListReportTargets :many
WITH g AS (
    SELECT r.target_type, r.target_id,
           count(*)::int                                          AS status_report_count,
           count(*) FILTER (WHERE r.reason = 'fraud')::int        AS fraud_count,
           count(*) FILTER (WHERE r.reason = 'misleading')::int   AS misleading_count,
           count(*) FILTER (WHERE r.reason = 'offensive')::int    AS offensive_count,
           count(*) FILTER (WHERE r.reason = 'spam')::int         AS spam_count,
           count(*) FILTER (WHERE r.reason = 'other')::int        AS other_count,
           min(r.created_at)::timestamptz                         AS first_reported_at,
           max(r.created_at)::timestamptz                         AS last_reported_at,
           max(coalesce(r.resolved_at, r.created_at))::timestamptz AS last_activity_at
    FROM reports r
    WHERE r.status = sqlc.arg(status)::report_status
      AND (sqlc.narg(target_type)::report_target IS NULL OR r.target_type = sqlc.narg(target_type)::report_target)
      AND (sqlc.narg(target_id)::uuid IS NULL OR r.target_id = sqlc.narg(target_id)::uuid)
    GROUP BY r.target_type, r.target_id
)
SELECT g.target_type, g.target_id, g.status_report_count, g.fraud_count, g.misleading_count, g.offensive_count,
       g.spam_count, g.other_count, g.first_reported_at, g.last_reported_at, g.last_activity_at,
       (SELECT count(*) FROM reports a WHERE a.target_id = g.target_id)::int AS total_report_count
FROM g
WHERE sqlc.narg(after_t)::timestamptz IS NULL
   OR (g.last_reported_at, g.target_id) < (sqlc.narg(after_t)::timestamptz, sqlc.narg(after_id)::uuid)
ORDER BY g.last_reported_at DESC, g.target_id DESC
LIMIT sqlc.arg(max_results);

-- name: ListReportedVacancies :many
SELECT v.id, v.title, v.slug, v.status, vacancy_is_public(v.status, v.company_id) AS is_public,
       c.id AS company_id, c.name AS company_name, c.slug AS company_slug, c.status AS company_status
FROM vacancies v JOIN companies c ON c.id = v.company_id
WHERE v.id = ANY(sqlc.arg(ids)::uuid[]);

-- name: ListReportedCompanies :many
SELECT c.id, c.name, c.slug, c.logo_url, c.status, company_is_public(c.status) AS is_public,
       (c.verified_at IS NOT NULL)::boolean AS verified
FROM companies c
WHERE c.id = ANY(sqlc.arg(ids)::uuid[]);

-- The newest few reports (in the given status) of each target, with the reporter's name.
-- name: ListLatestReports :many
SELECT x.id, x.target_id, x.reason, x.comment, x.created_at, u.full_name AS reporter_name
FROM (
    SELECT r.id, r.target_id, r.reason, r.comment, r.created_at, r.reporter_id,
           row_number() OVER (PARTITION BY r.target_id ORDER BY r.created_at DESC) AS rn
    FROM reports r
    WHERE r.target_id = ANY(sqlc.arg(target_ids)::uuid[]) AND r.status = sqlc.arg(status)::report_status
) x
JOIN users u ON u.id = x.reporter_id
WHERE x.rn <= sqlc.arg(per_target)::int
ORDER BY x.target_id, x.created_at DESC;

-- Closes every open report of a target; returns who filed them (to notify).
-- name: CloseOpenReports :many
UPDATE reports
SET status = sqlc.arg(status)::report_status, resolution_note = sqlc.narg(note),
    resolved_by = sqlc.arg(admin_id), resolved_at = now()
WHERE target_type = sqlc.arg(target_type)::report_target AND target_id = sqlc.arg(target_id)::uuid
  AND status = 'open'
RETURNING reporter_id;

-- name: TargetHasReports :one
SELECT EXISTS (SELECT 1 FROM reports WHERE target_type = $1 AND target_id = $2);
