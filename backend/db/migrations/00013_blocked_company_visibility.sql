-- +goose Up
-- A blocked company's vacancies must disappear from public search (and the suggestions and
-- saved-search alerts built on it) and come back by themselves when the block is lifted.
-- vacancy_is_public() is the single definition of "publicly visible": published AND the
-- company is active. The search index (both triggers and UpsertVacancySearch) uses it; the
-- plain browse listing and the vacancy page check the same two columns in their joins.

-- +goose StatementBegin
CREATE FUNCTION vacancy_is_public(v_status vacancy_status, v_company_id uuid) RETURNS boolean AS $$
    SELECT v_status = 'published'
       AND EXISTS (SELECT 1 FROM companies c WHERE c.id = v_company_id AND c.status = 'active');
$$ LANGUAGE sql STABLE;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION vacancy_search_sync() RETURNS trigger AS $$
BEGIN
    UPDATE vacancy_search
    SET is_published = vacancy_is_public(NEW.status, NEW.company_id),
        published_at = NEW.published_at,
        is_featured  = NEW.is_featured
    WHERE vacancy_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE FUNCTION company_status_sync_search() RETURNS trigger AS $$
BEGIN
    UPDATE vacancy_search s
    SET is_published = vacancy_is_public(v.status, v.company_id)
    FROM vacancies v
    WHERE v.id = s.vacancy_id AND v.company_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER companies_sync_search AFTER UPDATE OF status ON companies
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION company_status_sync_search();

-- Backfill: companies blocked before this migration.
UPDATE vacancy_search s
SET is_published = vacancy_is_public(v.status, v.company_id)
FROM vacancies v
WHERE v.id = s.vacancy_id AND s.is_published;

-- +goose Down
DROP TRIGGER IF EXISTS companies_sync_search ON companies;
DROP FUNCTION IF EXISTS company_status_sync_search();

-- +goose StatementBegin
CREATE OR REPLACE FUNCTION vacancy_search_sync() RETURNS trigger AS $$
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

DROP FUNCTION IF EXISTS vacancy_is_public(vacancy_status, uuid);

UPDATE vacancy_search s
SET is_published = (v.status = 'published')
FROM vacancies v
WHERE v.id = s.vacancy_id;
