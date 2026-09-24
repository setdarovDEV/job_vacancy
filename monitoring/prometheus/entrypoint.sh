#!/bin/sh
# Prometheus doesn't expand environment variables in targets: write the env-dependent
# target lists as file_sd JSON (re-read automatically), then start Prometheus.
#   NODE_EXPORTER_EXTRA_TARGETS=10.0.0.3:9100[,host:port...]   other hosts' node_exporter
#   MONITORING_GATEWAY (10.250.30.1)  this host's node_exporter address
#   DOMAIN, JV_ENV                     probe targets and the origin module
set -eu
sd=/prometheus/sd
mkdir -p "$sd"
gw=${MONITORING_GATEWAY:-10.250.30.1}
domain=${DOMAIN:?DOMAIN is not set}
module=origin_${JV_ENV:-production}

write() { # write <file> <json>: atomic, so Prometheus never reads half a file
  printf '%s\n' "$2" >"$sd/.$1.tmp" && mv "$sd/.$1.tmp" "$sd/$1"
}

nodes="{\"targets\":[\"$gw:9100\"],\"labels\":{\"host\":\"app-1\"}}"
i=0
for t in $(printf '%s' "${NODE_EXPORTER_EXTRA_TARGETS:-}" | tr ',' ' '); do
  i=$((i + 1))
  nodes="$nodes,{\"targets\":[\"$t\"],\"labels\":{\"host\":\"db-$i\"}}"
done
write node.json "[$nodes]"

origin=""
for path in / /vacancies /api/v1/catalog/regions "/api/v1/vacancies?limit=1"; do
  origin="$origin${origin:+,}\"https://nginx$path\""
done
write origin.json "[{\"targets\":[$origin],\"labels\":{\"module\":\"$module\"}}]"
write public.json "[{\"targets\":[\"https://$domain/\",\"https://$domain/api/v1/catalog/regions\"],\"labels\":{\"module\":\"public_https\"}}]"

exec /bin/prometheus "$@"
