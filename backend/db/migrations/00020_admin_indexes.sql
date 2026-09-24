-- Indexes for the MVP features of 00019, built without blocking writes.
--
--   users_admin_search_idx         admin user search: substring of name, e-mail or phone
--                                  (trigram GIN, serves LIKE '%…%' for 3+ characters)
--   *_created_brin                 admin daily statistics: registrations, vacancies and
--                                  applications per day over a date range (BRIN: a few
--                                  pages, nearly free to maintain on append-mostly tables)
--   vacancies_created_by_live_idx  blocking a user unpublishes the vacancies they created;
--                                  only live rows are indexed
--   vacancies_featured_idx         the periodic job that ends expired "TOP" marks
--   companies_owner_idx            account deletion finds the companies a user owns
--
-- If a CONCURRENTLY build fails it leaves an INVALID index that IF NOT EXISTS would skip:
-- drop it and run the migration again.

-- +goose NO TRANSACTION
-- +goose Up
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_admin_search_idx ON users
    USING gin ((lower(full_name) || ' ' || coalesce(lower(email::text), '') || ' ' || coalesce(phone, '')) gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS users_created_brin ON users USING brin (created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancies_created_brin ON vacancies USING brin (created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS applications_created_brin ON applications USING brin (created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancies_created_by_live_idx ON vacancies (created_by)
    WHERE status IN ('published', 'moderation');
CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancies_featured_idx ON vacancies (featured_until) WHERE is_featured;
CREATE INDEX CONCURRENTLY IF NOT EXISTS companies_owner_idx ON companies (owner_id);

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS companies_owner_idx;
DROP INDEX CONCURRENTLY IF EXISTS vacancies_featured_idx;
DROP INDEX CONCURRENTLY IF EXISTS vacancies_created_by_live_idx;
DROP INDEX CONCURRENTLY IF EXISTS applications_created_brin;
DROP INDEX CONCURRENTLY IF EXISTS vacancies_created_brin;
DROP INDEX CONCURRENTLY IF EXISTS users_created_brin;
DROP INDEX CONCURRENTLY IF EXISTS users_admin_search_idx;
