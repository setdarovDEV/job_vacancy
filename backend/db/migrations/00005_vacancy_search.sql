-- +goose Up

-- The search index table. One row per vacancy holding
--   * the folded search text and its weighted tsvector, and
--   * copies of every column a search can filter or rank on,
-- so a text search is answered from this table alone: it picks the top N ids here and
-- only then joins vacancies/companies for those N rows. Joining the full match set
-- (10k+ rows for "dasturchi") against vacancies was the dominant cost.
--
-- Text is folded to one Latin form in Go (internal/pkg/translit) before it is stored, so
-- Latin, Cyrillic and Russian queries hit the same index. The 'simple' configuration only
-- lowercases and splits; stemming happens on the query side (internal/pkg/searchq).
--   A: title   B: skills + company name   C: category and region names (all languages)   D: description
--
-- Sync: rows are rewritten in the same transaction as every vacancy create/update; the
-- columns that change on their own (status, published_at, is_featured) are copied by trigger.
CREATE TABLE vacancy_search (
    vacancy_id      uuid PRIMARY KEY REFERENCES vacancies (id) ON DELETE CASCADE,
    is_published    boolean          NOT NULL DEFAULT false,
    published_at    timestamptz,
    is_featured     boolean          NOT NULL DEFAULT false,
    company_id      uuid             NOT NULL,
    category_id     integer          NOT NULL,
    region_id       integer          NOT NULL,
    district_id     integer,
    employment_type employment_type  NOT NULL,
    work_format     work_format      NOT NULL,
    experience      experience_level NOT NULL,
    schedule        work_schedule    NOT NULL,
    salary_min      bigint,
    salary_max      bigint,
    currency        currency         NOT NULL,
    title           text             NOT NULL,
    tags            text             NOT NULL,
    company         text             NOT NULL,
    meta            text             NOT NULL,
    body            text             NOT NULL,
    document        tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', title), 'A') ||
        setweight(to_tsvector('simple', tags || ' ' || company), 'B') ||
        setweight(to_tsvector('simple', meta), 'C') ||
        setweight(to_tsvector('simple', left(body, 20000)), 'D')
    ) STORED
);

CREATE INDEX vacancy_search_document_idx ON vacancy_search USING gin (document) WHERE is_published;
-- Typo-tolerant title matching (word_similarity, the <% operator).
CREATE INDEX vacancy_search_title_trgm_idx ON vacancy_search USING gin (title gin_trgm_ops) WHERE is_published;

-- Renaming a company rewrites the company text of its vacancies.
CREATE INDEX vacancy_search_company_idx ON vacancy_search (company_id);

-- +goose StatementBegin
CREATE FUNCTION vacancy_search_sync() RETURNS trigger AS $$
BEGIN
    UPDATE vacancy_search
    SET is_published = (NEW.status = 'published'),
        published_at = NEW.published_at,
        is_featured  = NEW.is_featured
    WHERE vacancy_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER vacancies_sync_search AFTER UPDATE OF status, published_at, is_featured ON vacancies
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status
          OR OLD.published_at IS DISTINCT FROM NEW.published_at
          OR OLD.is_featured IS DISTINCT FROM NEW.is_featured)
    EXECUTE FUNCTION vacancy_search_sync();

-- +goose Down
DROP TRIGGER IF EXISTS vacancies_sync_search ON vacancies;
DROP FUNCTION IF EXISTS vacancy_search_sync();
DROP TABLE IF EXISTS vacancy_search;
