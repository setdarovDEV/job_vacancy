-- TZ BE-03: companies.open_vacancies and a keyset index for the company directory.
--
-- The directory sorted by a correlated COUNT(*) per company and paged with OFFSET, so every
-- page counted the vacancies of every company before it. The count now lives on the company
-- row and the directory seeks through companies_directory_idx.
--
-- The counter is kept by triggers on vacancies rather than in the services: a vacancy
-- changes status in many places (submit/publish, moderation, archive, the expiry job, draft
-- delete, company delete, admin blocking later). Triggers cover all of them in the same
-- transaction as the status change, also during a rolling deploy while older API instances
-- still run. WHEN conditions keep view flushes and application counters away from the
-- function entirely.
--
-- Locks (live-safe): each step is its own short transaction.
--   1. ADD COLUMN with a constant default is metadata-only; its ACCESS EXCLUSIVE lock is
--      released at once instead of being held through the backfill.
--   2. Triggers + backfill run in one transaction. CREATE TRIGGER takes SHARE ROW
--      EXCLUSIVE on vacancies (writes wait, reads don't) until the backfill commits, so no
--      status change can slip between the count and the trigger taking over. The grouped
--      count reads vacancies_company_pub_idx: ~0.1 s at 100k vacancies.
--   3. The directory index is built CONCURRENTLY.
--
-- Index order: the TZ asks for ((verified_at IS NOT NULL) DESC, open_vacancies DESC, name,
-- id). This index stores exactly that order, written with ascending keys only:
-- (verified_at IS NULL) ASC == (verified_at IS NOT NULL) DESC and -open_vacancies ASC ==
-- open_vacancies DESC. With one direction the next page is a single row comparison
-- (unverified, -open, name, id) > (cursor), i.e. one index range scan; a mixed ASC/DESC
-- index can't serve a row-value comparison as a range, so a seek would walk and filter.
--
-- companies.updated_at: the counter says nothing about the profile, so the updated_at
-- trigger skips updates that only move open_vacancies (same idea as 00013).

-- +goose NO TRANSACTION
-- +goose Up
-- goose runs a NO TRANSACTION migration on one connection, so the session setting holds
-- for the ALTER and is reset before the concurrent index build (which must not time out
-- while it waits for older transactions).
SET lock_timeout = '5s';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS open_vacancies integer NOT NULL DEFAULT 0;
RESET lock_timeout;

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION companies_count_open_vacancies() RETURNS trigger AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.status = 'published' THEN
        UPDATE companies SET open_vacancies = GREATEST(open_vacancies - 1, 0) WHERE id = OLD.company_id;
    END IF;
    IF TG_OP IN ('UPDATE', 'INSERT') AND NEW.status = 'published' THEN
        UPDATE companies SET open_vacancies = open_vacancies + 1 WHERE id = NEW.company_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

-- +goose StatementBegin
DO $$
BEGIN
    PERFORM set_config('lock_timeout', '5s', true);

    DROP TRIGGER IF EXISTS vacancies_open_count_upd ON vacancies;
    CREATE TRIGGER vacancies_open_count_upd AFTER UPDATE OF status, company_id ON vacancies
        FOR EACH ROW
        WHEN ((OLD.status = 'published') IS DISTINCT FROM (NEW.status = 'published')
              OR (NEW.status = 'published' AND OLD.company_id IS DISTINCT FROM NEW.company_id))
        EXECUTE FUNCTION companies_count_open_vacancies();
    DROP TRIGGER IF EXISTS vacancies_open_count_ins ON vacancies;
    CREATE TRIGGER vacancies_open_count_ins AFTER INSERT ON vacancies
        FOR EACH ROW WHEN (NEW.status = 'published')
        EXECUTE FUNCTION companies_count_open_vacancies();
    DROP TRIGGER IF EXISTS vacancies_open_count_del ON vacancies;
    CREATE TRIGGER vacancies_open_count_del AFTER DELETE ON vacancies
        FOR EACH ROW WHEN (OLD.status = 'published')
        EXECUTE FUNCTION companies_count_open_vacancies();

    DROP TRIGGER IF EXISTS companies_set_updated_at ON companies;
    CREATE TRIGGER companies_set_updated_at BEFORE UPDATE ON companies
        FOR EACH ROW WHEN (OLD.open_vacancies = NEW.open_vacancies)
        EXECUTE FUNCTION set_updated_at();

    -- Exact recount (also fixes any drift if this migration is re-run after a down).
    UPDATE companies c SET open_vacancies = COALESCE(n.cnt, 0)
    FROM companies c2
    LEFT JOIN (SELECT company_id, count(*)::int AS cnt FROM vacancies
               WHERE status = 'published' GROUP BY company_id) n ON n.company_id = c2.id
    WHERE c.id = c2.id AND c.open_vacancies IS DISTINCT FROM COALESCE(n.cnt, 0);
END $$;
-- +goose StatementEnd

CREATE INDEX CONCURRENTLY IF NOT EXISTS companies_directory_idx
    ON companies ((verified_at IS NULL), (-open_vacancies), name, id) WHERE status = 'active';

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS companies_directory_idx;

-- +goose StatementBegin
DO $$
BEGIN
    PERFORM set_config('lock_timeout', '5s', true);
    DROP TRIGGER IF EXISTS vacancies_open_count_upd ON vacancies;
    DROP TRIGGER IF EXISTS vacancies_open_count_ins ON vacancies;
    DROP TRIGGER IF EXISTS vacancies_open_count_del ON vacancies;
    DROP TRIGGER IF EXISTS companies_set_updated_at ON companies;
    CREATE TRIGGER companies_set_updated_at BEFORE UPDATE ON companies
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    ALTER TABLE companies DROP COLUMN IF EXISTS open_vacancies;
END $$;
-- +goose StatementEnd

DROP FUNCTION IF EXISTS companies_count_open_vacancies();
