-- Anonymize a copy of the production database for staging (TZ OPS-08).
-- Run ONLY against the staging copy (scripts/staging-refresh.sh does this):
--   PGOPTIONS="-c jv.target=staging" psql -v ON_ERROR_STOP=1 -f anonymize.sql <staging db>
--
-- Keeps what makes staging realistic (companies, vacancies, catalog, volumes, statuses,
-- relations) and replaces what identifies a person: names, e-mails, phones, Google/Telegram
-- links, sessions, device tokens, free-text written by people (cover letters, notes, chat
-- messages, resume "about"), file names and location coordinates. Pending background jobs
-- are dropped so staging never e-mails or messages real people.
--
-- Every account's password becomes "Secret123" (the demo password from README). Staff can
-- still sign in with their original role; e-mails become user-<id prefix>@staging.invalid,
-- except @demo.uz accounts, which keep their address.
--
-- New tables with personal data MUST be added here (see docs/RUNBOOK.md "Staging").
\set ON_ERROR_STOP on
BEGIN;

-- Guard: refuses unless the session says it is the staging copy:
--   PGOPTIONS="-c jv.target=staging" psql ... -f anonymize.sql
DO $$
BEGIN
  IF coalesce(current_setting('jv.target', true), '') <> 'staging' THEN
    RAISE EXCEPTION 'anonymize.sql: refusing, this session is not marked as staging (PGOPTIONS="-c jv.target=staging")';
  END IF;
END $$;

-- ---- people ----------------------------------------------------------------------------
UPDATE users SET
  email = CASE WHEN email::text ILIKE '%@demo.uz' THEN email
               ELSE ('user-' || left(replace(id::text, '-', ''), 12) || '@staging.invalid')::citext END,
  phone = NULL,
  phone_verified_at = NULL,
  google_sub = NULL,
  telegram_chat_id = NULL,
  notify_telegram = false,
  avatar_url = NULL,
  full_name = CASE WHEN email::text ILIKE '%@demo.uz' THEN full_name
                   ELSE 'Test User ' || left(replace(id::text, '-', ''), 6) END,
  -- argon2id("Secret123")
  password_hash = '$argon2id$v=19$m=19456,t=2,p=1$qxMhUTGpdLellPZH0EXh4w$p4qanS1FBuj8cJ3sbEfl68GjBTBHOmhA4QfakrZpk4U';

DELETE FROM user_sessions;
DELETE FROM device_tokens;

-- ---- resumes -----------------------------------------------------------------------------
UPDATE resumes SET about = CASE WHEN about = '' THEN about
  ELSE 'Anonymized profile summary for staging.' END;
UPDATE resume_experiences SET
  company = 'Company ' || left(replace(id::text, '-', ''), 6),
  description = CASE WHEN description = '' THEN description
                     ELSE 'Anonymized work description.' END;
UPDATE resume_educations SET institution = 'University ' || left(replace(id::text, '-', ''), 6);
-- Search index copy of the texts above (the tsvector "document" is generated from these).
UPDATE resume_search rs SET body = coalesce(r.about, ''), meta = ''
FROM resumes r WHERE r.id = rs.resume_id;

-- ---- applications and chat --------------------------------------------------------------
UPDATE applications SET
  cover_letter = CASE WHEN cover_letter = '' THEN cover_letter
                      ELSE 'Anonymized cover letter.' END,
  employer_note = '';
UPDATE application_events SET note = '' WHERE note <> '';
UPDATE messages SET
  body = CASE WHEN kind = 'text' AND deleted_at IS NULL THEN 'Anonymized message #' || id ELSE '' END,
  meta = '{}'::jsonb;              -- location coordinates, image dimensions, voice durations
UPDATE files SET name = 'file-' || left(replace(id::text, '-', ''), 8), meta = '{}'::jsonb;
DELETE FROM notifications;         -- payloads carry names and message previews

-- ---- companies: public business data stays, direct contacts go --------------------------
UPDATE companies SET
  email = CASE WHEN email IS NULL THEN NULL
               ELSE ('company-' || left(replace(id::text, '-', ''), 12) || '@staging.invalid')::citext END,
  phone = NULL;

-- ---- background jobs: nothing queued in production may run on staging -------------------
DELETE FROM river_job;

-- ---- tables added by later migrations (skipped while they don't exist) -------------------
DO $$
BEGIN
  IF to_regclass('public.company_invites') IS NOT NULL THEN EXECUTE 'DELETE FROM company_invites'; END IF;
  IF to_regclass('public.reports') IS NOT NULL THEN
    EXECUTE 'UPDATE reports SET comment = NULL';
  END IF;
  IF to_regclass('public.admin_audit_log') IS NOT NULL THEN
    EXECUTE 'UPDATE admin_audit_log SET ip = NULL' ;
  END IF;
  IF to_regclass('public.user_consents') IS NOT NULL THEN
    EXECUTE 'UPDATE user_consents SET ip = NULL, user_agent = NULL';
  END IF;
EXCEPTION WHEN undefined_column THEN
  RAISE NOTICE 'anonymize.sql: a later table changed shape, review this block: %', SQLERRM;
END $$;

COMMIT;

SELECT 'anonymized: ' || (SELECT count(*) FROM users) || ' users, '
  || (SELECT count(*) FROM messages) || ' messages, '
  || (SELECT count(*) FROM applications) || ' applications' AS result;
