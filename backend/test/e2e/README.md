# End-to-end smoke tests

Bash + curl + jq scripts that drive a running stack through real user flows.

```bash
make up && make -C backend migrate
make -C backend build
./bin/api > /tmp/api.log 2>&1 &   # LOG_LEVEL=debug, no TELEGRAM_GATEWAY_TOKEN
./bin/worker > /tmp/worker.log 2>&1 &

API_LOG=/tmp/api.log test/e2e/auth.sh            # 50 checks (waits for the auth rate-limit window if needed)
test/e2e/companies_vacancies.sh                  # 96 checks (needs bin/ctl, waits ~1 min for view flush)
test/e2e/search.sh                               # 49 checks (needs bin/ctl)
test/e2e/resumes_applications.sh                 # 75 checks (needs bin/ctl; PDF checks need pdftotext)
API_LOG=/tmp/api.log WORKER_LOG=/tmp/worker.log test/e2e/notifications.sh  # 26 checks
go build -o bin/wsclient ./test/e2e/wsclient
WORKER_LOG=/tmp/worker.log test/e2e/chat.sh      # 44 checks (WebSocket)
test/e2e/saved_searches.sh                       # 17 checks (needs bin/ctl, uses psql)
```

The auth endpoints are rate-limited per IP (30/min), so leave about a minute between
suites when running them back to back.

The phone check reads the dev verification code from the API log, and e-mail codes are read
from Mailpit (http://localhost:8025).

View counting skips bots and non-browser clients by User-Agent, so scripts that expect a
view to count send a browser `-A` string. Cache checks read the `X-Cache` and `ETag`
headers; nothing here needs Docker. search.sh expects the popular list to count a query
from one IP (`SEARCH_POPULAR_MIN_IPS=1` in the dev `.env`); against an API with the
production default of 3, run it with `POPULAR_MIN_IPS=3`.
