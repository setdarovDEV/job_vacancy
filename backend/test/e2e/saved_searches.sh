#!/usr/bin/env bash
# Phase 5d e2e: saved searches and new-vacancy alerts.
set -u
API=${API:-http://localhost:8090/api/v1}
MP=http://localhost:8025/api/v1
SP=$(mktemp -d); trap "rm -rf $SP" EXIT
CTL=${CTL:-./bin/ctl}
PSQL=${PSQL:-psql postgres://jobvacancy:jobvacancy@localhost:5440/jobvacancy -qtA}
pass=0; fail=0
check() { if [ "$2" == "$3" ]; then echo "  ✔ $1"; pass=$((pass+1)); else echo "  ✘ $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
req() { curl -s -o $SP/body.json -w '%{http_code}' "$@"; }
J() { jq -r "$1" $SP/body.json; }
H='Content-Type: application/json'
A() { echo "Authorization: Bearer $1"; }
enc() { jq -rn --arg v "$1" '$v|@uri'; }
mailcode() { for i in $(seq 1 20); do [ "$(curl -s "$MP/search?query=to:$1" | jq '.messages | length')" -ge 1 ] && break; sleep 0.3; done
  curl -s "$MP/search?query=to:$1" | jq -r '.messages[0].ID' | xargs -I{} curl -s "$MP/message/{}" | jq -r '.Text' | grep -oE '\b[0-9]{6}\b' | head -1; }
user() { local t; t=$(curl -s -X POST $API/auth/register -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\",\"full_name\":\"$3\",\"role\":\"$2\"}" | jq -r .data.access_token)
  c=$(mailcode $1); curl -s -o /dev/null -X POST $API/auth/email/verify -H "$(A $t)" -H "$H" -d "{\"code\":\"$c\"}"; echo $t; }
R=$RANDOM
TS=$(user "ss$R@example.com" seeker "Alert Seeker")
TE=$(user "se$R@example.com" employer "Alert HR")
curl -s -o /dev/null -X POST $API/auth/register -H "$H" -d "{\"email\":\"sa$R@example.com\",\"password\":\"Secret123\",\"full_name\":\"Admin\",\"role\":\"seeker\"}"; $CTL set-role "sa$R@example.com" admin >/dev/null
TA=$(curl -s -X POST $API/auth/login -H "$H" -d "{\"email\":\"sa$R@example.com\",\"password\":\"Secret123\"}" | jq -r .data.access_token)
CID=$(curl -s -X POST $API/companies -H "$(A $TE)" -H "$H" -d "{\"name\":\"Alert Co $R\"}" | jq -r .data.id)
curl -s -o /dev/null -X PUT $API/admin/companies/$CID/verification -H "$(A $TA)"
IT=$(curl -s $API/catalog/categories | jq '.data[] | select(.slug=="it") | .id'); BACK=$(curl -s $API/catalog/categories | jq '[.data[].children[]?] | .[] | select(.slug=="it-backend") | .id')
TASH=$(curl -s $API/catalog/regions | jq '.data[] | select(.slug=="tashkent-city") | .id'); SAM=$(curl -s $API/catalog/regions | jq '.data[] | select(.slug=="samarkand") | .id')
post() { local id; id=$(curl -s -X POST $API/companies/$CID/vacancies -H "$(A $TE)" -H "$H" -d "{\"title\":\"$1\",\"description\":\"Yuqori yuklamali servislarni ishlab chiqish va qo'llab-quvvatlash.\",\"category_id\":$BACK,\"region_id\":$2,\"employment_type\":\"full_time\",\"work_format\":\"remote\",\"experience\":\"1_3\",\"schedule\":\"full_day\"}" | jq -r .data.id); curl -s -o /dev/null -X POST $API/vacancies/$id/submit -H "$(A $TE)"; }

echo "== saved searches"
P="q=$(enc "golang $R")&region_id=$TASH&work_format=remote,hybrid"
check "create" "$(req -X POST $API/me/saved-searches -H "$(A $TS)" -H "$H" -d "{\"name\":\"Golang Toshkentda\",\"params\":\"$P\"}")$(J .data.notify)" "201true"
SID=$(J .data.id)
check "params canonicalized" "$(J .data.params)" "q=golang+$R&region_id=$TASH&work_format=hybrid&work_format=remote"
check "same search in another order → 409" "$(req -X POST $API/me/saved-searches -H "$(A $TS)" -H "$H" -d "{\"name\":\"dup\",\"params\":\"work_format=hybrid,remote&region_id=$TASH&q=$(enc "golang $R")&cursor=abc\"}")$(J .error.code)" "409saved_search_exists"
check "invalid filter → 422" $(req -X POST $API/me/saved-searches -H "$(A $TS)" -H "$H" -d '{"name":"x","params":"work_format=space"}') 422
check "empty params → 422" $(req -X POST $API/me/saved-searches -H "$(A $TS)" -H "$H" -d '{"name":"x","params":"limit=5"}') 422
check "list" "$(req $API/me/saved-searches -H "$(A $TS)")$(J '.data | length')" "2001"

echo "== alerts"
$PSQL -c "UPDATE saved_searches SET last_checked_at = now() - interval '1 hour' WHERE id = '$SID'" >/dev/null
post "Senior Golang $R developer" $TASH
post "Golang $R engineer (Samarqand)" $SAM          # other region: must not match
post "Python developer $R" $TASH                     # other query: must not match
check "alerts run" "$($CTL run-alerts | grep -oE 'alerted [0-9]+' | awk '{print ($2>=1)}')" 1
check "seeker got an alert" "$(req $API/me/notifications -H "$(A $TS)")$(J '.data[0] | "\(.type)/\(.payload.count)/\(.payload.search_name)"')" "200search.alert/1/Golang Toshkentda"
check "alert lists the new vacancy" "$(J '.data[0].payload.preview' | grep -c "Senior Golang $R developer — Alert Co $R")" 1
check "re-run: no repeat alert" "$($CTL run-alerts >/dev/null; curl -s $API/me/notifications -H "$(A $TS)" | jq '[.data[] | select(.type=="search.alert")] | length')" 1

echo "== alerts never use the typo-tolerant fallback (TZ BE-11)"
W=zyq$(tr -dc a-z </dev/urandom | head -c 9); SWAP=x; [ "${W:5:1}" = x ] && SWAP=w
TYPO="${W:0:5}$SWAP${W:6}"                        # one wrong letter in a 12-letter word
check "typo search saved" "$(req -X POST $API/me/saved-searches -H "$(A $TS)" -H "$H" -d "{\"name\":\"Typo $R\",\"params\":\"q=$TYPO\"}")" 201
TID=$(J .data.id)
$PSQL -c "UPDATE saved_searches SET last_checked_at = now() - interval '1 hour' WHERE id = '$TID'" >/dev/null
post "Operator $W" $TASH
check "public search shows it as a similar result" "$(req "$API/vacancies?q=$TYPO")$(J '.meta.fuzzy')$(J '[.data[].title] | index("Operator '$W'") != null')" "200truetrue"
$CTL run-alerts >/dev/null
check "no alert from a similar result" "$(curl -s $API/me/notifications -H "$(A $TS)" | jq "[.data[] | select(.type==\"search.alert\" and .payload.search_name==\"Typo $R\")] | length")" 0
req -X DELETE $API/me/saved-searches/$TID -H "$(A $TS)" >/dev/null
check "mute" "$(req -X PUT $API/me/saved-searches/$SID -H "$(A $TS)" -H "$H" -d '{"name":"Golang","notify":false}')$(J .data.notify)" "200false"
$PSQL -c "UPDATE saved_searches SET last_checked_at = now() - interval '1 hour' WHERE id = '$SID'" >/dev/null
post "Golang $R team lead" $TASH
check "muted search isn't checked" "$($CTL run-alerts >/dev/null; curl -s $API/me/notifications -H "$(A $TS)" | jq '[.data[] | select(.type=="search.alert")] | length')" 1
check "delete" $(req -X DELETE $API/me/saved-searches/$SID -H "$(A $TS)") 204
check "gone" $(req -X DELETE $API/me/saved-searches/$SID -H "$(A $TS)") 404

echo
echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
