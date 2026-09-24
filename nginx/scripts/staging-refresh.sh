#!/usr/bin/env bash
# Staging refresh = the monthly restore drill (TZ OPS-03, OPS-08).
# Restores PRODUCTION's latest offsite backup into staging (RESTORE_S3_*: a read-only key),
# anonymizes it (nginx/postgres/anonymize.sql), and records how long it took and how fresh
# the data is (RPO). Staging data is disposable: the previous staging volume is removed.
#
#   nginx/scripts/staging-refresh.sh [--time "..."]      # make staging-refresh
. "$(dirname "$0")/lib.sh"
jv_env staging
[ "$(envget APP_ENV)" = staging ] || die "refusing: $ENV_FILE must say APP_ENV=staging"
[ -n "$(envget RESTORE_S3_PREFIX)" ] || die "set RESTORE_S3_* in $ENV_FILE (read-only access to production backups)"
profile_on db || die "staging must run its own Postgres (COMPOSE_PROFILES=db)"
exec 9>"$STATE_DIR/lock"
flock -n 9 || die "a deploy or restore of staging is running"
eval "$("$NGX/scripts/image-tags.sh")"
[ -f "$STATE_DIR/current" ] && eval "export $(cat "$STATE_DIR/current")"
export NGINX_TAG POSTGRES_TAG

project=$(envget COMPOSE_PROJECT_NAME jobvacancy-staging)
db=$(envget DB_NAME jobvacancy)
ts=$(date -u +%Y%m%dT%H%M%SZ)
newvol="${project}_pgdata_$ts"
report="$STATE_DIR/drill-$ts.log"
started=$(date -u +%FT%TZ)
t0=$(date +%s)

log "drill: restoring production backup into $newvol"
RESTORE_VOLUME=$newvol dc run --rm pg-restore "$@" --start --check 2>&1 | grep -vE '^INFO:' | tee "$report"
grep -q 'RESTORE_TOTAL_SECONDS=' "$report" || die "restore failed (log: $report)"
t_restore=$(( $(date +%s) - t0 ))
last_commit=$(grep -oE 'RESTORE_LAST_COMMIT=[^ ]+' "$report" | cut -d= -f2)

oldvol=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql"}}{{.Name}}{{end}}{{end}}' "$(dc ps -q postgres)" 2>/dev/null || true)
dc stop api-1 api-2 worker postgres
if grep -qE '^PGDATA_VOLUME=' "$ENV_FILE"; then
  sed -i -E "s|^PGDATA_VOLUME=.*|PGDATA_VOLUME=$newvol|" "$ENV_FILE"
else
  printf '\n# set by scripts/staging-refresh.sh\nPGDATA_VOLUME=%s\n' "$newvol" >>"$ENV_FILE"
fi
export PGDATA_VOLUME=$newvol
dc up -d --no-deps --wait --wait-timeout 600 postgres

log "staging secrets for the copied roles"
# SQL goes in on stdin so the passwords never show up in a process list.
sqlq() { local v=$1; printf "'%s'" "${v//\'/\'\'}"; }
app=$(envget APP_DB_USER jobvacancy)
printf 'ALTER ROLE postgres PASSWORD %s;\nALTER ROLE "%s" PASSWORD %s;\n' \
  "$(sqlq "$(envget POSTGRES_SUPERUSER_PASSWORD)")" "${app//\"/\"\"}" "$(sqlq "$(envget APP_DB_PASSWORD)")" \
  | dc exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Xq
log "anonymizing"
dc exec -T -e PGOPTIONS='-c jv.target=staging' postgres psql -v ON_ERROR_STOP=1 -U postgres -d "$db" -Xq -f - \
  <"$NGX/postgres/anonymize.sql" | tee -a "$report"
dc exec -T redis-state redis-cli FLUSHALL >/dev/null
dc exec -T redis-cache redis-cli FLUSHALL >/dev/null
dc run --rm migrate      # staging may be ahead of production
dc up -d --no-deps --wait --wait-timeout 180 api-1 api-2 worker
if [ -n "$oldvol" ] && [ "$oldvol" != "$newvol" ]; then docker volume rm "$oldvol" >/dev/null && log "removed old staging volume $oldvol"; fi

total=$(( $(date +%s) - t0 ))
rpo="n/a"
if [ -n "$last_commit" ] && [ "$last_commit" != n/a ]; then
  rpo="$(( $(date -u -d "$started" +%s) - $(date -u -d "$last_commit" +%s) ))s"
fi
{
  echo "DRILL $started: restore ${t_restore}s, total with anonymization ${total}s (target <= 3600s)"
  echo "DRILL last production commit in backup: $last_commit, drill started $started, data age at start: $rpo (target <= 300s under write load)"
} | tee -a "$report"
echo "$started restore=${t_restore}s total=${total}s last_commit=$last_commit age=$rpo" >>"$STATE_DIR/drills"
