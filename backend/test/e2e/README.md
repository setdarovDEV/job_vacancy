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
```

The auth endpoints are rate-limited per IP (30/min), so leave about a minute between
suites when running them back to back.

The phone check reads the dev verification code from the API log, and e-mail codes are read
from Mailpit (http://localhost:8025).
