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
