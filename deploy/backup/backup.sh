#!/usr/bin/env bash
# Nightly backup of jobvacancy on the shared host: Postgres (pg_dump custom format) and the
# file store volume, kept for $KEEP_DAYS days under $DEST. Installed as a systemd timer by
# install.sh. Touches only jobvacancy's containers and volumes.
#
# Off-site copy: set OFFSITE_CMD in /etc/jobvacancy-backup.env to a command that receives the
# directory of this run as $1 (e.g. an rclone/aws s3 sync); it runs after the local backup.
set -euo pipefail

ROOT=${PROJECT_DIR:-/opt/jobvacancy}
DEST=${BACKUP_DIR:-/var/backups/jobvacancy}
KEEP_DAYS=${KEEP_DAYS:-14}
STAMP=$(date -u +%Y%m%d-%H%M%S)
RUN=$DEST/$STAMP

env_get() { grep -E "^$1=" "$ROOT/nginx/.env" | head -1 | cut -d= -f2-; }
PGUSER=$(env_get POSTGRES_USER); PGDB=$(env_get POSTGRES_DB)

mkdir -p "$RUN"; chmod 700 "$DEST" "$RUN"

# Postgres: consistent snapshot without stopping anything.
docker exec jobvacancy-postgres-1 pg_dump -U "$PGUSER" -d "$PGDB" -Fc -Z 6 > "$RUN/db.dump"
docker exec jobvacancy-postgres-1 pg_dumpall -U "$PGUSER" --globals-only > "$RUN/globals.sql"

# File store (SeaweedFS data + metadata volumes), read-only mounts.
for vol in jobvacancy_miniodata jobvacancy_miniometa; do
  if docker volume inspect "$vol" >/dev/null 2>&1; then
    docker run --rm -v "$vol":/v:ro -v "$RUN":/out alpine:3.22 tar -C /v -czf "/out/$vol.tgz" .
  fi
done

# Integrity: the dump must be readable and list the users table.
# (listed into a variable first: grep -q closing the pipe early would trip pipefail)
TOC=$(docker exec -i jobvacancy-postgres-1 pg_restore --list < "$RUN/db.dump")
grep -q "TABLE DATA public users" <<<"$TOC" || { echo "backup $STAMP: dump looks broken" >&2; exit 1; }

sha256sum "$RUN"/* > "$RUN/SHA256SUMS"
echo "backup $STAMP ok: $(du -sh "$RUN" | cut -f1)"

if [ -n "${OFFSITE_CMD:-}" ]; then
  $OFFSITE_CMD "$RUN"
fi

find "$DEST" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +
