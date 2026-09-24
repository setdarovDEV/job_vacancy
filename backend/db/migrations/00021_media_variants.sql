-- Image processing (TZ BE-14, SEC-06): avatars, company logos and company covers are
-- re-encoded by the worker into WebP variants with no EXIF. The column that shows an image
-- (users.avatar_url, companies.logo_url/cover_url) changes only once its variants exist;
-- the *_file_id columns remember which upload the owner chose last, so a slow job for an
-- older upload can't overwrite a newer one. cover_lqip is a tiny inline WebP (data URI)
-- shown blurred while the cover loads (TZ FE-04).
--
-- Live-safe: nullable columns without defaults are metadata-only, and a new enum value is
-- not used in this transaction. No foreign keys on the *_file_id columns: they are hints
-- the worker compares against, and an FK from users/companies to files would need extra
-- indexes for every file deletion.
--
-- Rolling deploy: users and companies are read with SELECT *, so restart the API and the
-- worker right after this migration (up.sh and the deploy script do).

-- +goose Up
SET LOCAL lock_timeout = '5s';
ALTER TYPE file_purpose ADD VALUE IF NOT EXISTS 'company_cover';
ALTER TABLE users ADD COLUMN avatar_file_id uuid;
ALTER TABLE companies
    ADD COLUMN logo_file_id  uuid,
    ADD COLUMN cover_file_id uuid,
    ADD COLUMN cover_lqip    text;

-- +goose Down
SET LOCAL lock_timeout = '5s';
ALTER TABLE companies
    DROP COLUMN IF EXISTS cover_lqip,
    DROP COLUMN IF EXISTS cover_file_id,
    DROP COLUMN IF EXISTS logo_file_id;
ALTER TABLE users DROP COLUMN IF EXISTS avatar_file_id;
-- Postgres can't drop an enum value; 'company_cover' stays (unused once the API is rolled
-- back). Covers uploaded meanwhile keep their rows; their purpose is harmless.
