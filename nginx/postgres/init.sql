-- Runs once when the Postgres volume is first created.
-- Extensions are also created by migrations (IF NOT EXISTS); creating them here as the
-- superuser means the application role never needs superuser rights.
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Separate database for integration tests.
CREATE DATABASE jobvacancy_test OWNER jobvacancy;
\connect jobvacancy_test
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
