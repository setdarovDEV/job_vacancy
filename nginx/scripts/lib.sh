#!/usr/bin/env bash
# Shared helpers for the deploy scripts (sourced). Usage in a script:
#   . "$(dirname "$0")/lib.sh"; jv_env production|staging
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
NGX=$ROOT/nginx

log()  { printf '\033[1;34m[%s]\033[0m %s\n' "$(date -u +%H:%M:%S)" "$*"; }
warn() { printf '\033[1;33m[%s] %s\033[0m\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
die()  { printf '\033[1;31m[%s] %s\033[0m\n' "$(date -u +%H:%M:%S)" "$*" >&2; exit 1; }

# jv_env <production|staging>: picks the env file and compose files.
jv_env() {
  JV_ENV=$1
  case $JV_ENV in
    production) ENV_FILE=${ENV_FILE:-$ROOT/.env.production}; COMPOSE_FILES=(-f "$NGX/docker-compose.prod.yml") ;;
    staging) ENV_FILE=${ENV_FILE:-$ROOT/.env.staging}
      COMPOSE_FILES=(-f "$NGX/docker-compose.prod.yml" -f "$NGX/docker-compose.staging.yml") ;;
    *) die "environment must be production or staging (got '$JV_ENV')" ;;
  esac
  [ -f "$ENV_FILE" ] || die "$ENV_FILE is missing: copy .env.$JV_ENV.example (see docs/RUNBOOK.md)"
  STATE_DIR=$NGX/.deploy/$JV_ENV
  mkdir -p "$STATE_DIR"
}

# dc ...: docker compose for the selected environment.
dc() { docker compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" "$@"; }

# envget NAME [default]: a value from the env file (last assignment wins, quotes and inline
# comments stripped the way compose reads them).
envget() {
  local line val
  line=$(grep -E "^[[:space:]]*$1=" "$ENV_FILE" | tail -1 || true)
  [ -n "$line" ] || { printf '%s' "${2:-}"; return; }
  val=${line#*=}
  case $val in
    \'*) val=${val#\'}; val=${val%%\'*} ;;
    \"*) val=${val#\"}; val=${val%%\"*} ;;
    *) val=$(printf '%s' "$val" | sed -E 's/[[:space:]]+#.*$//; s/[[:space:]]+$//') ;;
  esac
  printf '%s' "${val:-${2:-}}"
}

profile_on() { [[ ",$(envget COMPOSE_PROFILES)," == *",$1,"* ]]; }

running() { [ -n "$(dc ps --status running -q "$1" 2>/dev/null)" ]; }

# nginx_exec CMD...: run a command inside the nginx container (drain, reload, probes).
nginx_exec() { dc exec -T nginx "$@"; }

# wait_ready SERVICE URL: poll URL from inside nginx until 200 (the health gate between
# rolling steps; independent of Docker's own healthcheck timing).
wait_ready() {
  local svc=$1 url=$2 _
  for _ in $(seq 1 90); do
    if nginx_exec curl -fsS -o /dev/null --max-time 3 "$url" 2>/dev/null; then
      log "$svc is ready"
      return 0
    fi
    sleep 2
  done
  die "$svc did not become ready ($url); see: make logs-$JV_ENV s=$svc"
}

# psql_super SQL: run SQL as the Postgres superuser (backup points before migrations).
psql_super() {
  if running postgres; then
    dc exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d "$(envget DB_NAME jobvacancy)" -XAtqc "$1"
  else
    # The password travels in the environment, not on the command line (ps, docker inspect).
    PGPASSWORD="$(envget POSTGRES_SUPERUSER_PASSWORD)" docker run --rm \
      --network "$(envget COMPOSE_PROJECT_NAME jobvacancy)_back" -e PGPASSWORD "$(pg_image)" \
      psql -v ON_ERROR_STOP=1 -h "$(envget DB_HOST postgres)" -p "$(envget DB_PORT 5432)" -U postgres \
      -d "$(envget DB_NAME jobvacancy)" -XAtqc "$1"
  fi
}

pg_image() { printf '%s-postgres:%s' "$(envget IMAGE_PREFIX ghcr.io/setdarovdev/jobvacancy)" "${POSTGRES_TAG:-latest}"; }

# Refuse a production env file that still has placeholders from the example.
check_env_file() {
  local left
  left=$(grep -nE '^[A-Z0-9_]+=change-me([[:space:]]|$)' "$ENV_FILE" | cut -d: -f1 | tr '\n' ' ' || true)
  [ -z "$left" ] || die "$ENV_FILE still has change-me placeholders on lines: $left"
  if [ "$(stat -c %a "$ENV_FILE")" != 600 ]; then warn "$ENV_FILE should be chmod 600"; fi
  dc config -q || die "docker compose config failed for $ENV_FILE"
}
