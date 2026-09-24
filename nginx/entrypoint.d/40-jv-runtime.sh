#!/bin/sh
# Runs before nginx starts (official image entrypoint hook).
#  - TLS: Let's Encrypt certificate or a self-signed placeholder (bin/jv-tls).
#  - Staging basic auth: STAGING_BASIC_AUTH holds htpasswd lines ("user:$apr1$..."); when
#    set, every request to the site needs them (conf.d/jobvacancy.conf includes auth*.conf).
set -eu
jv-tls
mkdir -p /etc/nginx/runtime
if [ -n "${STAGING_BASIC_AUTH:-}" ]; then
  printf '%s\n' "$STAGING_BASIC_AUTH" | tr ' ' '\n' >/etc/nginx/runtime/staging.htpasswd
  chown root:nginx /etc/nginx/runtime/staging.htpasswd
  chmod 640 /etc/nginx/runtime/staging.htpasswd
  printf 'auth_basic "jobvacancy staging";\nauth_basic_user_file /etc/nginx/runtime/staging.htpasswd;\n' \
    >/etc/nginx/runtime/auth.conf
  echo "jv-runtime: staging basic auth enabled"
else
  rm -f /etc/nginx/runtime/auth.conf /etc/nginx/runtime/staging.htpasswd
fi
