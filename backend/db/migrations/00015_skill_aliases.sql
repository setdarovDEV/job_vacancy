-- +goose Up
-- Names a skill used to have. When an admin merges "React.js" into "React" or renames a
-- skill, the old slug keeps pointing at the surviving skill, so people who type the old
-- name again get the right skill instead of recreating the duplicate.
CREATE TABLE skill_aliases (
    slug       text        PRIMARY KEY,
    skill_id   integer     NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX skill_aliases_skill_idx ON skill_aliases (skill_id);

-- A slug lives either in skills.slug or in skill_aliases, never both: otherwise one typed
-- name would resolve to two skills. Both tables refuse a slug the other one holds
-- (unique_violation, like the primary keys), so the rule holds whatever writes them.
-- +goose StatementBegin
CREATE FUNCTION skill_slug_exclusive() RETURNS trigger AS $$
BEGIN
    -- Writers of the same slug queue up here, so the check below sees a concurrent
    -- writer's committed row instead of both passing it (READ COMMITTED).
    PERFORM pg_advisory_xact_lock(hashtextextended('skill_slug:' || NEW.slug, 0));
    IF TG_TABLE_NAME = 'skills' THEN
        IF EXISTS (SELECT 1 FROM skill_aliases WHERE slug = NEW.slug) THEN
            RAISE EXCEPTION 'skill slug % is an alias of another skill', NEW.slug USING ERRCODE = 'unique_violation';
        END IF;
    ELSIF EXISTS (SELECT 1 FROM skills WHERE slug = NEW.slug) THEN
        RAISE EXCEPTION 'alias % is already a skill''s own slug', NEW.slug USING ERRCODE = 'unique_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- +goose StatementEnd

CREATE TRIGGER skills_slug_exclusive BEFORE INSERT OR UPDATE OF slug ON skills
    FOR EACH ROW EXECUTE FUNCTION skill_slug_exclusive();
CREATE TRIGGER skill_aliases_slug_exclusive BEFORE INSERT OR UPDATE OF slug ON skill_aliases
    FOR EACH ROW EXECUTE FUNCTION skill_slug_exclusive();

-- The admin skill directory: each skill with where it is used and the names merged into
-- it. One definition for the list orderings and the mutation responses.
--   popularity: skills.usage_count, bumped when a vacancy using the skill is published
--               (what autocomplete ranks by; it never goes down)
--   in_use:     vacancies + resumes that list the skill right now
CREATE VIEW skill_directory AS
SELECT s.id, s.name, s.slug, s.is_verified, s.usage_count AS popularity, s.created_at,
       v.n AS vacancy_count, r.n AS resume_count, (v.n + r.n)::int AS in_use,
       a.slugs AS aliases
FROM skills s
CROSS JOIN LATERAL (SELECT count(*)::int AS n FROM vacancy_skills WHERE skill_id = s.id) v
CROSS JOIN LATERAL (SELECT count(*)::int AS n FROM resume_skills WHERE skill_id = s.id) r
CROSS JOIN LATERAL (SELECT COALESCE(array_agg(slug ORDER BY slug), '{}')::text[] AS slugs
                    FROM skill_aliases WHERE skill_id = s.id) a;

CREATE INDEX skills_newest_idx ON skills (created_at DESC, id DESC);
CREATE INDEX skills_popularity_idx ON skills (usage_count DESC, id DESC);

-- "Company is public" now has its own function (00014); express vacancy_is_public with it
-- so the rule exists once.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION vacancy_is_public(v_status vacancy_status, v_company_id uuid) RETURNS boolean AS $$
    SELECT v_status = 'published'
       AND EXISTS (SELECT 1 FROM companies c WHERE c.id = v_company_id AND company_is_public(c.status));
$$ LANGUAGE sql STABLE;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION vacancy_is_public(v_status vacancy_status, v_company_id uuid) RETURNS boolean AS $$
    SELECT v_status = 'published'
       AND EXISTS (SELECT 1 FROM companies c WHERE c.id = v_company_id AND c.status = 'active');
$$ LANGUAGE sql STABLE;
-- +goose StatementEnd
DROP INDEX IF EXISTS skills_popularity_idx;
DROP INDEX IF EXISTS skills_newest_idx;
DROP VIEW IF EXISTS skill_directory;
DROP TRIGGER IF EXISTS skill_aliases_slug_exclusive ON skill_aliases;
DROP TRIGGER IF EXISTS skills_slug_exclusive ON skills;
DROP FUNCTION IF EXISTS skill_slug_exclusive();
DROP TABLE IF EXISTS skill_aliases;
