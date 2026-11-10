#!/usr/bin/env bash
# Installs jobvacancy's Caddy site and maintenance page on the shared host, validating the whole
# Caddyfile before a graceful reload (other sites keep serving). Run as root from the repo copy
# on the server: bash /opt/jobvacancy/deploy/caddy/install.sh
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
SITE=/etc/caddy/jobvacancy-uz.caddy

install -d -m 755 /srv/jobvacancy-maintenance
install -m 644 "$HERE/../maintenance/index.html" /srv/jobvacancy-maintenance/index.html

cp -p "$SITE" "$SITE.bak.$(date +%Y%m%d%H%M%S)"
install -m 644 "$HERE/jobvacancy-uz.caddy" "$SITE"
if ! caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  echo "Caddyfile invalid; restoring the previous site file" >&2
  cp -p "$(ls -1t "$SITE".bak.* | head -1)" "$SITE"
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  exit 1
fi
systemctl reload caddy
echo "installed and reloaded"
