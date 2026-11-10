#!/usr/bin/env bash
# Deploys one image tag of jobvacancy on the shared host, touching only its own services.
#
#   scripts/deploy.sh <image-tag>        # usually the commit SHA, run by .github/workflows/deploy.yml
#
# Steps: pull the images, run migrations, restart api/worker/web, check health. If the new
# version doesn't come up healthy, the previous tag is started again and the script fails.
# Never starts the nginx/certbot/monitoring services of the prod compose file: on this host
# Caddy owns ports 80/443 and other projects run alongside.
set -euo pipefail

TAG=${1:?usage: deploy.sh <image-tag>}
ROOT=${PROJECT_DIR:-/opt/jobvacancy}
TAG_FILE=$ROOT/deploy/.image-tag
SERVICES=(api worker web)

cd "$ROOT"
compose() {
  IMAGE_TAG=$1 docker compose -p jobvacancy \
    -f nginx/docker-compose.prod.yml -f deploy/docker-compose.server.yml "${@:2}"
}

healthy() {
  for _ in $(seq 1 30); do
    if curl -fs -o /dev/null http://127.0.0.1:8090/readyz && curl -fs -o /dev/null http://127.0.0.1:3000/; then
      return 0
    fi
    sleep 2
  done
  return 1
}

PREV=$(cat "$TAG_FILE" 2>/dev/null || true)
echo "Deploying $TAG (previous: ${PREV:-none})"

compose "$TAG" pull --policy missing migrate "${SERVICES[@]}"
compose "$TAG" run --rm migrate
compose "$TAG" up -d --no-deps "${SERVICES[@]}"

if healthy; then
  echo "$TAG" > "$TAG_FILE"
  echo "Healthy. Deploy of $TAG complete."
else
  echo "New version is not healthy." >&2
  compose "$TAG" logs --tail 50 "${SERVICES[@]}" >&2 || true
  if [ -n "$PREV" ]; then
    echo "Rolling back to $PREV" >&2
    compose "$PREV" up -d --no-deps "${SERVICES[@]}"
    healthy && echo "Rolled back to $PREV." >&2
  fi
  exit 1
fi

# Keep the three newest tags of our own images; other projects' images are left alone.
for repo in ghcr.io/setdarovdev/jobvacancy-api ghcr.io/setdarovdev/jobvacancy-web; do
  docker image ls "$repo" --format '{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' \
    | sort -r | tail -n +4 | cut -f2 | xargs -r docker image rm >/dev/null 2>&1 || true
done
