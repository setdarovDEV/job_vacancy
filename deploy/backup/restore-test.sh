#!/usr/bin/env bash
# Proves the latest backup can be restored: loads db.dump into a throwaway Postgres container
# (never the live database) and compares row counts of key tables with the live database.
# Run monthly and after changing backup.sh:  bash restore-test.sh [backup-dir]
set -euo pipefail

ROOT=${PROJECT_DIR:-/opt/jobvacancy}
DEST=${BACKUP_DIR:-/var/backups/jobvacancy}
RUN=${1:-$(ls -1d "$DEST"/*/ | sort | tail -1)}
env_get() { grep -E "^$1=" "$ROOT/nginx/.env" | head -1 | cut -d= -f2-; }
PGUSER=$(env_get POSTGRES_USER); PGDB=$(env_get POSTGRES_DB)
NAME=jobvacancy-restore-test

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

echo "restoring $RUN into a temporary container"
# A bare server: the dump itself carries the extensions and functions (incl. uuidv7()).
docker run -d --name "$NAME" -e POSTGRES_USER="$PGUSER" -e POSTGRES_PASSWORD=restore -e POSTGRES_DB="$PGDB" \
  postgres:17-alpine >/dev/null
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U "$PGUSER" -d "$PGDB" >/dev/null 2>&1 && break; sleep 1; done
sleep 2
docker exec -i "$NAME" pg_restore -U "$PGUSER" -d "$PGDB" --no-owner --exit-on-error < "$RUN/db.dump"

Q="select 'users',count(*) from users union all select 'companies',count(*) from companies
   union all select 'vacancies',count(*) from vacancies union all select 'resumes',count(*) from resumes
   union all select 'applications',count(*) from applications union all select 'messages',count(*) from messages
   order by 1"
restored=$(docker exec "$NAME" psql -U "$PGUSER" -d "$PGDB" -Atc "$Q")
live=$(docker exec jobvacancy-postgres-1 psql -U "$PGUSER" -d "$PGDB" -Atc "$Q")
printf "%-14s %10s %10s\n" table restored live
paste -d'|' <(echo "$restored") <(echo "$live" | cut -d'|' -f2) | awk -F'|' '{printf "%-14s %10s %10s\n",$1,$2,$3}'
docker exec "$NAME" psql -U "$PGUSER" -d "$PGDB" -Atc "select uuidv7()" >/dev/null
echo "restore test ok (counts can differ only by writes made after the backup)"
