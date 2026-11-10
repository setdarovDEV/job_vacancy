# End-to-end smoke tests

Bash + curl + jq scripts that drive a running stack through real user flows.

```bash
make up && make -C backend migrate
make -C backend build
./bin/api > /tmp/api.log 2>&1 &   # LOG_LEVEL=debug, no TELEGRAM_GATEWAY_TOKEN
./bin/worker > /tmp/worker.log 2>&1 &

API_LOG=/tmp/api.log test/e2e/auth.sh            # 45 checks
test/e2e/companies_vacancies.sh                  # 76 checks (needs bin/ctl, waits ~1 min for view flush)
test/e2e/search.sh                               # 36 checks (needs bin/ctl)
test/e2e/resumes_applications.sh                 # 75 checks (needs bin/ctl; PDF checks need pdftotext)
API_LOG=/tmp/api.log WORKER_LOG=/tmp/worker.log test/e2e/notifications.sh  # 26 checks
go build -o bin/wsclient ./test/e2e/wsclient
WORKER_LOG=/tmp/worker.log test/e2e/chat.sh      # 44 checks (WebSocket)
test/e2e/saved_searches.sh                       # 14 checks (uses psql)
test/e2e/admin.sh                                # 64 checks (needs bin/ctl): admin stats, companies, users, blocking
test/e2e/reports.sh                              # 49 checks (needs bin/ctl): reports, admin queue, takedown, resolve/dismiss
test/e2e/skills.sh                               # 50 checks (needs bin/ctl and the worker): skill review, rename, merge, aliases, delete, search refresh
test/e2e/stats.sh                                # 31 checks (needs bin/ctl; run alone: exact +1 deltas): daily activity, breakdown, funnel, cache
test/e2e/totp.sh                                 # 59 checks (needs bin/ctl and docker for Redis, ~3 min): 2FA enrollment, per-session verification, re-auth, recovery codes, ctl two-factor
GATE_API=http://localhost:8091/api/v1 test/e2e/totp.sh  # +3: /admin gate, against a second API with ADMIN_2FA_REQUIRED=true HTTP_ADDR=:8091
test/e2e/feedback.sh                             # 26 checks (needs bin/ctl; clear rl:* first): feedback form, admin queue, 5/hour limit
```

The auth endpoints are rate-limited per IP (30/min), so leave about a minute between
suites when running them back to back.

The phone check reads the dev verification code from the API log, and e-mail codes are read
from Mailpit (http://localhost:8025).

Local runs need `ADMIN_2FA_REQUIRED=false` in backend/.env (the suites sign admins in with a
password only) and no `TURNSTILE_SECRET_KEY`. Env vars for launch: docs/LAUNCH.md.

## Demo data (for showing the product)

`ctl seed-demo` fills the database with realistic, backdated demo data: 40 companies (15 verified,
2 blocked), 250 vacancies across all categories and regions (published, expired, archived, drafts,
moderation queue, rejected; some TOP and USD), ~120 job seekers with resumes, 400 applications
with status history, chats, notifications, saved vacancies and searches, 15 reports and a few new
unverified skills for the admin queue. Signups and activity are spread over the last 90 days so
the admin statistics look alive. Randomness is seeded, so every run gives the same data.

| Account | Password | Role |
|---|---|---|
| seeker@demo.uz | Secret123 | job seeker: 2 resumes, applications in every status, chats, saved searches |
| hr@demo.uz | Secret123 | employer, owner of the verified "Demo Texnologiyalari" (every vacancy status, full kanban) |
| admin@demo.uz | Secret123 | platform admin |

Every demo account's email ends with `@demo.uz`. `ctl purge-demo` deletes those users and
everything that hangs off them (their companies with vacancies, applications, chats and reports;
resumes; notifications) plus the demo-only skills, and nothing else. `ctl seed-demo --reset`
purges and seeds again. Both rebuild the vacancy search index and drop the cached listings and
admin statistics.

```bash
./bin/ctl seed-demo            # refuses if demo data already exists
./bin/ctl seed-demo --reset    # replace it
./bin/ctl purge-demo           # remove it

# on the server (the api image ships /app/ctl)
cd /opt/jobvacancy && IMAGE_TAG=$(cat deploy/.image-tag) docker compose -p jobvacancy \
  -f nginx/docker-compose.prod.yml -f deploy/docker-compose.server.yml \
  run --rm --no-deps --entrypoint /app/ctl api seed-demo
```
