-- +goose Up

-- sent → viewed (employer opened it) → invited / interview → hired | rejected
-- withdrawn: the seeker pulled out. hired, rejected and withdrawn are final for the seeker,
-- but the employer can still move a card between columns (e.g. undo a rejection).
CREATE TYPE application_status AS ENUM ('sent', 'viewed', 'invited', 'interview', 'hired', 'rejected', 'withdrawn');
-- apply: the seeker applied. invite: the employer found the resume and invited them.
CREATE TYPE application_source AS ENUM ('apply', 'invite');

CREATE TABLE applications (
    id                uuid PRIMARY KEY DEFAULT uuidv7(),
    vacancy_id        uuid               NOT NULL REFERENCES vacancies (id) ON DELETE CASCADE,
    company_id        uuid               NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    seeker_id         uuid               NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- A resume with applications can't be deleted (the employer is looking at it);
    -- the seeker can hide it instead.
    resume_id         uuid               NOT NULL REFERENCES resumes (id) ON DELETE RESTRICT,
    source            application_source NOT NULL DEFAULT 'apply',
    status            application_status NOT NULL DEFAULT 'sent',
    cover_letter      text               NOT NULL DEFAULT '',
    employer_note     text               NOT NULL DEFAULT '',  -- private to the company
    viewed_at         timestamptz,
    status_changed_at timestamptz        NOT NULL DEFAULT now(),
    created_at        timestamptz        NOT NULL DEFAULT now(),
    updated_at        timestamptz        NOT NULL DEFAULT now(),
    UNIQUE (vacancy_id, seeker_id)
);
CREATE INDEX applications_vacancy_idx ON applications (vacancy_id, status, created_at DESC, id DESC);
CREATE INDEX applications_seeker_idx ON applications (seeker_id, created_at DESC, id DESC);
-- "Has this seeker applied to my company?" (contact visibility for applied_only resumes).
CREATE INDEX applications_company_seeker_idx ON applications (company_id, seeker_id);
CREATE TRIGGER applications_set_updated_at BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE application_events (
    id             bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    application_id uuid               NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
    actor_id       uuid               REFERENCES users (id) ON DELETE SET NULL,
    from_status    application_status,
    to_status      application_status NOT NULL,
    note           text               NOT NULL DEFAULT '',
    created_at     timestamptz        NOT NULL DEFAULT now()
);
CREATE INDEX application_events_app_idx ON application_events (application_id, id);

CREATE TABLE saved_vacancies (
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    vacancy_id uuid        NOT NULL REFERENCES vacancies (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, vacancy_id)
);
CREATE INDEX saved_vacancies_user_idx ON saved_vacancies (user_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS saved_vacancies;
DROP TABLE IF EXISTS application_events;
DROP TABLE IF EXISTS applications;
DROP TYPE IF EXISTS application_source;
DROP TYPE IF EXISTS application_status;
