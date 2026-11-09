-- +goose Up
-- Reports ("shikoyat"): a signed-in user flags a public vacancy or company. Admins handle
-- them per target: resolving or dismissing a target closes all of its open reports.
CREATE TYPE report_target AS ENUM ('vacancy', 'company');
CREATE TYPE report_reason AS ENUM ('fraud', 'misleading', 'offensive', 'spam', 'other');
CREATE TYPE report_status AS ENUM ('open', 'resolved', 'dismissed');

-- A company is public (shown, reportable) while it's active; the vacancy counterpart is
-- vacancy_is_public() from migration 00013.
CREATE FUNCTION company_is_public(c_status company_status) RETURNS boolean AS $$
    SELECT c_status = 'active'
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE reports (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    reporter_id     uuid          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    target_type     report_target NOT NULL,
    vacancy_id      uuid          REFERENCES vacancies (id) ON DELETE CASCADE,
    company_id      uuid          REFERENCES companies (id) ON DELETE CASCADE,
    -- The target's id whatever its type; the admin queue groups by it.
    target_id       uuid          NOT NULL GENERATED ALWAYS AS (coalesce(vacancy_id, company_id)) STORED,
    reason          report_reason NOT NULL,
    comment         text          CHECK (char_length(comment) <= 1000),
    status          report_status NOT NULL DEFAULT 'open',
    resolution_note text          CHECK (char_length(resolution_note) <= 1000),
    resolved_by     uuid          REFERENCES users (id) ON DELETE SET NULL,
    resolved_at     timestamptz,
    created_at      timestamptz   NOT NULL DEFAULT now(),
    -- Exactly the id column that matches target_type is set.
    CONSTRAINT reports_one_target CHECK (
        (target_type = 'vacancy' AND vacancy_id IS NOT NULL AND company_id IS NULL) OR
        (target_type = 'company' AND company_id IS NOT NULL AND vacancy_id IS NULL)),
    -- "Other" says nothing by itself, so it needs a comment.
    CONSTRAINT reports_other_has_comment CHECK (reason <> 'other' OR btrim(coalesce(comment, '')) <> ''),
    CONSTRAINT reports_closed_consistent CHECK ((status = 'open') = (resolved_at IS NULL))
);

-- One open report per reporter and target (a new one may be filed after it's closed).
CREATE UNIQUE INDEX reports_one_open_per_reporter ON reports (reporter_id, target_id) WHERE status = 'open';
CREATE INDEX reports_target_idx ON reports (target_id, status, created_at DESC);
CREATE INDEX reports_status_idx ON reports (status, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS reports;
DROP FUNCTION IF EXISTS company_is_public(company_status);
DROP TYPE IF EXISTS report_status;
DROP TYPE IF EXISTS report_reason;
DROP TYPE IF EXISTS report_target;
