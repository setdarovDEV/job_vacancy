-- name: CreateVacancy :one
INSERT INTO vacancies (company_id, created_by, title, slug, description, category_id, region_id,
                       district_id, address, salary_min, salary_max, currency, employment_type,
                       work_format, experience, schedule)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
RETURNING *;

-- name: UpdateVacancy :one
UPDATE vacancies
SET title = $2, description = $3, category_id = $4, region_id = $5, district_id = $6,
    address = $7, salary_min = $8, salary_max = $9, currency = $10, employment_type = $11,
    work_format = $12, experience = $13, schedule = $14
WHERE id = $1
RETURNING *;

-- name: GetVacancyByID :one
SELECT * FROM vacancies WHERE id = $1;

-- name: GetVacancyBySlug :one
SELECT * FROM vacancies WHERE slug = $1;

-- name: DeleteVacancySkills :exec
DELETE FROM vacancy_skills WHERE vacancy_id = $1;

-- name: AddVacancySkills :exec
INSERT INTO vacancy_skills (vacancy_id, skill_id)
SELECT $1, unnest(sqlc.arg(skill_ids)::int[])
ON CONFLICT DO NOTHING;

-- name: ListVacancySkills :many
SELECT vs.vacancy_id, s.id, s.name
FROM vacancy_skills vs JOIN skills s ON s.id = vs.skill_id
WHERE vs.vacancy_id = ANY(sqlc.arg(vacancy_ids)::uuid[])
ORDER BY s.name;

-- State transitions are guarded by the allowed source statuses, so concurrent requests
-- can't move a vacancy through an invalid path. No row returned = transition not allowed.

-- name: SubmitVacancy :one
UPDATE vacancies
SET status = 'moderation', submitted_at = now(), reject_reason = NULL
WHERE id = $1 AND status::text = ANY(sqlc.arg(from_statuses)::text[])
RETURNING *;

-- name: PublishVacancy :one
UPDATE vacancies
SET status = 'published',
    submitted_at = COALESCE(submitted_at, now()),
    published_at = now(),
    expires_at = now() + make_interval(days => sqlc.arg(ttl_days)::int),
    reject_reason = NULL,
    moderated_by = sqlc.narg(moderated_by),
    moderated_at = CASE WHEN sqlc.narg(moderated_by)::uuid IS NULL THEN moderated_at ELSE now() END
WHERE id = $1 AND status::text = ANY(sqlc.arg(from_statuses)::text[])
RETURNING *;

-- name: RejectVacancy :one
UPDATE vacancies
SET status = 'rejected', reject_reason = $2, moderated_by = $3, moderated_at = now()
WHERE id = $1 AND status = 'moderation'
RETURNING *;

-- name: ArchiveVacancy :one
UPDATE vacancies SET status = 'archived'
WHERE id = $1 AND status IN ('published', 'moderation', 'expired', 'rejected')
RETURNING *;

-- name: DeleteDraftVacancy :execrows
DELETE FROM vacancies WHERE id = $1 AND status = 'draft';

-- Returns what the response caches need to drop (TZ BE-05). Only vacancy rows are locked.
-- name: ExpireVacancies :many
UPDATE vacancies v SET status = 'expired'
FROM companies c
WHERE c.id = v.company_id AND v.status = 'published' AND v.expires_at < now()
RETURNING v.id, v.slug, v.company_id, c.slug AS company_slug;

-- A company's live vacancies, whose cached pages show the company (name, logo, badge).
-- Served by vacancies_company_pub_idx.
-- name: ListPublishedVacancyRefs :many
SELECT id, slug FROM vacancies
WHERE company_id = $1 AND status = 'published'
ORDER BY published_at DESC, id DESC
LIMIT 1000;

-- name: AddVacancyViews :exec
UPDATE vacancies v SET views_count = v.views_count + d.n
FROM (SELECT unnest(sqlc.arg(ids)::uuid[]) AS id, unnest(sqlc.arg(counts)::int[]) AS n) d
WHERE v.id = d.id;

-- name: ListCompanyVacancies :many
SELECT * FROM vacancies
WHERE company_id = sqlc.arg(company_id)
  AND (sqlc.narg(status)::vacancy_status IS NULL OR status = sqlc.narg(status))
  AND (sqlc.narg(before_created)::timestamptz IS NULL
       OR (created_at, id) < (sqlc.narg(before_created), sqlc.narg(before_id)::uuid))
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(max_results);

-- name: ListModerationQueue :many
SELECT sqlc.embed(v), c.name AS company_name, c.slug AS company_slug, c.verified_at AS company_verified_at
FROM vacancies v JOIN companies c ON c.id = v.company_id
WHERE v.status = 'moderation'
  AND (sqlc.narg(after_submitted)::timestamptz IS NULL
       OR (v.submitted_at, v.id) > (sqlc.narg(after_submitted), sqlc.narg(after_id)::uuid))
ORDER BY v.submitted_at, v.id
LIMIT sqlc.arg(max_results);
