-- TZ BE-10: counters stop touching updated_at, and vacancies get room for HOT updates.
--
-- views_count and applications_count are bumped by their own statements (the minute view
-- flush, a new application). They say nothing about the vacancy's content, yet the shared
-- set_updated_at trigger moved updated_at on every one of them: "updated" on the page,
-- sitemap lastmod and cache validators changed whenever someone looked at a vacancy.
-- The trigger now fires only for updates that leave both counters alone, i.e. every
-- content or status change. (A WHEN condition keeps the counter path free of any
-- per-row function call; comparing whole rows as jsonb measured 3x slower on 100k rows.)
--
-- fillfactor 90 leaves free space in newly written pages so counter updates can be HOT
-- (none of the counters is indexed), which avoids index churn and bloat. Existing pages
-- keep their layout until the table is rewritten (pg_repack/VACUUM FULL off-peak); the
-- ALTER itself takes only a SHARE UPDATE EXCLUSIVE lock and rewrites nothing.

-- +goose Up
SET LOCAL lock_timeout = '5s';
DROP TRIGGER IF EXISTS vacancies_set_updated_at ON vacancies;
CREATE TRIGGER vacancies_set_updated_at BEFORE UPDATE ON vacancies
    FOR EACH ROW
    WHEN (OLD.views_count = NEW.views_count AND OLD.applications_count = NEW.applications_count)
    EXECUTE FUNCTION set_updated_at();
ALTER TABLE vacancies SET (fillfactor = 90);

-- +goose Down
SET LOCAL lock_timeout = '5s';
ALTER TABLE vacancies RESET (fillfactor);
DROP TRIGGER IF EXISTS vacancies_set_updated_at ON vacancies;
CREATE TRIGGER vacancies_set_updated_at BEFORE UPDATE ON vacancies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
