#!/usr/bin/env bash
# First Let's Encrypt certificate (TZ OPS-02). Renewal is automatic afterwards (certbot
# service renews twice a day, nginx reloads every 6 h).
#   nginx/scripts/cert.sh production|staging      # make cert / make cert-staging
# DNS-01 through Cloudflare when CLOUDFLARE_API_TOKEN is set (works behind the orange cloud
# and before DNS points here), otherwise HTTP-01 on port 80.
. "$(dirname "$0")/lib.sh"
jv_env "${1:?usage: cert.sh production|staging}"
eval "$("$NGX/scripts/image-tags.sh")"
export NGINX_TAG POSTGRES_TAG
domain=$(envget DOMAIN)
email=$(envget LETSENCRYPT_EMAIL)
[ -n "$email" ] || die "set LETSENCRYPT_EMAIL in $ENV_FILE"
domains=(-d "$domain")
[ "$JV_ENV" = production ] && domains+=(-d "www.$domain")
common=(certonly --non-interactive --agree-tos --email "$email" --cert-name jobvacancy --key-type ecdsa
        --deploy-hook 'touch /etc/letsencrypt/.renewed' "${domains[@]}")
[ "${LE_STAGING:-0}" = 1 ] && common+=(--test-cert)   # Let's Encrypt staging CA, for dry runs

running nginx || dc up -d --no-deps --wait nginx
token=$(envget CLOUDFLARE_API_TOKEN)
if [ -n "$token" ]; then
  log "DNS-01 via Cloudflare for ${domains[*]}"
  printf 'dns_cloudflare_api_token = %s\n' "$token" | dc run --rm -T --no-deps --entrypoint sh certbot \
    -c 'umask 077; mkdir -p /etc/letsencrypt/.secrets; cat > /etc/letsencrypt/.secrets/cloudflare.ini'
  dc run --rm --no-deps --entrypoint certbot certbot "${common[@]}" --dns-cloudflare \
    --dns-cloudflare-credentials /etc/letsencrypt/.secrets/cloudflare.ini --dns-cloudflare-propagation-seconds 30
else
  log "HTTP-01 on port 80 for ${domains[*]} (DNS must already point at this server)"
  dc run --rm --no-deps --entrypoint certbot certbot "${common[@]}" --webroot -w /var/www/certbot
fi
nginx_exec jv-reload
log "certificate installed; check: curl -vI https://$domain 2>&1 | grep -E 'subject|expire'"
