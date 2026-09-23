# Monorepo tasks. Run `make help` for the list.
COMPOSE_DEV := docker compose -f nginx/docker-compose.dev.yml

.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

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

.PHONY: help up down reset logs setup api worker web web-install api-types test psql
