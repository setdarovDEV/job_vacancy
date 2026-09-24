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
# The compose file, env defaults and monitoring configs of that release: check out its commit
# (recorded in history by deploy.sh) unless ROLLBACK_KEEP_TREE=1.
commit=$(grep -F " $prev commit=" "$STATE_DIR/history" 2>/dev/null | tail -1 | sed -n 's/.* commit=\([0-9a-f]\{7,40\}\).*/\1/p' || true)
if [ "${ROLLBACK_KEEP_TREE:-0}" != 1 ] && [ -n "$commit" ] && git -C "$ROOT" cat-file -e "$commit^{commit}" 2>/dev/null; then
  log "checking out $commit (the rolled-back release's tree)"
  git -C "$ROOT" checkout --quiet --force "$commit"
  export GIT_COMMIT=$commit
else
  warn "keeping the current checkout (no recorded commit for $IMAGE_TAG, or ROLLBACK_KEEP_TREE=1)"
fi
# image-tags.sh would recompute NGINX_TAG from the working tree; pin the recorded one.
NGINX_TAG_PIN=$NGINX_TAG POSTGRES_TAG_PIN=$POSTGRES_TAG \
  SKIP_MIGRATE=1 SKIP_BACKUP_POINT=1 exec "$NGX/scripts/deploy.sh" "$JV_ENV" "$IMAGE_TAG"
