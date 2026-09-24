---
name: fast-backend
description: Performance and production rules for the jobvacancy.uz Go backend (chi, pgx+sqlc, Postgres 18, Redis, River). Use for ANY change in backend/ — handlers, services, SQL queries, migrations, caching, jobs, realtime — to keep p95 < 50 ms and production-safe.
---

# Fast backend — jobvacancy.uz

Stack: Go 1.27, chi, pgx v5 + sqlc (`db/queries/*.sql` → `db/gen`), dynamic SQL via `internal/pkg/sqlb`,
Postgres 18 (uuidv7 ids), Redis (cache, rate limit, OTP, pub/sub, presence), River (jobs, in Postgres),
MinIO, coder/websocket hub, Prometheus. Modular monolith: `internal/modules/<m>/{handler,service,…}.go`.
Targets (docs/PLAN.md §6): read p95 < 50 ms, cached < 10 ms; the TZ adds write p95 < 150 ms and
k6 thresholds.

## Non-negotiables

1. **No N+1.** A list endpoint does a constant number of queries regardless of page size. Fetch
   related rows for the whole page with `= ANY($1)` and join in Go (see `vacancy/cards.go`).
2. **Every query has an index plan.** When adding/changing SQL, write the `EXPLAIN (ANALYZE,
   BUFFERS)` expectation in the PR/commit notes; filters + ORDER BY must be served by an index
   (partial `WHERE status='published'` style like migrations 00004/00005). FKs used in joins or
   ON DELETE get an index.
3. **Keyset pagination only** (`internal/pkg/cursor`), never OFFSET on user-facing lists
   (the company directory is the last OFFSET — TZ BE-03 removes it).
4. **Deadlines everywhere.** Requests run under a context timeout (default 8s; WS/PDF/upload
   exceptions), Postgres `statement_timeout` 5s, `lock_timeout` 3s and
   `idle_in_transaction_session_timeout` 10s via `RuntimeParams` on the **API and worker pools
   only** (`migrate`/`ctl` share `postgres.NewPool` and must run without them), Redis calls with short timeouts. Never `context.Background()` inside
   a request path — except loaders shared by singleflight, which use a detached context with its
   own timeout (never the first caller's request context).
5. **Cache the bytes, not the structs.** Hot public reads (vacancy list, vacancy detail, company,
   suggest, catalog) cache the final JSON (optionally pre-gzipped) with ETag; handlers answer
   `If-None-Match` with 304. TTL + jitter, singleflight + stale-while-revalidate, explicit
   invalidation on writes (publish/update/archive/expire/verify).
6. **Batch writes & round trips.** Multi-row inserts with `unnest`/`CopyFrom`; pipeline Redis
   (`Pipelined`) when touching several keys; one Lua script for rate-limit + revocation checks.
7. **Async side effects through River, transactionally.** Notifications/emails/alerts are enqueued
   with `InsertTx`/`InsertManyTx` in the same transaction as the business change (outbox
   semantics). Only enqueue channels the user actually has (telegram linked, devices, email on).
8. **Bounded memory.** No unbounded maps/caches (use an LRU with TTL, e.g.
   `hashicorp/golang-lru/v2/expirable`), bounded worker concurrency, cap request bodies
   (`http.MaxBytesReader`), cap argon2 concurrency with a semaphore.
9. **Observable.** New endpoints appear in Prometheus by route pattern automatically; add metrics
   for new caches (hit/miss), queues, pools. Log with `slog` + request id; never log secrets,
   tokens, codes, full phone/email in production (mask).
10. **Contract first.** Change `api/openapi.yaml` with the handler, then `make api-types` for web
    (CI fails on drift). Errors: `{"error":{"code","message","fields"}}`, codes are translated by
    clients — add new codes to web `apiErrors.*` in 4 locales.
11. **Migrations are safe for a live DB.** Additive first; large-table indexes with
    `CREATE INDEX CONCURRENTLY` in a `-- +goose NO TRANSACTION` migration; backfills in batches
    via River or `ctl`; never rewrite a big table in one transaction. CI's up/down/up must pass.
12. **Tests with the change.** Service-level tests against a real Postgres (testcontainers or the
    CI service), including authorization (who can see/edit what) and the query count for list
    endpoints.

## Workflow

1. Read the module (`handler.go`, `service.go`, queries) and the related migration.
2. For SQL: write the query in `db/queries/*.sql`, `make -C backend sqlc`, check the plan on
   seeded data (`backend/test/e2e/seed_demo.sh`, or `ctl` generator for 100k vacancies).
3. Implement with deadlines, batching, caching rules above.
4. `make -C backend test`, `go vet ./...`, e2e script for the module
   (`backend/test/e2e/*.sh`), and for hot paths a k6 run (`k6/` scenarios from the TZ).
5. Report numbers: before/after p95 and query counts.

## Known hotspots (from the 2026-09-24 audit — fix via TZ BE tasks)

- `chat/list.go` participants() per row → N+1; `chat/service.go` participants cache unbounded.
- `db/queries/chat.sql` ListConversations/CountUnread: `seeker_id = $1 OR company_id IN (…)`
  defeats indexes → UNION ALL + denormalized unread counters.
- `db/queries/companies.sql` ListCompaniesDirectory: per-row COUNT + OFFSET → counter column +
  keyset.
- `vacancy/handler.go` list cache loader captures the first request ctx; cache stores structs.
- Vacancy detail has no cache/ETag; 3–4 queries per view.
- No gzip/brotli (nginx config missing), no statement_timeout, pool 25 for API and worker (River
  runs up to 70 workers).
- `HTTP_TRUST_PROXY=false` behind nginx collapses all clients into one IP for rate limits.
- Missing indexes: `applications(resume_id)`, `messages(file_id)`, `saved_vacancies(vacancy_id)`,
  `vacancies(company_id, published_at DESC, id DESC) WHERE published`, `vacancies(district_id, …)`,
  `applications(vacancy_id, created_at DESC, id DESC)`, `conversation_reads(user_id)`,
  `conversations(vacancy_id)`.
- `set_updated_at` trigger fires on view/application counter updates.
- Notification fan-out enqueues a job per channel (telegram, push, and email except for chat
  messages) per user regardless of whether the user has that channel; not transactional.
