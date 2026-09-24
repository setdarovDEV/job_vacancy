#!/usr/bin/env bash
# Static checks of the monitoring stack (TZ OPS-04), run by CI (deploy.yml infra-lint) and
# by `make monitoring-lint`:
#   compose config (production + staging), promtool check config/rules + rule unit tests,
#   amtool check-config on the rendered Alertmanager template, blackbox and sql_exporter
#   config checks, dashboards JSON = generator output.
# Tools come from PATH when present (promtool, amtool, blackbox_exporter, sql_exporter),
# otherwise from the pinned images in monitoring/docker-compose.monitoring.yml (Docker).
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
MON=$ROOT/monitoring
cd "$ROOT"
ok() { printf '  \033[32mok\033[0m %s\n' "$*"; }

image_of() { # image_of <service>: the pinned image of a monitoring service
  awk -v svc="  $1:" '$0 == svc {f=1; next} f && /^    image:/ {print $2; exit}' "$MON/docker-compose.monitoring.yml"
}
# tool <binary> <service> <args...>: run a binary locally or inside the service's image.
tool() {
  local bin=$1 svc=$2
  shift 2
  if command -v "$bin" >/dev/null 2>&1; then
    (cd "$MON" && "$bin" "$@")
  else
    docker run --rm -v "$MON:/m:ro" -w /m --entrypoint "$bin" "$(image_of "$svc")" "$@"
  fi
}

echo "compose"
APP_PROJECT=jobvacancy docker compose -p jobvacancy-monitoring --env-file .env.production.example \
  -f monitoring/docker-compose.monitoring.yml config -q
APP_PROJECT=jobvacancy-staging docker compose -p jobvacancy-staging-monitoring --env-file .env.staging.example \
  -f monitoring/docker-compose.monitoring.yml config -q
ok "monitoring/docker-compose.monitoring.yml (production, staging)"

echo "prometheus"
tool promtool prometheus check config --syntax-only prometheus/prometheus.yml >/dev/null
tool promtool prometheus check rules prometheus/rules/recording.yml prometheus/rules/alerts.yml >/dev/null
ok "config and rules"
tool promtool prometheus test rules prometheus/tests/alerts.test.yml >/dev/null
ok "alert unit tests (prometheus/tests)"

echo "alertmanager"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/templates"
cp "$MON/alertmanager/templates/"*.tmpl "$tmp/templates/"
sed -e 's#@DEFAULT_RECEIVER@#telegram#; s#@WATCHDOG_RECEIVER@#watchdog#; s#@TELEGRAM_API_URL@#https://api.telegram.org#' \
    -e "s#@TELEGRAM_THREAD_ID@#7#" \
    -e 's#/tmp/alertmanager/#/m/#g; s#/etc/alertmanager/templates#/m/templates#' \
    "$MON/alertmanager/alertmanager.yml" >"$tmp/alertmanager.yml"
printf x >"$tmp/telegram_token"
printf -- -1001234567890 >"$tmp/telegram_chat_id"
printf 'https://hc-ping.com/x' >"$tmp/watchdog_url"
if command -v amtool >/dev/null 2>&1; then
  sed -i "s#/m/#$tmp/#g" "$tmp/alertmanager.yml"
  amtool check-config "$tmp/alertmanager.yml" >/dev/null
else
  docker run --rm -v "$tmp:/m:ro" --entrypoint amtool "$(image_of alertmanager)" check-config /m/alertmanager.yml >/dev/null
fi
ok "rendered alertmanager.yml + telegram template"

echo "exporters"
tool blackbox_exporter blackbox-exporter --config.check --config.file=blackbox/blackbox.yml >/dev/null 2>&1
ok "blackbox.yml"
if command -v sql_exporter >/dev/null 2>&1; then
  (cd "$MON/sql-exporter" && sql_exporter -config.check -config.file=sql_exporter.yml >/dev/null 2>&1)
else
  docker run --rm -v "$MON/sql-exporter:/etc/sql_exporter:ro" -w /etc/sql_exporter "$(image_of sql-exporter)" \
    -config.check -config.file=/etc/sql_exporter/sql_exporter.yml >/dev/null 2>&1
fi
ok "sql_exporter.yml + collectors"

echo "grafana"
python3 "$MON/grafana/generate-dashboards.py" "$tmp/dashboards" >/dev/null
for f in "$MON"/grafana/dashboards/*.json; do
  python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); assert d["uid"] and d["panels"]' "$f"
  cmp -s "$f" "$tmp/dashboards/$(basename "$f")" \
    || { echo "  $f differs from generate-dashboards.py output: run python3 monitoring/grafana/generate-dashboards.py" >&2; exit 1; }
done
ok "dashboards match monitoring/grafana/generate-dashboards.py"
sh -n "$MON/prometheus/entrypoint.sh" "$MON/alertmanager/entrypoint.sh"
ok "entrypoints parse"
echo "monitoring lint passed"
