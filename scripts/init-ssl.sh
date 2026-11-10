#!/usr/bin/env bash
set -euo pipefail

DOMAIN=${1:-jobvacancy.uz}
EMAIL=${2:-admin@jobvacancy.uz}

echo "Requesting initial certificate for $DOMAIN ..."

docker compose -f nginx/docker-compose.prod.yml run --rm \
  -p 80:80 \
  certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d "$DOMAIN" -d "www.$DOMAIN" \
    --agree-tos \
    --no-eff-email \
    -m "$EMAIL" \
    --non-interactive

echo "Reloading nginx ..."
docker compose -f nginx/docker-compose.prod.yml exec nginx nginx -s reload
