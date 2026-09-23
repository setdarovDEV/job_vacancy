-- name: CreateApplication :one
INSERT INTO applications (vacancy_id, company_id, seeker_id, resume_id, source, status, cover_letter)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: IncrementVacancyApplications :exec
UPDATE vacancies SET applications_count = applications_count + 1 WHERE id = $1;

-- name: AddApplicationEvent :exec
INSERT INTO application_events (application_id, actor_id, from_status, to_status, note)
VALUES ($1, $2, $3, $4, $5);

-- name: GetApplication :one
SELECT * FROM applications WHERE id = $1;

-- Guarded by the allowed source statuses; no row = transition not allowed right now.
-- name: SetApplicationStatus :one
UPDATE applications
SET status = sqlc.arg(status), status_changed_at = now(),
    viewed_at = COALESCE(viewed_at, now())
WHERE id = sqlc.arg(id) AND status::text = ANY(sqlc.arg(from_statuses)::text[])
RETURNING *;

-- name: SetApplicationNote :one
UPDATE applications SET employer_note = $2 WHERE id = $1 RETURNING *;

-- name: ListSeekerApplications :many
SELECT * FROM applications
WHERE seeker_id = sqlc.arg(seeker_id)
  AND (sqlc.narg(status)::application_status IS NULL OR status = sqlc.narg(status))
  AND (sqlc.narg(before_created)::timestamptz IS NULL
       OR (created_at, id) < (sqlc.narg(before_created), sqlc.narg(before_id)::uuid))
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(max_results);

-- name: ListVacancyApplications :many
SELECT sqlc.embed(a), u.full_name, u.avatar_url, r.title AS resume_title,
       r.experience_months, r.desired_salary, r.currency, r.region_id
FROM applications a
JOIN users u ON u.id = a.seeker_id
JOIN resumes r ON r.id = a.resume_id
WHERE a.vacancy_id = sqlc.arg(vacancy_id)
  AND (sqlc.narg(status)::application_status IS NULL OR a.status = sqlc.narg(status))
  AND (sqlc.narg(before_created)::timestamptz IS NULL
       OR (a.created_at, a.id) < (sqlc.narg(before_created), sqlc.narg(before_id)::uuid))
ORDER BY a.created_at DESC, a.id DESC
LIMIT sqlc.arg(max_results);

-- name: CountVacancyApplicationsByStatus :many
SELECT status, count(*) AS n FROM applications WHERE vacancy_id = $1 GROUP BY status;

-- name: ListApplicationEvents :many
SELECT * FROM application_events WHERE application_id = $1 ORDER BY id;

-- Did this seeker apply (or get invited) to any company the viewer belongs to?
-- Grants employers access to applied_only resumes and to contact details.
-- name: SeekerLinkedToMemberCompanies :one
SELECT EXISTS (
    SELECT 1 FROM applications a
    JOIN company_members m ON m.company_id = a.company_id
    WHERE a.seeker_id = sqlc.arg(seeker_id) AND m.user_id = sqlc.arg(member_id)
);

-- Was this exact resume sent to (or requested by) a company the viewer belongs to?
-- name: ResumeSharedWithMember :one
SELECT EXISTS (
    SELECT 1 FROM applications a
    JOIN company_members m ON m.company_id = a.company_id
    WHERE a.resume_id = sqlc.arg(resume_id) AND m.user_id = sqlc.arg(member_id)
);
