# End-to-end smoke tests

Bash + curl + jq scripts that drive a running stack through real user flows.

```bash
make up && make -C backend migrate
make -C backend build
./bin/api > /tmp/api.log 2>&1 &   # LOG_LEVEL=debug, no TELEGRAM_GATEWAY_TOKEN
./bin/worker > /tmp/worker.log 2>&1 &

API_LOG=/tmp/api.log test/e2e/auth.sh            # 53 checks (waits for the auth rate-limit window if needed)
test/e2e/companies_vacancies.sh                  # 100 checks (needs bin/ctl, waits ~1 min for view flush)
test/e2e/search.sh                               # 49 checks (needs bin/ctl)
test/e2e/resumes_applications.sh                 # 75 checks (needs bin/ctl; PDF checks need pdftotext)
API_LOG=/tmp/api.log WORKER_LOG=/tmp/worker.log test/e2e/notifications.sh  # 26 checks (needs bin/ctl)
go build -o bin/wsclient ./test/e2e/wsclient
WORKER_LOG=/tmp/worker.log test/e2e/chat.sh      # 50 checks (WebSocket, presence privacy — TZ SEC-05)
test/e2e/saved_searches.sh                       # 17 checks (needs bin/ctl, uses psql)
test/e2e/mvp_features.sh                         # 83 checks (needs bin/ctl, psql, redis-cli; TZ FN-01…FN-06)
```

mvp_features.sh covers the admin panel API (403 for non-admins, blocking users and companies
— including how long a blocked company's vacancies stay listed —, skill merge, "TOP",
stats, audit log), vacancy reports, republishing and expiry notices (it runs
`ctl vacancy-lifecycle` instead of waiting for the worker's periodic jobs), company invites
(the invite e-mail is read from Mailpit), account deletion and the SOATO districts
(`ctl import-districts` must have run). Registration payloads send `"consent": true`
(TZ FN-08).

The auth endpoints are rate-limited per IP (30/min), so leave about a minute between
suites when running them back to back.

The phone check reads the dev verification code from the API log, and e-mail codes are read
from Mailpit (http://localhost:8025).

View counting skips bots and non-browser clients by User-Agent, so scripts that expect a
view to count send a browser `-A` string. Cache checks read the `X-Cache` and `ETag`
headers; nothing here needs Docker. search.sh expects the popular list to count a query
from one IP (`SEARCH_POPULAR_MIN_IPS=1` in the dev `.env`); against an API with the
production default of 3, run it with `POPULAR_MIN_IPS=3`.
