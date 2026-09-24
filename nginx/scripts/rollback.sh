#!/usr/bin/env bash
# One-command rollback (TZ OPS-06): redeploy the previous release's images the same rolling
# way, without migrations (they are additive: the previous code runs on the new schema).
#   nginx/scripts/rollback.sh production     # make rollback
# A migration that must itself be undone: make restore NAME=<restore point printed by deploy>.
. "$(dirname "$0")/lib.sh"
jv_env "${1:?usage: rollback.sh production|staging}"
prev=$(cat "$STATE_DIR/previous" 2>/dev/null) || die "no previous release recorded in $STATE_DIR"
eval "export $prev"   # IMAGE_TAG=… NGINX_TAG=… POSTGRES_TAG=…
log "rolling back $JV_ENV to $prev"
# image-tags.sh would recompute NGINX_TAG from the working tree; pin the recorded one.
NGINX_TAG_PIN=$NGINX_TAG POSTGRES_TAG_PIN=$POSTGRES_TAG \
  SKIP_MIGRATE=1 SKIP_BACKUP_POINT=1 exec "$NGX/scripts/deploy.sh" "$JV_ENV" "$IMAGE_TAG"
