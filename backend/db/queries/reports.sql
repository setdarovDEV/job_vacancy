-- Vacancy reports (TZ FN-02).

-- One report per user and vacancy: a repeat returns no row.
-- name: CreateReport :one
INSERT INTO reports (object_type, object_id, reporter_id, reason, comment)
VALUES ('vacancy', sqlc.arg(object_id), sqlc.arg(reporter_id), sqlc.arg(reason), sqlc.arg(comment))
ON CONFLICT ON CONSTRAINT reports_once_per_user DO NOTHING
RETURNING *;

-- Served by the reports_once_per_user unique index.
-- name: CountOpenReports :one
SELECT count(*) FROM reports
WHERE object_type = sqlc.arg(object_type) AND object_id = sqlc.arg(object_id) AND status = 'open';

-- The admin queue. Open reports oldest first (FIFO); resolved and dismissed ones newest
-- first. Each row carries the reported vacancy and how many open reports it has.
-- name: ListOpenReports :many
SELECT r.id, r.object_type, r.object_id, r.reporter_id, r.reason, r.comment, r.status,
       r.resolved_by, r.resolved_at, r.resolution_note, r.created_at,
       ru.full_name AS reporter_name, ru.email AS reporter_email,
       v.title AS vacancy_title, v.slug AS vacancy_slug, v.status AS vacancy_status,
       c.id AS company_id, c.name AS company_name, c.slug AS company_slug,
       (SELECT count(*) FROM reports o
        WHERE o.object_type = r.object_type AND o.object_id = r.object_id AND o.status = 'open')::bigint AS open_reports
FROM reports r
LEFT JOIN users ru ON ru.id = r.reporter_id
LEFT JOIN vacancies v ON r.object_type = 'vacancy' AND v.id = r.object_id
LEFT JOIN companies c ON c.id = v.company_id
WHERE r.status = 'open'
  AND (sqlc.narg(object_id)::uuid IS NULL OR r.object_id = sqlc.narg(object_id)::uuid)
  AND (sqlc.narg(after_id)::uuid IS NULL OR r.id > sqlc.narg(after_id)::uuid)
ORDER BY r.id
LIMIT sqlc.arg(max_results);

-- name: ListClosedReports :many
SELECT r.id, r.object_type, r.object_id, r.reporter_id, r.reason, r.comment, r.status,
       r.resolved_by, r.resolved_at, r.resolution_note, r.created_at,
       ru.full_name AS reporter_name, ru.email AS reporter_email,
       v.title AS vacancy_title, v.slug AS vacancy_slug, v.status AS vacancy_status,
       c.id AS company_id, c.name AS company_name, c.slug AS company_slug,
       0::bigint AS open_reports
FROM reports r
LEFT JOIN users ru ON ru.id = r.reporter_id
LEFT JOIN vacancies v ON r.object_type = 'vacancy' AND v.id = r.object_id
LEFT JOIN companies c ON c.id = v.company_id
WHERE r.status = sqlc.arg(status)
  AND (sqlc.narg(object_id)::uuid IS NULL OR r.object_id = sqlc.narg(object_id)::uuid)
  AND (sqlc.narg(before_id)::uuid IS NULL OR r.id < sqlc.narg(before_id)::uuid)
ORDER BY r.id DESC
LIMIT sqlc.arg(max_results);

-- name: GetReport :one
SELECT * FROM reports WHERE id = $1;

-- Closing a report, or every open report on the same object at once.
-- name: ResolveReports :many
UPDATE reports
SET status = sqlc.arg(status), resolved_by = sqlc.arg(admin_id), resolved_at = now(),
    resolution_note = sqlc.arg(note)
WHERE status = 'open'
  AND (id = sqlc.arg(id)
       OR (sqlc.arg(all_for_object)::boolean AND object_type = sqlc.arg(object_type) AND object_id = sqlc.arg(object_id)))
RETURNING id;
