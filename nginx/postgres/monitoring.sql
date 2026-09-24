-- Read-only access for the monitoring stack (TZ OPS-04). Idempotent; nginx/scripts/deploy.sh
-- runs it as the superuser on the app database after every `migrate up`, so grants follow
-- new tables. Run by hand:  psql -U postgres -d jobvacancy -f nginx/postgres/monitoring.sql
--
-- The "monitoring" role (created by initdb/10-roles.sh, pg_monitor) gets:
--   * statistics views through pg_monitor (postgres_exporter);
--   * column-level SELECT on exactly the columns the SQL collectors read
--     (monitoring/sql-exporter/*.collector.yml): states, queues, statuses, ids, timestamps.
--     No names, e-mails, phones, texts or password hashes;
--   * the backup log jv_ops.backup_runs, written by the pg-backup container
--     (postgres/bin/walg-backup-now).
\set ON_ERROR_STOP on
SET client_min_messages = warning;

SELECT 'CREATE ROLE monitoring LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE IN ROLE pg_monitor'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'monitoring') \gexec
GRANT pg_monitor TO monitoring;
ALTER ROLE monitoring SET statement_timeout = '10s';
ALTER ROLE monitoring SET lock_timeout = '1s';
ALTER ROLE monitoring SET default_transaction_read_only = on;

-- The password comes from the container environment (MONITORING_DB_PASSWORD), never from
-- the command line.
\getenv mon_pw MONITORING_DB_PASSWORD
\if :{?mon_pw}
SELECT format('ALTER ROLE monitoring PASSWORD %L', :'mon_pw') WHERE :'mon_pw' <> '' \gexec
\endif

SELECT format('GRANT CONNECT ON DATABASE %I TO monitoring', current_database()) \gexec
GRANT USAGE ON SCHEMA public TO monitoring;

-- River queue depth, latency, failures (monitoring/sql-exporter/river.collector.yml).
GRANT SELECT (queue, state, kind, scheduled_at, finalized_at) ON public.river_job TO monitoring;
-- Business dashboard (monitoring/sql-exporter/business.collector.yml).
GRANT SELECT (id, role, status) ON public.users TO monitoring;
GRANT SELECT (id, status, submitted_at, published_at) ON public.vacancies TO monitoring;
GRANT SELECT (id) ON public.applications, public.companies, public.resumes TO monitoring;

-- Backup log (jv_ops is ops-owned, outside the app's migrations).
CREATE SCHEMA IF NOT EXISTS jv_ops;
CREATE TABLE IF NOT EXISTS jv_ops.backup_runs (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at       timestamptz NOT NULL,
  finished_at      timestamptz NOT NULL DEFAULT now(),
  ok               boolean     NOT NULL,
  backup_name      text,
  compressed_bytes bigint,
  message          text
);
CREATE INDEX IF NOT EXISTS backup_runs_finished_idx ON jv_ops.backup_runs (finished_at DESC);
GRANT USAGE ON SCHEMA jv_ops TO monitoring;
GRANT SELECT ON jv_ops.backup_runs TO monitoring;
