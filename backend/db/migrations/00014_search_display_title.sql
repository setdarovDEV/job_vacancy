-- TZ BE-11 / SEC-07.
--
-- 1. vacancy_search.display_title: the vacancy title as written. Title suggestions used to
--    join every sampled match back to vacancies just to show the original spelling; with
--    the title here the suggest query reads vacancy_search alone. Written by
--    UpsertVacancySearch from vacancies.title. The column is added empty (instant) and
--    backfilled in batches of 1000 rows, each in its own transaction, so a large table is
--    never locked or rewritten at once. Adding a column no index or generated column
--    depends on leaves the tsvector alone (PG 13+ recomputes only affected columns).
--
-- 2. vacancy_search_recent_idx: newest-first walk of published rows. A broad prefix
--    ("d", "men") matches most rows; with this index the planner reads the newest rows
--    and stops at the 500-row sample instead of sorting every match (65 ms -> 11 ms on
--    100k vacancies), while selective prefixes keep using the GIN index. It also serves
--    q + sort=newest listings.
--
-- 3. search_hidden_terms: words or phrases an admin removed from the public "popular
--    searches" list (spam, profanity, anything unwanted). Tiny; read every 10 minutes when
--    the list is rebuilt.

-- +goose NO TRANSACTION
-- +goose Up
ALTER TABLE vacancy_search ADD COLUMN IF NOT EXISTS display_title text;

-- +goose StatementBegin
DO $$
DECLARE
    last_id uuid := '00000000-0000-0000-0000-000000000000';
    batch   uuid[];
BEGIN
    LOOP
        SELECT array_agg(vacancy_id ORDER BY vacancy_id) INTO batch
        FROM (SELECT vacancy_id FROM vacancy_search
              WHERE vacancy_id > last_id ORDER BY vacancy_id LIMIT 1000) b;
        EXIT WHEN batch IS NULL;
        UPDATE vacancy_search s SET display_title = v.title
        FROM vacancies v
        WHERE v.id = s.vacancy_id AND s.vacancy_id = ANY(batch) AND s.display_title IS NULL;
        last_id := batch[array_length(batch, 1)];
        COMMIT;
    END LOOP;
END $$;
-- +goose StatementEnd

CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancy_search_recent_idx
    ON vacancy_search (published_at DESC, vacancy_id DESC) WHERE is_published;

CREATE TABLE IF NOT EXISTS search_hidden_terms (
    term       text PRIMARY KEY CHECK (length(term) BETWEEN 1 AND 100),
    hidden_by  uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS search_hidden_terms;
DROP INDEX CONCURRENTLY IF EXISTS vacancy_search_recent_idx;
ALTER TABLE vacancy_search DROP COLUMN IF EXISTS display_title;
