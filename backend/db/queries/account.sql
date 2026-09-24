-- Account deletion (TZ FN-03). All of it runs in one transaction.

-- Companies the user owns, with how many other members each has. Locked so nobody joins
-- while the account is being deleted. Served by companies_owner_idx.
-- name: ListOwnedCompanies :many
SELECT c.id, c.name, c.slug,
       (SELECT count(*) FROM company_members m WHERE m.company_id = c.id AND m.user_id <> c.owner_id)::bigint AS other_members
FROM companies c
WHERE c.owner_id = $1 AND c.status <> 'deleted'
ORDER BY c.id
FOR UPDATE OF c;

-- name: CloseCompany :exec
UPDATE companies SET status = 'deleted' WHERE id = $1;

-- Resumes nobody applied with are deleted (sections and search rows cascade).
-- name: DeleteUnusedResumes :execrows
DELETE FROM resumes r
WHERE r.user_id = sqlc.arg(user_id)::uuid AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.resume_id = r.id);

-- Resumes an employer still sees through an application keep their row but lose all
-- content; they leave candidate search.
-- name: WipeUserResumes :execrows
WITH r AS (SELECT id FROM resumes WHERE resumes.user_id = sqlc.arg(user_id)::uuid),
     e AS (DELETE FROM resume_experiences WHERE resume_id IN (SELECT id FROM r)),
     ed AS (DELETE FROM resume_educations WHERE resume_id IN (SELECT id FROM r)),
     sk AS (DELETE FROM resume_skills WHERE resume_id IN (SELECT id FROM r)),
     l AS (DELETE FROM resume_languages WHERE resume_id IN (SELECT id FROM r)),
     s AS (DELETE FROM resume_search WHERE resume_id IN (SELECT id FROM r))
UPDATE resumes
SET title = '', about = '', category_id = NULL, region_id = NULL, relocate = false,
    desired_salary = NULL, employment_types = '{}', work_formats = '{}',
    visibility = 'hidden', experience_months = 0
WHERE id IN (SELECT id FROM r);

-- The user's uploads (avatar, chat attachments); company logos belong to the company and
-- stay. Chat messages keep their text, their file_id becomes NULL. The objects are
-- removed from storage by a job enqueued in the same transaction.
-- name: DeleteUserFiles :many
DELETE FROM files WHERE owner_id = $1 AND purpose <> 'company_logo'
RETURNING bucket, object_key;

-- name: PurgeUserData :exec
WITH n AS (DELETE FROM notifications WHERE notifications.user_id = sqlc.arg(user_id)::uuid),
     d AS (DELETE FROM device_tokens WHERE device_tokens.user_id = sqlc.arg(user_id)::uuid),
     ss AS (DELETE FROM saved_searches WHERE saved_searches.user_id = sqlc.arg(user_id)::uuid),
     sv AS (DELETE FROM saved_vacancies WHERE saved_vacancies.user_id = sqlc.arg(user_id)::uuid),
     m AS (DELETE FROM company_members WHERE company_members.user_id = sqlc.arg(user_id)::uuid),
     i AS (DELETE FROM company_invites WHERE email = sqlc.narg(email)::citext AND status = 'pending')
SELECT 1;

-- The row stays (applications, messages and history point at it) with nothing personal
-- left. The e-mail becomes a unique placeholder, so the address is free to register again.
-- name: AnonymizeUser :execrows
UPDATE users
SET email = 'deleted-' || id::text || '@deleted.invalid', email_verified_at = NULL,
    phone = NULL, phone_verified_at = NULL, password_hash = NULL, google_sub = NULL,
    full_name = '', avatar_url = NULL, telegram_chat_id = NULL,
    notify_email = false, notify_telegram = false, hide_online = true, last_seen_at = NULL,
    status = 'deleted', deleted_at = now()
WHERE id = $1 AND status <> 'deleted';
