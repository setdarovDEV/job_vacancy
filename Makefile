# Monorepo tasks. Run `make help` for the list.
COMPOSE_DEV := docker compose -f nginx/docker-compose.dev.yml

.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-17s\033[0m %s\n", $$1, $$2}'

up: ## Start local infrastructure (Postgres, Redis, MinIO, Mailpit)
	$(COMPOSE_DEV) up -d --wait

down: ## Stop local infrastructure (data is kept)
	$(COMPOSE_DEV) down

reset: ## Stop infrastructure AND delete all local data
	$(COMPOSE_DEV) down -v

logs: ## Follow infrastructure logs
	$(COMPOSE_DEV) logs -f

setup: up ## First-time setup: infra + .env + migrations + web deps
	@test -f backend/.env || cp backend/.env.example backend/.env
	$(MAKE) -C backend migrate
	cd web && pnpm install

api: ## Run the Go API on :8090
	$(MAKE) -C backend run

worker: ## Run the background worker
	$(MAKE) -C backend worker

web: ## Run the web app on :5180 (SSR, proxies /api to :8090)
	cd web && pnpm dev

web-install: ## Install web dependencies
	cd web && pnpm install

api-types: ## Regenerate web API types from backend/api/openapi.yaml
	cd web && pnpm api:types

test: ## Run all tests
	$(MAKE) -C backend test
	cd web && pnpm typecheck

psql: ## Open a psql shell to the dev database
	$(COMPOSE_DEV) exec postgres psql -U jobvacancy -d jobvacancy

# ---- deploy (TZ OPS-01..03, OPS-08; docs/RUNBOOK.md) --------------------------------------
# Run on the server from the repo checkout (/opt/jobvacancy). TAG = image tag built by CI
# (git sha or version); BUILD=1 builds the images on the server instead of pulling them.
PROD    := docker compose --env-file .env.production -f nginx/docker-compose.prod.yml
STAGING := docker compose --env-file .env.staging -f nginx/docker-compose.prod.yml -f nginx/docker-compose.staging.yml
TAGS     = $(shell nginx/scripts/image-tags.sh | tr '\n' ' ')

deploy: ## Production: pull, backup point, migrate, rolling restart (TAG=..., BUILD=1)
	nginx/scripts/deploy.sh production $(TAG)

deploy-staging: ## Staging: same as deploy, on staging.jobvacancy.uz
	nginx/scripts/deploy.sh staging $(TAG)

rollback: ## Production: back to the previous release (no migrations)
	nginx/scripts/rollback.sh production

rollback-staging: ## Staging: back to the previous release
	nginx/scripts/rollback.sh staging

backup: ## Production: full wal-g backup to offsite S3 now
	$(TAGS) $(PROD) exec -T pg-backup walg-backup-now

backup-status: ## Production: newest backup and its age, WAL archiver stats
	$(TAGS) $(PROD) exec -T pg-backup walg-status
	$(TAGS) $(PROD) exec -T postgres psql -U postgres -XAtc "select 'archived=' || archived_count || ' failed=' || failed_count || ' last=' || coalesce(last_archived_wal, '-') || ' lag=' || coalesce((now() - last_archived_time)::text, '-') from pg_stat_archiver"

restore: ## Production PITR into a new volume: make restore [TIME="2026-09-24 14:05+05" | NAME=<restore point>]
	nginx/scripts/restore.sh production $(if $(TIME),--time "$(TIME)") $(if $(NAME),--name "$(NAME)")

staging-refresh: ## Staging: restore production's backup, anonymize (= monthly restore drill)
	nginx/scripts/staging-refresh.sh $(if $(TIME),--time "$(TIME)")

cert: ## Production: issue the Let's Encrypt certificate (renewal is automatic)
	nginx/scripts/cert.sh production

cert-staging: ## Staging: issue the Let's Encrypt certificate
	nginx/scripts/cert.sh staging

ctl: ## Production: run ctl, e.g. make ctl ARGS="telegram-webhook https://jobvacancy.uz/api/v1/telegram/webhook"
	$(TAGS) $(PROD) run --rm ctl $(ARGS)

ps-prod: ## Production: container status and health
	$(TAGS) $(PROD) ps

logs-production: ## Production: follow logs (s=api-1 for one service)
	$(TAGS) $(PROD) logs -f --tail=200 $(s)

logs-staging: ## Staging: follow logs (s=api-1 for one service)
	$(TAGS) $(STAGING) logs -f --tail=200 $(s)

prod-config: ## Validate every compose file with the example env files (no Docker daemon needed)
	docker compose --env-file .env.production.example -f nginx/docker-compose.prod.yml config -q
	APP_PROJECT=jobvacancy docker compose -p jobvacancy-monitoring --env-file .env.production.example -f monitoring/docker-compose.monitoring.yml config -q
	docker compose -f e2e/docker-compose.e2e.yml config -q
	COMPOSE_PROFILES=db,backup,tools,restore docker compose --env-file .env.production.example -f nginx/docker-compose.prod.yml config -q
	docker compose --env-file .env.staging.example -f nginx/docker-compose.prod.yml -f nginx/docker-compose.staging.yml config -q
	docker compose -f nginx/docker-compose.dev.yml config -q
	@echo "compose files OK"

nginx-test: ## Build the nginx image and run nginx -t in it (needs Docker)
	docker build -q -t jobvacancy-nginx:test nginx
	docker run --rm --add-host api-1:127.0.0.1 --add-host api-2:127.0.0.1 --add-host web-1:127.0.0.1 \
	  --add-host web-2:127.0.0.1 --add-host minio:127.0.0.1 --entrypoint sh jobvacancy-nginx:test -c 'jv-tls >/dev/null && nginx -t'

# ---- monitoring, error tracking (TZ OPS-04/05; docs/RUNBOOK.md §10) ------------------------
MONITOR := nginx/scripts/monitoring.sh

monitoring-up: ## Production: Prometheus, Alertmanager→Telegram, Grafana, exporters, GlitchTip
	$(MONITOR) production up

monitoring-up-staging: ## Staging: the same monitoring stack
	$(MONITOR) staging up

monitoring-ps: ## Production: monitoring containers and health
	$(MONITOR) production ps

monitoring-logs: ## Production: monitoring logs (s=prometheus for one service)
	$(MONITOR) production logs -f --tail=200 $(s)

monitoring-reload: ## Production: re-read Prometheus rules and the Alertmanager config
	$(MONITOR) production reload

alert-drill: ## Production: synthetic critical alert → Telegram, timed (routing check)
	$(MONITOR) production drill

alert-drill-api: ## Production: drain + stop api-2, time ApiInstanceDown (≤ 2 min), restore
	$(MONITOR) production drill-api

glitchtip-admin: ## Production: create the first GlitchTip user (interactive)
	$(MONITOR) production glitchtip-admin

monitoring-lint: ## promtool/amtool checks, alert unit tests, dashboards drift (Docker or the binaries)
	nginx/scripts/monitoring-lint.sh

# ---- CI checks you can run locally (TZ SEC-08, QA-02) ---------------------------------------
check-pins: ## Images pinned by digest, GitHub Actions by commit SHA
	nginx/scripts/check-pins.sh

security: ## govulncheck + pnpm audit --prod + gitleaks (tools must be installed)
	cd backend && govulncheck ./...
	cd web && pnpm audit --prod
	gitleaks git --redact --no-banner . && gitleaks dir --redact --no-banner .

E2E := docker compose -f e2e/docker-compose.e2e.yml

e2e-up: ## Whole stack from the production images for browser tests (:8080 site, :8090 API)
	$(E2E) up -d --build --wait --wait-timeout 300

e2e-seed: ## Demo accounts + published vacancies in the e2e stack
	e2e/seed.sh

e2e-a11y: ## axe light/dark × 4 locales + locale smoke (WEB=http://localhost:8080)
	cd e2e && pnpm install --frozen-lockfile && node a11y.mjs

e2e-down: ## Stop the e2e stack and delete its data
	$(E2E) down -v --remove-orphans

.PHONY: help up down reset logs setup api worker web web-install api-types test psql \
	deploy deploy-staging rollback rollback-staging backup backup-status restore staging-refresh \
	cert cert-staging ctl ps-prod logs-production logs-staging prod-config nginx-test \
	monitoring-up monitoring-up-staging monitoring-ps monitoring-logs monitoring-reload alert-drill \
	alert-drill-api glitchtip-admin monitoring-lint check-pins security e2e-up e2e-seed e2e-a11y e2e-down
