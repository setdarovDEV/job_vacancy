#!/bin/bash
# First start of an empty volume only (docker-entrypoint-initdb.d). The superuser stays
# "postgres" (backups, migrations of extensions); the application connects as APP_DB_USER,
# which owns its database but is not a superuser. Extensions are created here so the app
# role never needs superuser rights (migrations use CREATE EXTENSION IF NOT EXISTS).
set -euo pipefail
: "${APP_DB_USER:?}" "${APP_DB_PASSWORD:?}" "${POSTGRES_DB:?}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v app_user="$APP_DB_USER" -v app_password="$APP_DB_PASSWORD" -v db="$POSTGRES_DB" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') \gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', :'db', :'app_user') \gexec
-- Monitoring (postgres_exporter, TZ OPS-04): read-only statistics, no table access.
SELECT 'CREATE ROLE monitoring LOGIN NOSUPERUSER IN ROLE pg_monitor'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'monitoring') \gexec
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v app_user="$APP_DB_USER" <<'SQL'
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT format('ALTER SCHEMA public OWNER TO %I', :'app_user') \gexec
SQL
if [ -n "${MONITORING_DB_PASSWORD:-}" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -v pw="$MONITORING_DB_PASSWORD" <<'SQL'
ALTER ROLE monitoring PASSWORD :'pw';
SQL
fi
echo "initdb: role $APP_DB_USER owns database $POSTGRES_DB; extensions ready"
