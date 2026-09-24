#!/usr/bin/env bash
# Content-addressed tags for the images that must NOT be restarted on every release:
# nginx (a recreate drops live connections) and postgres (a restart is downtime). They only
# change when the files that go into them change. CI and scripts/deploy.sh both use this.
#   eval "$(nginx/scripts/image-tags.sh)"   → NGINX_TAG=n-<hash> POSTGRES_TAG=pg18-<hash>
set -euo pipefail
cd "$(dirname "$0")/.."
hash_of() { find "$@" -type f ! -name '*.swp' -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -c1-12; }
echo "NGINX_TAG=n-$(hash_of Dockerfile .dockerignore nginx.conf conf.d snippets html bin entrypoint.d)"
echo "POSTGRES_TAG=pg18-$(hash_of postgres/Dockerfile postgres/.dockerignore postgres/postgresql.conf postgres/initdb postgres/bin)"
