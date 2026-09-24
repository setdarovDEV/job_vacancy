-- MVP features (TZ FN-01…FN-06, FN-08, SEC-05): the admin audit log, vacancy reports,
-- company invites, account deletion and consent fields, the "hide online status" setting,
-- featured-until dates, expiry warnings and SOATO codes for regions.
--
-- Every statement is live-safe: new tables and types, nullable columns (metadata only) and
-- one constant-default boolean (also metadata only since Postgres 11). The large-table
-- indexes these features need are built CONCURRENTLY in 00020.
--
-- Rolling deploy: users and vacancies gain columns and many queries read them with
-- SELECT *, so restart the API and worker right after this migration (as up.sh and the
-- deploy script do).

-- +goose Up
SET LOCAL lock_timeout = '5s';

-- FN-01: one row per admin action (who, what, on which object, with what details).
CREATE TABLE admin_audit_log (
    id          uuid PRIMARY KEY DEFAULT uuidv7(),
    admin_id    uuid        REFERENCES users (id) ON DELETE SET NULL,
    action      text        NOT NULL,            -- user.block, company.verify, vacancy.approve, …
    object_type text        NOT NULL,            -- user | company | vacancy | skill | report | search_term
    object_id   text        NOT NULL,
    details     jsonb       NOT NULL DEFAULT '{}',
    ip          inet,
    created_at  timestamptz NOT NULL DEFAULT now()
);
-- Newest first overall is the primary key order (uuidv7); these serve the filters.
CREATE INDEX admin_audit_log_object_idx ON admin_audit_log (object_type, object_id, id DESC);
CREATE INDEX admin_audit_log_admin_idx ON admin_audit_log (admin_id, id DESC);

-- FN-02: user reports. One report per user and object; enough open reports send a
-- published vacancy back to moderation.
CREATE TYPE report_object AS ENUM ('vacancy');
CREATE TYPE report_reason AS ENUM ('spam', 'fraud', 'offensive', 'discrimination', 'misleading', 'duplicate', 'other');
CREATE TYPE report_status AS ENUM ('open', 'resolved', 'dismissed');
CREATE TABLE reports (
    id              uuid PRIMARY KEY DEFAULT uuidv7(),
    object_type     report_object NOT NULL,
    object_id       uuid          NOT NULL,
    reporter_id     uuid          REFERENCES users (id) ON DELETE SET NULL,
    reason          report_reason NOT NULL,
    comment         text          NOT NULL DEFAULT '',
    status          report_status NOT NULL DEFAULT 'open',
    resolved_by     uuid          REFERENCES users (id) ON DELETE SET NULL,
    resolved_at     timestamptz,
    resolution_note text          NOT NULL DEFAULT '',
    created_at      timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT reports_once_per_user UNIQUE (object_type, object_id, reporter_id)
);
-- The admin queue: oldest open report first (uuidv7 ids are time-ordered).
CREATE INDEX reports_queue_idx ON reports (status, id);

-- FN-05: joining a company takes the invitee's consent. An invite is pending until it is
-- accepted, declined or revoked; it expires 7 days after it was (re)sent.
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'declined', 'revoked');
CREATE TABLE company_invites (
    id           uuid PRIMARY KEY DEFAULT uuidv7(),
    company_id   uuid                NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
    email        citext              NOT NULL,
    role         company_member_role NOT NULL CHECK (role <> 'owner'),
    invited_by   uuid                REFERENCES users (id) ON DELETE SET NULL,
    status       invite_status       NOT NULL DEFAULT 'pending',
    expires_at   timestamptz         NOT NULL,
    responded_by uuid                REFERENCES users (id) ON DELETE SET NULL,
    responded_at timestamptz,
    created_at   timestamptz         NOT NULL DEFAULT now()
);
-- One live invite per company and address; inviting again refreshes it.
CREATE UNIQUE INDEX company_invites_pending_key ON company_invites (company_id, email) WHERE status = 'pending';
CREATE INDEX company_invites_email_idx ON company_invites (email, id DESC) WHERE status = 'pending';
CREATE INDEX company_invites_company_idx ON company_invites (company_id, id DESC);

-- FN-03 account deletion, FN-08 consent to personal data processing, SEC-05 presence.
ALTER TABLE users
    ADD COLUMN deleted_at      timestamptz,
    ADD COLUMN consent_version text,
    ADD COLUMN consent_at      timestamptz,
    ADD COLUMN hide_online     boolean NOT NULL DEFAULT false;

-- FN-01 "TOP" until a date; FN-04 republish without moderation needs to know whether the
-- content changed since the vacancy was last published (NULL: never edited after creation).
ALTER TABLE vacancies
    ADD COLUMN featured_until     timestamptz,
    ADD COLUMN content_updated_at timestamptz;

-- FN-04: the "expires in 3 days" warning is sent once per expiry date.
CREATE TABLE vacancy_expiry_warnings (
    vacancy_id uuid PRIMARY KEY REFERENCES vacancies (id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    warned_at  timestamptz NOT NULL DEFAULT now()
);

-- FN-06: official SOATO codes; districts are loaded by `ctl import-districts`.
ALTER TABLE regions ADD COLUMN soato integer UNIQUE;
UPDATE regions r SET soato = v.code
FROM (VALUES ('andijan', 1703), ('bukhara', 1706), ('jizzakh', 1708), ('kashkadarya', 1710),
             ('navoi', 1712), ('namangan', 1714), ('samarkand', 1718), ('surkhandarya', 1722),
             ('syrdarya', 1724), ('tashkent-city', 1726), ('tashkent', 1727), ('fergana', 1730),
             ('khorezm', 1733), ('karakalpakstan', 1735)) AS v(slug, code)
WHERE r.slug = v.slug;

-- FN-03: a company whose only member deletes their account is closed with it. Adding an
-- enum value is metadata only; it is not used before this transaction commits.
ALTER TYPE company_status ADD VALUE IF NOT EXISTS 'deleted';

-- +goose Down
SET LOCAL lock_timeout = '5s';
-- Postgres can't drop an enum value: closed companies become blocked, the value stays.
UPDATE companies SET status = 'blocked' WHERE status::text = 'deleted';
ALTER TABLE regions DROP COLUMN IF EXISTS soato;
DROP TABLE IF EXISTS vacancy_expiry_warnings;
ALTER TABLE vacancies
    DROP COLUMN IF EXISTS content_updated_at,
    DROP COLUMN IF EXISTS featured_until;
ALTER TABLE users
    DROP COLUMN IF EXISTS hide_online,
    DROP COLUMN IF EXISTS consent_at,
    DROP COLUMN IF EXISTS consent_version,
    DROP COLUMN IF EXISTS deleted_at;
DROP TABLE IF EXISTS company_invites;
DROP TYPE IF EXISTS invite_status;
DROP TABLE IF EXISTS reports;
DROP TYPE IF EXISTS report_status;
DROP TYPE IF EXISTS report_reason;
DROP TYPE IF EXISTS report_object;
DROP TABLE IF EXISTS admin_audit_log;
