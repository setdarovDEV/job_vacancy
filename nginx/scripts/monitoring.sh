#!/usr/bin/env bash
# Monitoring stack (TZ OPS-04/05): monitoring/docker-compose.monitoring.yml as its own compose
# project "<app project>-monitoring", reading the app's env file.
#
#   nginx/scripts/monitoring.sh production up        # make monitoring-up
#   nginx/scripts/monitoring.sh production ps|logs|down|pull|config
#   nginx/scripts/monitoring.sh production reload    # Prometheus + Alertmanager re-read config
#   nginx/scripts/monitoring.sh production sync      # after a deploy: new images + reload, if running
#   nginx/scripts/monitoring.sh production drill     # synthetic alert → Telegram, timed
#   nginx/scripts/monitoring.sh production drill-api # stop api-2 for real, time the alert
#   nginx/scripts/monitoring.sh production glitchtip-admin   # first GlitchTip user
. "$(dirname "$0")/lib.sh"
jv_env "${1:?usage: monitoring.sh production|staging <command>}"
shift
cmd=${1:-ps}
[ $# -gt 0 ] && shift

MON_FILE=$ROOT/monitoring/docker-compose.monitoring.yml
APP_PROJECT=$(envget COMPOSE_PROJECT_NAME jobvacancy)
MON_PROJECT="$APP_PROJECT-monitoring"
export APP_PROJECT
mon() { docker compose -p "$MON_PROJECT" --env-file "$ENV_FILE" -f "$MON_FILE" "$@"; }

# amquery PATH: GET from Alertmanager's API inside its container (no published port needed).
amquery() { mon exec -T alertmanager wget -qO- "http://127.0.0.1:9093$1"; }

# wait_alert NAME TIMEOUT: seconds until Alertmanager holds an active alert NAME, or fail.
wait_alert() {
  local name=$1 limit=$2 start now
  start=$(date +%s)
  while :; do
    if amquery "/api/v2/alerts?active=true&filter=alertname%3D%22$name%22" | grep -q "\"alertname\":\"$name\""; then
      now=$(date +%s)
      echo $((now - start))
      return 0
    fi
    [ $(($(date +%s) - start)) -lt "$limit" ] || return 1
    sleep 5
  done
}

# telegram_sent: notifications Alertmanager delivered to Telegram so far.
telegram_sent() {
  amquery /metrics | awk '/^alertmanager_notifications_total\{.*integration="telegram"/ {s += $2} END {print s + 0}'
}

case $cmd in
  up)
    for net in front back; do
      docker network inspect "${APP_PROJECT}_$net" >/dev/null 2>&1 \
        || die "app network ${APP_PROJECT}_$net is missing: run make deploy first"
    done
    [ -n "$(envget MONITORING_DB_PASSWORD)" ] || die "set MONITORING_DB_PASSWORD in $ENV_FILE (then make deploy applies it)"
    log "starting $MON_PROJECT"
    mon up -d --wait --wait-timeout 300 --remove-orphans "$@"
    mon ps
    log "Grafana http://localhost:3000, GlitchTip http://localhost:8000 (ssh -L 3000:127.0.0.1:3000 -L 8000:127.0.0.1:8000)"
    ;;
  config) mon config -q && echo "monitoring compose OK" ;;
  sync)
    # deploy.sh calls this: the configs are bind-mounted from the checkout, so a new commit
    # needs a reload; changed images or compose settings recreate just those services.
    if [ -z "$(mon ps -q prometheus 2>/dev/null)" ]; then
      log "monitoring is not running here (make monitoring-up to start it)"
      exit 0
    fi
    mon up -d --wait --wait-timeout 180 --remove-orphans
    "$0" "$JV_ENV" reload
    ;;
  reload)
    mon exec -T prometheus wget -qO- --post-data= http://127.0.0.1:9090/-/reload
    mon restart alertmanager   # re-renders alertmanager.yml from the env file
    log "reloaded"
    ;;
  drill)
    # 1) Routing: a synthetic critical alert straight into Alertmanager must reach Telegram.
    before=$(telegram_sent)
    now=$(date -u +%FT%TZ)
    body='[{"labels":{"alertname":"AlertDrill","severity":"critical","env":"'"$JV_ENV"'"},"annotations":{"summary":"Test alert from nginx/scripts/monitoring.sh drill (safe to ignore)"},"startsAt":"'"$now"'"}]'
    mon exec -T alertmanager wget -qO- --header 'Content-Type: application/json' --post-data "$body" \
      http://127.0.0.1:9093/api/v2/alerts >/dev/null
    start=$(date +%s)
    until [ "$(telegram_sent)" -gt "$before" ]; do
      [ $(($(date +%s) - start)) -lt 120 ] || die "no Telegram notification within 120 s: check ALERT_TELEGRAM_* and: $0 $JV_ENV logs alertmanager"
      sleep 2
    done
    log "AlertDrill delivered to Telegram in $(($(date +%s) - start)) s (see the chat)"
    ;;
  drill-api)
    # 2) End to end (TZ OPS-04 "sun'iy xato"): take api-2 out of nginx, stop it, time
    # ApiInstanceDown, then bring it back. api-1 serves everything meanwhile.
    log "draining and stopping api-2 (api-1 keeps serving)"
    nginx_exec jv-upstream down api-2 >/dev/null
    trap 'dc start api-2 >/dev/null; wait_ready api-2 http://api-2:8090/readyz; nginx_exec jv-upstream up api-2 >/dev/null; log "api-2 is back"' EXIT
    dc stop api-2 >/dev/null
    secs=$(wait_alert ApiInstanceDown 180) || die "ApiInstanceDown did not fire within 180 s"
    log "ApiInstanceDown active in Alertmanager after ${secs} s (Telegram gets it 10 s later)"
    [ "$secs" -le 110 ] || warn "slower than the 2-minute budget: check scrape/evaluation intervals"
    ;;
  glitchtip-admin)
    mon exec glitchtip ./manage.py createsuperuser
    ;;
  *) mon "$cmd" "$@" ;;
esac
