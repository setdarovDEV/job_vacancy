# Production Deploy

This folder contains the production Docker Compose stack, nginx configuration and helper scripts.

## What's included

- `docker-compose.prod.yml` — Postgres, Redis, MinIO, Go API, background worker, React Router web app, nginx, certbot, Prometheus, Grafana, node-exporter and volume backups.
- `nginx.conf` — reverse proxy with SSL, WebSocket support and rate-limit zones.
- `.env.example` — all required environment variables.
- `../scripts/init-ssl.sh` — request the first Let's Encrypt certificate.
- `../scripts/deploy.sh` — remote deploy script used by CI/CD.

## Initial setup on a VPS

1. Install Docker Engine + Compose plugin.
2. Clone the repo to `/opt/jobvacancy` and `cd /opt/jobvacancy`.
3. Copy and fill the environment file:
   ```bash
   cp nginx/.env.example nginx/.env
   # edit nginx/.env with real secrets
   ```
4. Request the first certificate:
   ```bash
   ./scripts/init-ssl.sh jobvacancy.uz admin@jobvacancy.uz
   ```
5. Start everything:
   ```bash
   docker compose -f nginx/docker-compose.prod.yml up -d
   ```
6. Create the MinIO buckets once:
   ```bash
   docker compose -f nginx/docker-compose.prod.yml exec minio mc mb local/jv-public local/jv-private
   ```

## CI/CD

GitHub Actions workflows live in `.github/workflows/`:

- `backend.yml` — run tests/vet, build and push the API image.
- `web.yml` — typecheck/build, build and push the web image.
- `mobile.yml` — analyze, test and build the Android APK.
- `deploy.yml` — SSH into the VPS and run `scripts/deploy.sh` after backend/web builds succeed.

Required GitHub secrets for deploy:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`

## Monitoring

- Prometheus: `http://<vps-ip>:9090` (expose through VPN/SSH tunnel in production).
- Grafana: `http://<vps-ip>:3000`, default admin password from `GRAFANA_ADMIN_PASSWORD`.
- API metrics are scraped from `api:9091`.

## Backups

The `backup` service uses `docker-volume-backup` to upload `pgdata`, `miniodata` and `redisdata` snapshots to any S3-compatible store daily at 03:00. Configure `BACKUP_S3_*` variables in `.env`.

## Shared host (2.29.150.64) operations

The production host also runs other projects. Its Caddy owns ports 80/443; jobvacancy only
touches its own containers, `/etc/caddy/jobvacancy-uz.caddy` and `/srv/jobvacancy-maintenance`.

| Task | Command (as root on the host) |
|---|---|
| Deploy | automatic on push to `main` (`.github/workflows/deploy.yml` → `scripts/deploy.sh`) |
| Caddy site + maintenance page | `bash /opt/jobvacancy/deploy/caddy/install.sh` (validates, then graceful reload) |
| Planned maintenance | `bash /opt/jobvacancy/deploy/caddy/maintenance.sh on` / `off` |
| Backup now | `systemctl start jobvacancy-backup.service` (nightly at 03:30 Tashkent) |
| Prove a backup restores | `bash /opt/jobvacancy/deploy/backup/restore-test.sh` (throwaway container, compares row counts) |
| Demo data | `ctl seed-demo` / `ctl purge-demo` (see backend/test/e2e/README.md) |

Backups live in `/var/backups/jobvacancy/<UTC stamp>/` (14 days): `db.dump` (pg_dump -Fc),
`globals.sql`, file-store volume archives and `SHA256SUMS`. To copy them off the host, put
`OFFSITE_CMD=...` in `/etc/jobvacancy-backup.env` (it gets the run directory as `$1`).
Restore for real: stop api/worker, `pg_restore --clean --if-exists -d <db> db.dump` inside the
postgres container, start them again.

While the site holds demo data, `SITE_NOINDEX=1` in `nginx/.env` keeps it out of search engines;
remove it (and run `ctl purge-demo`) for the real launch.
