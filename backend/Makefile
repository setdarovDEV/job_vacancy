# Backend tasks. Run `make help` for the list.
SHELL := /bin/bash
SQLC_IMAGE := sqlc/sqlc:latest

.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

run: ## Run the API (http://localhost:8090)
	go run ./cmd/api

worker: ## Run the background job worker
	go run ./cmd/worker

migrate: ## Apply migrations
	go run ./cmd/migrate up

migrate-down: ## Roll back the last migration
	go run ./cmd/migrate down

migrate-status: ## Show migration status
	go run ./cmd/migrate status

migration: ## Create a new migration: make migration name=add_vacancies
	@test -n "$(name)" || (echo "usage: make migration name=<snake_case>"; exit 1)
	@n=$$(ls db/migrations | grep -E '^[0-9]{5}_' | tail -1 | cut -c1-5); \
	next=$$(printf "%05d" $$((10#$${n:-0} + 1))); \
	f=db/migrations/$${next}_$(name).sql; \
	printf -- "-- +goose Up\n\n-- +goose Down\n" > $$f; echo "created $$f"

sqlc: ## Regenerate type-safe query code from db/queries
	docker run --rm -u $$(id -u):$$(id -g) -v "$$PWD":/src -w /src $(SQLC_IMAGE) generate

test: ## Run unit tests
	go test -race ./...

vet: ## Static checks
	go vet ./...

build: ## Build release binaries into bin/
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bin/api ./cmd/api
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bin/worker ./cmd/worker
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bin/migrate ./cmd/migrate
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bin/ctl ./cmd/ctl

.PHONY: help run worker migrate migrate-down migrate-status migration sqlc test vet build set-role reindex

set-role: ## Change a user's role: make set-role email=a@b.uz role=admin
	go run ./cmd/ctl set-role $(email) $(role)

reindex: ## Rebuild the vacancy search index
	go run ./cmd/ctl reindex-search
