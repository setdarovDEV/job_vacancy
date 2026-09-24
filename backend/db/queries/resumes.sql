-- name: CreateResume :one
INSERT INTO resumes (user_id, title, about, category_id, region_id, relocate, desired_salary,
                     currency, employment_types, work_formats, visibility, experience_months)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;

-- name: UpdateResume :one
UPDATE resumes
SET title = $2, about = $3, category_id = $4, region_id = $5, relocate = $6, desired_salary = $7,
    currency = $8, employment_types = $9, work_formats = $10, visibility = $11, experience_months = $12
WHERE id = $1
RETURNING *;

-- name: SetResumeVisibility :one
UPDATE resumes SET visibility = $2 WHERE id = $1 RETURNING *;

-- name: GetResume :one
SELECT * FROM resumes WHERE id = $1;

-- name: ListUserResumes :many
SELECT * FROM resumes WHERE user_id = $1 ORDER BY updated_at DESC;

-- name: CountUserResumes :one
SELECT count(*) FROM resumes WHERE user_id = $1;

-- name: DeleteResume :execrows
DELETE FROM resumes WHERE id = $1 AND user_id = $2;

-- name: ResumeHasApplications :one
SELECT EXISTS (SELECT 1 FROM applications WHERE resume_id = $1);

-- name: ListResumeExperiences :many
SELECT * FROM resume_experiences WHERE resume_id = ANY(sqlc.arg(resume_ids)::uuid[])
ORDER BY resume_id, sort_order;

-- name: ListResumeEducations :many
SELECT * FROM resume_educations WHERE resume_id = ANY(sqlc.arg(resume_ids)::uuid[])
ORDER BY resume_id, sort_order;

-- name: ListResumeSkills :many
SELECT rs.resume_id, s.id, s.name
FROM resume_skills rs JOIN skills s ON s.id = rs.skill_id
WHERE rs.resume_id = ANY(sqlc.arg(resume_ids)::uuid[])
ORDER BY s.name;

-- name: ListResumeLanguages :many
SELECT * FROM resume_languages WHERE resume_id = ANY(sqlc.arg(resume_ids)::uuid[])
ORDER BY resume_id, language;

-- name: UpsertResumeSearch :exec
INSERT INTO resume_search (resume_id, is_public, updated_at, category_id, region_id, relocate,
                           experience_months, desired_salary, currency, employment_types,
                           work_formats, languages, title, tags, meta, body)
SELECT r.id, r.visibility = 'public', r.updated_at, r.category_id, r.region_id, r.relocate,
       r.experience_months, r.desired_salary, r.currency, r.employment_types,
       r.work_formats, sqlc.arg(languages)::text[], sqlc.arg(title), sqlc.arg(tags),
       sqlc.arg(meta), sqlc.arg(body)
FROM resumes r WHERE r.id = sqlc.arg(id)
ON CONFLICT (resume_id) DO UPDATE
SET is_public = EXCLUDED.is_public, updated_at = EXCLUDED.updated_at,
    category_id = EXCLUDED.category_id, region_id = EXCLUDED.region_id,
    relocate = EXCLUDED.relocate, experience_months = EXCLUDED.experience_months,
    desired_salary = EXCLUDED.desired_salary, currency = EXCLUDED.currency,
    employment_types = EXCLUDED.employment_types, work_formats = EXCLUDED.work_formats,
    languages = EXCLUDED.languages, title = EXCLUDED.title, tags = EXCLUDED.tags,
    meta = EXCLUDED.meta, body = EXCLUDED.body;

-- name: SetResumeSearchVisibility :exec
UPDATE resume_search SET is_public = $2 WHERE resume_id = $1;

-- name: ListResumesByIDs :many
SELECT sqlc.embed(r), u.full_name, u.avatar_url
FROM resumes r JOIN users u ON u.id = r.user_id
WHERE r.id = ANY(sqlc.arg(ids)::uuid[]) AND u.status = 'active';
