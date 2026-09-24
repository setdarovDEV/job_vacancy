#!/usr/bin/env bash
# Point-in-time restore of the live database (TZ OPS-03; docs/RUNBOOK.md "Restore").
#
#   nginx/scripts/restore.sh production                          # latest archived state
#   nginx/scripts/restore.sh production --time "2026-09-24 14:05:00+05"
#   nginx/scripts/restore.sh production --name deploy_v1_4_0_20260924T090000Z
#   (make restore / make restore TIME="..." / make restore NAME=...)
#
# 1. restores the offsite backup into a NEW volume and replays WAL to the target;
# 2. asks for confirmation (YES=1 skips), stops api/worker (nginx answers 503 meanwhile);
# 3. points Postgres at the new volume (PGDATA_VOLUME in the env file); the old volume stays;
# 4. starts the app again and takes a fresh full backup on the new timeline.
. "$(dirname "$0")/lib.sh"
jv_env "${1:?usage: restore.sh production|staging [--time T | --name RESTORE_POINT]}"
shift
profile_on db || die "Postgres does not run on this host (COMPOSE_PROFILES): run this on the database host"
exec 9>"$STATE_DIR/lock"
flock -n 9 || die "a deploy or restore of $JV_ENV is running"
eval "$("$NGX/scripts/image-tags.sh")"
[ -f "$STATE_DIR/current" ] && eval "export $(cat "$STATE_DIR/current")"
export NGINX_TAG POSTGRES_TAG

project=$(envget COMPOSE_PROJECT_NAME jobvacancy)
ts=$(date -u +%Y%m%dT%H%M%SZ)
newvol="${project}_pgdata_$ts"
report="$STATE_DIR/restore-$ts.log"
t0=$(date +%s)
log "restoring ${*:-the latest state} into new volume $newvol"
RESTORE_VOLUME=$newvol dc run --rm pg-restore "$@" --start --check 2>&1 | grep -vE '^INFO:' | tee "$report"
grep -q 'RESTORE_TOTAL_SECONDS=' "$report" || die "restore failed, live database untouched (log: $report)"
t_restore=$(( $(date +%s) - t0 ))

domain=$(envget DOMAIN)
if [ "${YES:-0}" != 1 ]; then
  read -r -p "Switch $JV_ENV to the restored database? Type $domain to continue: " answer
  [ "$answer" = "$domain" ] || die "aborted; the restored copy stays in volume $newvol"
fi
oldvol=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql"}}{{.Name}}{{end}}{{end}}' "$(dc ps -q postgres)" 2>/dev/null || true)

log "stopping api and worker (nginx answers 503 meanwhile)"
dc stop api-1 api-2 worker
profile_on backup && dc stop pg-backup
dc stop postgres
if grep -qE '^PGDATA_VOLUME=' "$ENV_FILE"; then
  sed -i -E "s|^PGDATA_VOLUME=.*|PGDATA_VOLUME=$newvol|" "$ENV_FILE"
else
  printf '\n# set by scripts/restore.sh %s (previous: %s)\nPGDATA_VOLUME=%s\n' "$ts" "${oldvol:-default}" "$newvol" >>"$ENV_FILE"
fi
export PGDATA_VOLUME=$newvol
dc up -d --no-deps --wait --wait-timeout 600 postgres
dc up -d --no-deps --wait --wait-timeout 180 api-1 api-2 worker
if profile_on backup; then
  dc up -d --no-deps pg-backup
  log "fresh full backup on the new timeline"
  dc exec -T pg-backup walg-backup-now || warn "backup failed: run make backup"
fi
log "done: restore ${t_restore}s, total $(( $(date +%s) - t0 ))s (report $report)"
log "previous volume ${oldvol:-?} kept; remove it once you no longer need it: docker volume rm ${oldvol:-<name>}"
