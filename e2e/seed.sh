#!/usr/bin/env bash
# Seed the e2e stack (TZ QA-02): the demo accounts of backend/test/e2e/seed_demo.sh
# (seeker@demo.uz, hr@demo.uz, admin@demo.uz; password Secret123), then the admin approves
# every vacancy waiting for moderation so the public pages have content. Idempotent.
#   e2e/seed.sh                # against docker-compose.e2e.yml (API on localhost:8090)
#   DRY_RUN=1 e2e/seed.sh      # list what would be approved, change nothing
set -euo pipefail
cd "$(dirname "$0")/.."
API=${API:-http://localhost:8090/api/v1}
export API
# seed_demo.sh runs "$CTL set-role ..." (word-split on purpose).
export CTL=${CTL:-docker compose -f $PWD/e2e/docker-compose.e2e.yml run --rm -T ctl}
H='Content-Type: application/json'

for _ in $(seq 1 60); do curl -fsS "$API/catalog/regions" >/dev/null 2>&1 && break; sleep 2; done
curl -fsS "$API/catalog/regions" >/dev/null || { echo "API not reachable at $API" >&2; exit 1; }

if [ "${DRY_RUN:-0}" != 1 ]; then
  (cd backend && ./test/e2e/seed_demo.sh)
fi

# Admin token, waiting out the auth rate limit (30/min per IP) if the seed used it up.
login() {
  local out code
  for _ in $(seq 1 12); do
    out=$(curl -s -w '\n%{http_code}' -X POST "$API/auth/login" -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\"}")
    code=${out##*$'\n'}
    [ "$code" != 429 ] && { printf '%s' "${out%$'\n'*}" | jq -r '.data.access_token // empty'; return; }
    sleep 10
  done
}
TA=$(login admin@demo.uz)
[ -n "$TA" ] || { echo "admin@demo.uz cannot sign in" >&2; exit 1; }

ids=$(curl -fsS "$API/admin/vacancies/moderation?limit=50" -H "Authorization: Bearer $TA" | jq -r '.data[].id')
n=0
for id in $ids; do
  if [ "${DRY_RUN:-0}" = 1 ]; then echo "would approve $id"; continue; fi
  curl -fsS -o /dev/null -X POST "$API/admin/vacancies/$id/approve" -H "Authorization: Bearer $TA" -H "$H" -d '{}'
  n=$((n + 1))
done
published=$(curl -fsS "$API/vacancies?limit=1" | jq '.data | length')
echo "e2e seed: approved $n vacancies; public list has content: $([ "$published" -gt 0 ] && echo yes || echo NO)"
[ "${DRY_RUN:-0}" = 1 ] || [ "$published" -gt 0 ]
