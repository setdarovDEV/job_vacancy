-- Runs once when the Postgres volume is first created.
-- Extensions are also created by migrations (IF NOT EXISTS); creating them here as the
-- superuser means the application role never needs superuser rights.
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- uuidv7() is used by migrations to generate sortable primary keys.
-- If the pg_uuidv7 extension is available, skip this fallback implementation.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_uuidv7') THEN
        CREATE OR REPLACE FUNCTION uuidv7()
        RETURNS uuid
        LANGUAGE plpgsql
        PARALLEL SAFE
        AS $func$
        DECLARE
            ts_millis bigint;
            rand bytea;
            hex text;
        BEGIN
            ts_millis := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
            rand := gen_random_bytes(16);
            rand := set_byte(rand, 0, ((ts_millis >> 40) & 255)::int);
            rand := set_byte(rand, 1, ((ts_millis >> 32) & 255)::int);
            rand := set_byte(rand, 2, ((ts_millis >> 24) & 255)::int);
            rand := set_byte(rand, 3, ((ts_millis >> 16) & 255)::int);
            rand := set_byte(rand, 4, ((ts_millis >> 8) & 255)::int);
            rand := set_byte(rand, 5, (ts_millis & 255)::int);
            rand := set_byte(rand, 6, (get_byte(rand, 6) & 15) | 112); -- version 7
            rand := set_byte(rand, 8, (get_byte(rand, 8) & 63) | 128); -- variant 10
            hex := encode(rand, 'hex');
            RETURN (substr(hex,1,8) || '-' || substr(hex,9,4) || '-' || substr(hex,13,4) || '-' || substr(hex,17,4) || '-' || substr(hex,21,12))::uuid;
        END;
        $func$;
    END IF;
END
$$;

-- Separate database for integration tests.
CREATE DATABASE jobvacancy_test OWNER jobvacancy;
\connect jobvacancy_test
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_uuidv7') THEN
        CREATE OR REPLACE FUNCTION uuidv7()
        RETURNS uuid
        LANGUAGE plpgsql
        PARALLEL SAFE
        AS $func$
        DECLARE
            ts_millis bigint;
            rand bytea;
            hex text;
        BEGIN
            ts_millis := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;
            rand := gen_random_bytes(16);
            rand := set_byte(rand, 0, ((ts_millis >> 40) & 255)::int);
            rand := set_byte(rand, 1, ((ts_millis >> 32) & 255)::int);
            rand := set_byte(rand, 2, ((ts_millis >> 24) & 255)::int);
            rand := set_byte(rand, 3, ((ts_millis >> 16) & 255)::int);
            rand := set_byte(rand, 4, ((ts_millis >> 8) & 255)::int);
            rand := set_byte(rand, 5, (ts_millis & 255)::int);
            rand := set_byte(rand, 6, (get_byte(rand, 6) & 15) | 112);
            rand := set_byte(rand, 8, (get_byte(rand, 8) & 63) | 128);
            hex := encode(rand, 'hex');
            RETURN (substr(hex,1,8) || '-' || substr(hex,9,4) || '-' || substr(hex,13,4) || '-' || substr(hex,17,4) || '-' || substr(hex,21,12))::uuid;
        END;
        $func$;
    END IF;
END
$$;
