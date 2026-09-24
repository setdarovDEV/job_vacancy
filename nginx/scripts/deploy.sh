#!/usr/bin/env bash
# Zero-downtime deploy (TZ OPS-01, order from OPS-06):
#   pull → infrastructure → backup point → migrate → api rolling (health gate) → web
#   rolling → worker → nginx / certbot / backup sidecar → smoke test.
#
#   nginx/scripts/deploy.sh production [TAG]     # make deploy TAG=<git sha or version>
#   nginx/scripts/deploy.sh staging [TAG]        # make deploy-staging
#
# BUILD=1         build the images here instead of pulling them (a server without CI/GHCR)
# SKIP_MIGRATE=1  (rollback) don't run migrations: they are additive, old code runs on them
# SKIP_BACKUP_POINT=1
#
# Rolling: each instance is drained in nginx first (bin/jv-upstream), recreated, gated on
# /readyz, then put back, so the other instance carries all traffic meanwhile. Postgres,
# Redis and MinIO are never recreated here (--no-recreate); nginx only when its image tag
# (a hash of its config) changed.
. "$(dirname "$0")/lib.sh"
jv_env "${1:?usage: deploy.sh production|staging [TAG]}"

exec 9>"$STATE_DIR/lock"
flock -n 9 || die "another deploy of $JV_ENV is running"

TAG=${2:-${TAG:-$(envget IMAGE_TAG latest)}}
eval "$("$NGX/scripts/image-tags.sh")"
NGINX_TAG=${NGINX_TAG_PIN:-$NGINX_TAG}           # rollback pins the recorded tags
POSTGRES_TAG=${POSTGRES_TAG_PIN:-$POSTGRES_TAG}
export IMAGE_TAG=$TAG NGINX_TAG POSTGRES_TAG
export GIT_COMMIT=${GIT_COMMIT:-$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)}

if [ "$JV_ENV" = production ]; then check_env_file; else dc config -q; fi
domain=$(envget DOMAIN)
case $domain in
  jobvacancy.uz | staging.jobvacancy.uz) ;;
  *) warn "DOMAIN=$domain is not a server_name in nginx/conf.d/jobvacancy.conf: add it there" ;;
esac

prev=$(cat "$STATE_DIR/current" 2>/dev/null || true)
log "deploying $JV_ENV release $TAG (nginx $NGINX_TAG, postgres $POSTGRES_TAG)"
[ -n "$prev" ] && log "current: $prev"

# ---- images --------------------------------------------------------------------------------
if [ "${BUILD:-0}" = 1 ]; then
  log "building images locally"
  dc build --pull
else
  log "pulling images"
  dc pull --quiet
fi

# ---- infrastructure (started if missing, never recreated here) -----------------------------
infra=(redis-cache redis-state minio)
profile_on db && infra+=(postgres)
log "infrastructure: ${infra[*]}"
dc up -d --no-recreate --wait --wait-timeout 300 "${infra[@]}"
dc run --rm --no-deps minio-init >/dev/null || die "minio-init failed (MinIO app user)"
if ! running nginx; then
  log "first start of nginx"
  dc up -d --no-deps --wait --wait-timeout 120 nginx
fi

# ---- backup point: a named WAL position to return to if the migration goes wrong ----------
if [ "${SKIP_BACKUP_POINT:-0}" != 1 ] && [ "$(envget BACKUP_ENABLED true)" = true ]; then
  rp="deploy_$(printf '%s' "$TAG" | tr -c 'A-Za-z0-9_' '_' | cut -c1-40)_$(date -u +%Y%m%dT%H%M%SZ)"
  if psql_super "select pg_create_restore_point('$rp'); select pg_switch_wal();" >/dev/null; then
    echo "$rp" >"$STATE_DIR/restore-point"
    log "restore point $rp (undo the migration: make restore NAME=$rp)"
  else
    die "could not create a restore point; fix Postgres access or set SKIP_BACKUP_POINT=1"
  fi
fi

# ---- migrations -----------------------------------------------------------------------------
if [ "${SKIP_MIGRATE:-0}" != 1 ]; then
  log "migrate up"
  dc run --rm migrate || die "migration failed: nothing was restarted, the old release keeps serving"
fi

# ---- rolling restart ------------------------------------------------------------------------
pending_up=""
roll() { # roll <service> <readiness url seen from nginx>
  local svc=$1 url=$2
  log "rolling $svc"
  nginx_exec jv-upstream ${pending_up:+up "$pending_up"} down "$svc" >/dev/null
  sleep "${DRAIN_SECONDS:-3}"   # in-flight requests finish on the old workers
  dc up -d --no-deps --wait --wait-timeout 180 "$svc" \
    || die "$svc failed its healthcheck (it stays drained, the other instance serves). Fix or: make rollback"
  wait_ready "$svc" "$url"
  pending_up=$svc
}
roll api-1 http://api-1:8090/readyz
roll api-2 http://api-2:8090/readyz
roll web-1 http://web-1:3000/robots.txt
roll web-2 http://web-2:3000/robots.txt
nginx_exec jv-upstream up "$pending_up" >/dev/null

log "worker"
dc up -d --no-deps --wait --wait-timeout 180 worker

# ---- edge and sidecars ---------------------------------------------------------------------
want_nginx="$(envget IMAGE_PREFIX ghcr.io/setdarovdev/jobvacancy)-nginx:$NGINX_TAG"
if [ "$(docker inspect -f '{{.Config.Image}}' "$(dc ps -q nginx)")" != "$want_nginx" ]; then
  warn "nginx image changed ($NGINX_TAG): recreating nginx (connections drop for a second)"
fi
dc up -d --no-deps --wait --wait-timeout 120 nginx
dc up -d --no-deps certbot
profile_on backup && dc up -d --no-deps pg-backup

# ---- smoke test through the real entry point -----------------------------------------------
log "smoke test"
for path in /api/v1/catalog/regions / /vacancies; do
  code=$(nginx_exec curl -sk -o /dev/null -w '%{http_code}' --resolve "$domain:443:127.0.0.1" "https://$domain$path" || true)
  [ "$code" = 200 ] || [ "$code" = 401 ] || die "smoke test $path answered $code"
done

# ---- bookkeeping ----------------------------------------------------------------------------
release="IMAGE_TAG=$TAG NGINX_TAG=$NGINX_TAG POSTGRES_TAG=$POSTGRES_TAG"
if [ -n "$prev" ] && [ "$prev" != "$release" ]; then echo "$prev" >"$STATE_DIR/previous"; fi
echo "$release" >"$STATE_DIR/current"
echo "$(date -u +%FT%TZ) $release commit=$GIT_COMMIT" >>"$STATE_DIR/history"
if [ -w /etc/cron.d ] && ! cmp -s <(sed "s#@ROOT@#$ROOT#g; s#@ENV@#$JV_ENV#g" "$NGX/cron/jobvacancy.cron") "/etc/cron.d/jobvacancy-$JV_ENV" 2>/dev/null; then
  sed "s#@ROOT@#$ROOT#g; s#@ENV@#$JV_ENV#g" "$NGX/cron/jobvacancy.cron" >"/etc/cron.d/jobvacancy-$JV_ENV"
  log "installed /etc/cron.d/jobvacancy-$JV_ENV"
fi
docker image prune -f --filter "until=168h" >/dev/null 2>&1 || true
log "done: $JV_ENV runs $TAG"
