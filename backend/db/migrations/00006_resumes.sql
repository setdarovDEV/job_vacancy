-- +goose Up

-- public: employers find it in candidate search.
-- applied_only: visible only to companies the seeker has applied to.
-- hidden: visible only to its owner.
CREATE TYPE resume_visibility AS ENUM ('public', 'applied_only', 'hidden');
CREATE TYPE education_level AS ENUM ('secondary', 'vocational', 'incomplete_higher', 'bachelor', 'master', 'phd');
CREATE TYPE language_level AS ENUM ('a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native');

CREATE TABLE resumes (
    id                uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id           uuid              NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title             text              NOT NULL,           -- desired position
    about             text              NOT NULL DEFAULT '',
    category_id       integer           REFERENCES categories (id),
    region_id         integer           REFERENCES regions (id),
    relocate          boolean           NOT NULL DEFAULT false,
    desired_salary    bigint            CHECK (desired_salary >= 0),
    currency          currency          NOT NULL DEFAULT 'UZS',
    -- text[] rather than enum[] keeps array parameters simple for the driver; the
    -- CHECKs keep the values honest.
    employment_types  text[]            NOT NULL DEFAULT '{}'
        CHECK (employment_types <@ ARRAY['full_time', 'part_time', 'project', 'internship', 'volunteer']),
    work_formats      text[]            NOT NULL DEFAULT '{}'
        CHECK (work_formats <@ ARRAY['office', 'remote', 'hybrid']),
    visibility        resume_visibility NOT NULL DEFAULT 'public',
    -- Total work experience (overlapping jobs counted once), computed on save.
    experience_months integer           NOT NULL DEFAULT 0,
    created_at        timestamptz       NOT NULL DEFAULT now(),
    updated_at        timestamptz       NOT NULL DEFAULT now()
);
CREATE INDEX resumes_user_idx ON resumes (user_id, updated_at DESC);
CREATE TRIGGER resumes_set_updated_at BEFORE UPDATE ON resumes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE resume_experiences (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    resume_id   uuid    NOT NULL REFERENCES resumes (id) ON DELETE CASCADE,
    company     text    NOT NULL,
    position    text    NOT NULL,
    start_date  date    NOT NULL,
    end_date    date,                -- NULL = current job
    description text    NOT NULL DEFAULT '',
    sort_order  integer NOT NULL DEFAULT 0,
    CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX resume_experiences_resume_idx ON resume_experiences (resume_id, sort_order);

CREATE TABLE resume_educations (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    resume_id   uuid            NOT NULL REFERENCES resumes (id) ON DELETE CASCADE,
    institution text            NOT NULL,
    level       education_level NOT NULL,
    field       text            NOT NULL DEFAULT '',
    start_year  smallint,
    end_year    smallint,
    sort_order  integer         NOT NULL DEFAULT 0,
    CHECK (end_year IS NULL OR start_year IS NULL OR end_year >= start_year)
);
CREATE INDEX resume_educations_resume_idx ON resume_educations (resume_id, sort_order);

CREATE TABLE resume_skills (
    resume_id uuid    NOT NULL REFERENCES resumes (id) ON DELETE CASCADE,
    skill_id  integer NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
    PRIMARY KEY (resume_id, skill_id)
);
CREATE INDEX resume_skills_skill_idx ON resume_skills (skill_id);

CREATE TABLE resume_languages (
    resume_id uuid           NOT NULL REFERENCES resumes (id) ON DELETE CASCADE,
    language  text           NOT NULL CHECK (language ~ '^[a-z]{2,3}$'), -- ISO 639: uz, ru, en, tr…
    level     language_level NOT NULL,
    PRIMARY KEY (resume_id, language)
);

-- Candidate search index, same design as vacancy_search (see migration 00005):
-- filter columns are copied so a search picks its page of ids from this table alone.
CREATE TABLE resume_search (
    resume_id         uuid PRIMARY KEY REFERENCES resumes (id) ON DELETE CASCADE,
    is_public         boolean  NOT NULL,
    updated_at        timestamptz NOT NULL,
    category_id       integer,
    region_id         integer,
    relocate          boolean  NOT NULL,
    experience_months integer  NOT NULL,
    desired_salary    bigint,
    currency          currency NOT NULL,
    employment_types  text[]   NOT NULL,
    work_formats      text[]   NOT NULL,
    languages         text[]   NOT NULL,
    title             text     NOT NULL,
    tags              text     NOT NULL,   -- skills
    meta              text     NOT NULL,   -- category and region names, all languages
    body              text     NOT NULL,   -- about + positions + companies + education
    document          tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', title), 'A') ||
        setweight(to_tsvector('simple', tags), 'B') ||
        setweight(to_tsvector('simple', meta), 'C') ||
        setweight(to_tsvector('simple', left(body, 20000)), 'D')
    ) STORED
);
CREATE INDEX resume_search_document_idx ON resume_search USING gin (document) WHERE is_public;
CREATE INDEX resume_search_title_trgm_idx ON resume_search USING gin (title gin_trgm_ops) WHERE is_public;
CREATE INDEX resume_search_recent_idx ON resume_search (updated_at DESC, resume_id DESC) WHERE is_public;

-- +goose Down
DROP TABLE IF EXISTS resume_search;
DROP TABLE IF EXISTS resume_languages;
DROP TABLE IF EXISTS resume_skills;
DROP TABLE IF EXISTS resume_educations;
DROP TABLE IF EXISTS resume_experiences;
DROP TABLE IF EXISTS resumes;
DROP TYPE IF EXISTS language_level;
DROP TYPE IF EXISTS education_level;
DROP TYPE IF EXISTS resume_visibility;
