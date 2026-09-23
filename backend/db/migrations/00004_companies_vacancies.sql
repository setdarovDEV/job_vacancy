-- +goose Up

CREATE TYPE company_size AS ENUM ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+');
CREATE TYPE company_status AS ENUM ('active', 'blocked');
CREATE TYPE company_member_role AS ENUM ('owner', 'admin', 'recruiter');

CREATE TABLE companies (
    id           uuid PRIMARY KEY DEFAULT uuidv7(),
    owner_id     uuid           NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    name         text           NOT NULL,
    slug         text           NOT NULL UNIQUE,
    logo_url     text,
    cover_url    text,
    industry_id  integer        REFERENCES categories (id),
    size         company_size,
    website      text,
    email        citext,
    phone        text,
    region_id    integer        REFERENCES regions (id),
    address      text,
    about        text           NOT NULL DEFAULT '',
    founded_year smallint       CHECK (founded_year BETWEEN 1800 AND 2100),
    -- Verified companies publish without moderation and show a badge.
    verified_at  timestamptz,
    status       company_status NOT NULL DEFAULT 'active',
    created_at   timestamptz    NOT NULL DEFAULT now(),
    updated_at   timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX companies_name_trgm_idx ON companies USING gin (lower(name) gin_trgm_ops);
CREATE TRIGGER companies_set_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE company_members (
    company_id uuid                NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    user_id    uuid                NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role       company_member_role NOT NULL,
    created_at timestamptz         NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, user_id)
);
CREATE INDEX company_members_user_idx ON company_members (user_id);

CREATE TYPE employment_type AS ENUM ('full_time', 'part_time', 'project', 'internship', 'volunteer');
CREATE TYPE work_format AS ENUM ('office', 'remote', 'hybrid');
CREATE TYPE experience_level AS ENUM ('none', '1_3', '3_6', '6_plus');
CREATE TYPE work_schedule AS ENUM ('full_day', 'shift', 'flexible', 'rotation');
CREATE TYPE currency AS ENUM ('UZS', 'USD');
-- draft → moderation → published → archived | expired;  moderation → rejected → (edit) → moderation
CREATE TYPE vacancy_status AS ENUM ('draft', 'moderation', 'published', 'rejected', 'archived', 'expired');

CREATE TABLE vacancies (
    id                 uuid PRIMARY KEY DEFAULT uuidv7(),
    company_id         uuid             NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    created_by         uuid             NOT NULL REFERENCES users (id),
    title              text             NOT NULL,
    slug               text             NOT NULL UNIQUE,
    description        text             NOT NULL,
    category_id        integer          NOT NULL REFERENCES categories (id),
    region_id          integer          NOT NULL REFERENCES regions (id),
    district_id        integer          REFERENCES regions (id),
    address            text,
    salary_min         bigint           CHECK (salary_min >= 0),
    salary_max         bigint           CHECK (salary_max >= 0),
    currency           currency         NOT NULL DEFAULT 'UZS',
    employment_type    employment_type  NOT NULL,
    work_format        work_format      NOT NULL,
    experience         experience_level NOT NULL,
    schedule           work_schedule    NOT NULL,
    status             vacancy_status   NOT NULL DEFAULT 'draft',
    reject_reason      text,
    moderated_by       uuid             REFERENCES users (id),
    moderated_at       timestamptz,
    is_featured        boolean          NOT NULL DEFAULT false,
    views_count        integer          NOT NULL DEFAULT 0,
    applications_count integer          NOT NULL DEFAULT 0,
    submitted_at       timestamptz,
    published_at       timestamptz,
    expires_at         timestamptz,
    created_at         timestamptz      NOT NULL DEFAULT now(),
    updated_at         timestamptz      NOT NULL DEFAULT now(),
    CONSTRAINT vacancies_salary_range CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);
CREATE TRIGGER vacancies_set_updated_at BEFORE UPDATE ON vacancies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Public listing only ever touches published rows; partial indexes keep them small and hot.
CREATE INDEX vacancies_published_idx ON vacancies (published_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX vacancies_published_category_idx ON vacancies (category_id, published_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX vacancies_published_region_idx ON vacancies (region_id, published_at DESC, id DESC) WHERE status = 'published';
CREATE INDEX vacancies_company_idx ON vacancies (company_id, created_at DESC);
CREATE INDEX vacancies_moderation_idx ON vacancies (submitted_at) WHERE status = 'moderation';
CREATE INDEX vacancies_expiry_idx ON vacancies (expires_at) WHERE status = 'published';

CREATE TABLE vacancy_skills (
    vacancy_id uuid    NOT NULL REFERENCES vacancies (id) ON DELETE CASCADE,
    skill_id   integer NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
    PRIMARY KEY (vacancy_id, skill_id)
);
CREATE INDEX vacancy_skills_skill_idx ON vacancy_skills (skill_id);

-- +goose Down
DROP TABLE IF EXISTS vacancy_skills;
DROP TABLE IF EXISTS vacancies;
DROP TYPE IF EXISTS vacancy_status;
DROP TYPE IF EXISTS currency;
DROP TYPE IF EXISTS work_schedule;
DROP TYPE IF EXISTS experience_level;
DROP TYPE IF EXISTS work_format;
DROP TYPE IF EXISTS employment_type;
DROP TABLE IF EXISTS company_members;
DROP TABLE IF EXISTS companies;
DROP TYPE IF EXISTS company_member_role;
DROP TYPE IF EXISTS company_status;
DROP TYPE IF EXISTS company_size;
