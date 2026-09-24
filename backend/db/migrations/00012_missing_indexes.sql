-- +goose NO TRANSACTION
-- TZ BE-02: indexes the 2026-09-24 audit found missing. Built CONCURRENTLY so a live
-- database keeps accepting writes; this migration therefore runs outside a transaction.
--
-- If a CONCURRENTLY build fails it leaves an INVALID index behind and IF NOT EXISTS would
-- skip it on the next run: drop it (DROP INDEX CONCURRENTLY <name>) and re-run migrate.
--
-- What each one serves:
--   applications_resume_idx       FK applications.resume_id (resume delete, "applied with")
--   applications_vacancy_new_idx  employer list of a vacancy's applications, newest first,
--                                 without a status filter (the kanban "all" view)
--   messages_file_idx             FK messages.file_id (file cleanup, ON DELETE)
--   saved_vacancies_vacancy_idx   FK saved_vacancies.vacancy_id (vacancy delete cascades)
--   conversation_reads_user_idx   FK conversation_reads.user_id (user delete, unread counts)
--   conversations_vacancy_idx     FK conversations.vacancy_id (vacancy delete)
--   application_events_actor_idx  FK application_events.actor_id (user delete)
--   vacancies_company_pub_idx     company page: published vacancies of one company
--   vacancies_district_pub_idx    district filter on the public listing
--   user_sessions_expires_idx     periodic cleanup of expired sessions

-- +goose Up
CREATE INDEX CONCURRENTLY IF NOT EXISTS applications_resume_idx      ON applications (resume_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS applications_vacancy_new_idx ON applications (vacancy_id, created_at DESC, id DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_file_idx            ON messages (file_id) WHERE file_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS saved_vacancies_vacancy_idx  ON saved_vacancies (vacancy_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_reads_user_idx  ON conversation_reads (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS conversations_vacancy_idx    ON conversations (vacancy_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS application_events_actor_idx ON application_events (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancies_company_pub_idx    ON vacancies (company_id, published_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancies_district_pub_idx   ON vacancies (district_id, published_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX CONCURRENTLY IF NOT EXISTS user_sessions_expires_idx    ON user_sessions (expires_at);

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS applications_resume_idx;
DROP INDEX CONCURRENTLY IF EXISTS applications_vacancy_new_idx;
DROP INDEX CONCURRENTLY IF EXISTS messages_file_idx;
DROP INDEX CONCURRENTLY IF EXISTS saved_vacancies_vacancy_idx;
DROP INDEX CONCURRENTLY IF EXISTS conversation_reads_user_idx;
DROP INDEX CONCURRENTLY IF EXISTS conversations_vacancy_idx;
DROP INDEX CONCURRENTLY IF EXISTS application_events_actor_idx;
DROP INDEX CONCURRENTLY IF EXISTS vacancies_company_pub_idx;
DROP INDEX CONCURRENTLY IF EXISTS vacancies_district_pub_idx;
DROP INDEX CONCURRENTLY IF EXISTS user_sessions_expires_idx;
