#!/bin/sh
# Background loop: reload nginx every NGINX_RELOAD_INTERVAL seconds (default 6 h) so renewed
# Let's Encrypt certificates (certbot service, `certbot renew` twice a day) go live without a
# restart. A broken config is never loaded: jv-reload runs `nginx -t` first.
interval=${NGINX_RELOAD_INTERVAL:-21600}
(
  while sleep "$interval"; do
    jv-reload >/dev/null 2>&1 || echo "jv-reloader: reload skipped (nginx -t failed)" >&2
  done
) &
