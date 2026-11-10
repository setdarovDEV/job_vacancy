#!/usr/bin/env bash
# Feedback ("Fikr bildirish"): anonymous and signed-in submission, validation, the per-IP
# limit (5 per hour), the admin queue with the handled flag, and the overview counter.
# Clear rl:* keys in Redis before running (the limit is per IP and lasts an hour).
set -u
API=${API:-http://localhost:8090/api/v1}
SITE=${SITE:-http://localhost:5180}   # WEB_URL of the API: only links to it are kept
SP=$(mktemp -d); trap "rm -rf $SP" EXIT
CTL=${CTL:-./bin/ctl}
pass=0; fail=0
check() { if [ "$2" == "$3" ]; then echo "  ✔ $1"; pass=$((pass+1)); else echo "  ✘ $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
req() { curl -s -o $SP/body.json -w '%{http_code}' "$@"; }
J() { jq -r "$1" $SP/body.json; }
H='Content-Type: application/json'
reset_limit() { docker exec ${REDIS_CONTAINER:-jobvacancy-dev-redis-1} sh -c "redis-cli --scan --pattern 'rl:*feedback*' | xargs -r redis-cli del" >/dev/null; }
register() { curl -s -X POST $API/auth/register -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\",\"full_name\":\"User $2\",\"role\":\"$2\"}" | jq -r .data.access_token; }

R=$RANDOM
T_S=$(register "fbseek$R@example.com" seeker)
T_A=$(register "fbadm$R@example.com" seeker); $CTL set-role "fbadm$R@example.com" admin >/dev/null
T_A=$(curl -s -X POST $API/auth/login -H "$H" -d "{\"email\":\"fbadm$R@example.com\",\"password\":\"Secret123\"}" | jq -r .data.access_token)
ADMIN="Authorization: Bearer $T_A"
BEFORE=$(curl -s $API/admin/stats -H "$ADMIN" | jq -r .data.feedback.unhandled)

echo "== submit"
check "anonymous" "$(req -X POST $API/feedback -H "$H" -d "{\"category\":\"bug\",\"message\":\"Search breaks $R\",\"contact\":\"me@example.com\",\"page_url\":\"$SITE/vacancies\"}")" 201
ANON=$(J .data.id)
check "link to another site dropped" "$(req -X POST $API/feedback -H "$H" -d "{\"category\":\"other\",\"message\":\"Foreign link $R\",\"page_url\":\"https://evil.example/x\"}")" 201
FOREIGN=$(J .data.id)
check "signed in" "$(req -X POST $API/feedback -H "$H" -H "Authorization: Bearer $T_S" -d "{\"category\":\"idea\",\"message\":\"Dark mode please $R\"}")" 201
MINE=$(J .data.id)
check "unknown category" "$(req -X POST $API/feedback -H "$H" -d '{"category":"spam","message":"hello there"}')" 422
check "  one of" "$(J '.error.fields.category')" "oneof=bug idea other"
check "message short after trimming" "$(req -X POST $API/feedback -H "$H" -d '{"category":"other","message":"   hi      "}')" 422
check "  field" "$(J '.error.fields.message')" "min=5"
reset_limit
check "invalid token: kept as anonymous" "$(req -X POST $API/feedback -H "$H" -H "Authorization: Bearer nope" -d "{\"category\":\"other\",\"message\":\"hello there $R\"}")" 201
BAD=$(J .data.id)

echo "== admin queue"
check "seekers can't list" "$(req $API/admin/feedback -H "Authorization: Bearer $T_S")" 403
check "open list" "$(req "$API/admin/feedback?limit=100" -H "$ADMIN")" 200
check "  anonymous entry" "$(J ".data[] | select(.id==\"$ANON\") | \"\(.category) \(.contact) \(.user) \(.page_url)\"")" "bug me@example.com null $SITE/vacancies"
check "  foreign link stored as null" "$(J ".data[] | select(.id==\"$FOREIGN\") | .page_url")" null
check "  signed-in entry has the user" "$(J ".data[] | select(.id==\"$MINE\") | .user.name")" "User seeker"
check "counter moved" "$(curl -s $API/admin/stats -H "$ADMIN" | jq -r .data.feedback.unhandled)" "$((BEFORE+4))"
check "bad status" "$(req "$API/admin/feedback?status=closed" -H "$ADMIN")" 422
check "mark handled" "$(req -X PUT $API/admin/feedback/$ANON/handled -H "$ADMIN")" 200
check "  handled_at set" "$(J '.data.handled_at != null')" true
check "again is harmless" "$(req -X PUT $API/admin/feedback/$ANON/handled -H "$ADMIN")" 200
check "in the handled list" "$(curl -s "$API/admin/feedback?status=handled&limit=100" -H "$ADMIN" | jq -r "[.data[].id] | index(\"$ANON\") != null")" true
check "not in the open list" "$(curl -s "$API/admin/feedback?limit=100" -H "$ADMIN" | jq -r "[.data[].id] | index(\"$ANON\") == null")" true
check "reopen" "$(req -X DELETE $API/admin/feedback/$ANON/handled -H "$ADMIN")" 200
check "  handled_at cleared" "$(J .data.handled_at)" null
check "unknown id" "$(req -X PUT $API/admin/feedback/00000000-0000-0000-0000-000000000000/handled -H "$ADMIN")" 404
check "malformed id" "$(req -X PUT $API/admin/feedback/xyz/handled -H "$ADMIN")" 404
check "  code" "$(J .error.code)" feedback_not_found
curl -s -X PUT $API/admin/feedback/$ANON/handled -H "$ADMIN" >/dev/null
curl -s -X PUT $API/admin/feedback/$MINE/handled -H "$ADMIN" >/dev/null
curl -s -X PUT $API/admin/feedback/$BAD/handled -H "$ADMIN" >/dev/null
curl -s -X PUT $API/admin/feedback/$FOREIGN/handled -H "$ADMIN" >/dev/null

echo "== rate limit (5 per hour per IP)"
reset_limit
codes=""
for i in 1 2 3 4 5 6; do codes="$codes $(req -X POST $API/feedback -H "$H" -d "{\"category\":\"other\",\"message\":\"flood $i $R\"}")"; done
check "5 accepted, the 6th refused" "$codes" " 201 201 201 201 201 429"
for id in $(curl -s "$API/admin/feedback?limit=100" -H "$ADMIN" | jq -r ".data[] | select(.message | startswith(\"flood \")) | select(.message | endswith(\" $R\")) | .id"); do
  curl -s -X PUT $API/admin/feedback/$id/handled -H "$ADMIN" >/dev/null
done

echo "passed: $pass  failed: $fail"
[ $fail -eq 0 ]
