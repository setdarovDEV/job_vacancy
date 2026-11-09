#!/usr/bin/env bash
# Stage 8 e2e: admin statistics (daily activity, breakdown, funnel).
# Statistics are cached for 5 minutes, so the script drops the admin:stats:* keys before
# every measurement (REDIS_CONTAINER, default jobvacancy-dev-redis-1). Run it while no other
# suite is creating users or vacancies: it checks exact +1 deltas for today.
set -u
API=${API:-http://localhost:8090/api/v1}
MP=http://localhost:8025/api/v1
SP=$(mktemp -d); trap "rm -rf $SP" EXIT
CTL=${CTL:-./bin/ctl}
REDIS=${REDIS_CONTAINER:-jobvacancy-dev-redis-1}
pass=0; fail=0
check() { if [ "$2" == "$3" ]; then echo "  ✔ $1"; pass=$((pass+1)); else echo "  ✘ $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
req() { curl -s -o $SP/body.json -w '%{http_code}' "$@"; }
J() { jq -r "$1" $SP/body.json; }
H='Content-Type: application/json'
mailcode() { sleep 1.5; curl -s "$MP/search?query=to:$1" | jq -r '.messages[0].ID' | xargs -I{} curl -s "$MP/message/{}" | jq -r '.Text' | grep -oE '\b[0-9]{6}\b' | head -1; }
register() { curl -s -X POST $API/auth/register -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\",\"full_name\":\"User $2\",\"role\":\"$2\"}" | jq -r .data.access_token; }
verify() { c=$(mailcode $2); curl -s -o /dev/null -X POST $API/auth/email/verify -H "Authorization: Bearer $1" -H "$H" -d "{\"code\":\"$c\"}"; }
login() { curl -s -X POST $API/auth/login -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\"}" | jq -r .data.access_token; }
A() { echo "Authorization: Bearer $1"; }
fresh() { docker exec $REDIS sh -c "redis-cli --scan --pattern 'admin:stats:*' | xargs -r redis-cli del" >/dev/null; }
TODAY=$(TZ=Asia/Tashkent date +%F)

R=$RANDOM
ADM="sadmin$R@example.com"; BOSS="sboss$R@example.com"; SEEK="sseek$R@example.com"
T_A=$(register $ADM seeker); $CTL set-role $ADM admin >/dev/null && T_A=$(login $ADM)
CATS=$(curl -s $API/catalog/categories); REGS=$(curl -s $API/catalog/regions)
IT=$(echo "$CATS" | jq '.data[] | select(.slug=="it") | .id')
BACKEND=$(echo "$CATS" | jq '.data[] | select(.slug=="it") | .children[] | select(.slug=="it-backend") | .id')
TASH=$(echo "$REGS" | jq '.data[] | select(.slug=="tashkent-city") | .id')

echo "== access and validation"
check "anon 401" $(req $API/admin/stats/activity) 401
T_X=$(register "sother$R@example.com" seeker)
check "non-admin 403" $(req $API/admin/stats/activity -H "$(A $T_X)") 403
check "days=14 → 422" "$(req "$API/admin/stats/activity?days=14" -H "$(A $T_A)")$(J .error.fields.days)" "422oneof=7 30 90"
check "days=abc → 422" "$(req "$API/admin/stats/breakdown?days=abc" -H "$(A $T_A)")$(J .error.fields.days)" "422oneof=7 30 90"

echo "== shape"
fresh
check "default period is 30 days" "$(req $API/admin/stats/activity -H "$(A $T_A)")$(J '"\(.data.period.days)/\(.data.daily | length)"')" "20030/30"
check "7 days: 7 buckets ending today" "$(req "$API/admin/stats/activity?days=7" -H "$(A $T_A)")$(J '"\(.data.daily | length)/\(.data.period.to)/\(.data.daily[-1].date)"')" "2007/$TODAY/$TODAY"
check "from = today − 6 = first bucket" "$(J '"\(.data.period.from)/\(.data.daily[0].date)"')" "$(TZ=Asia/Tashkent date -d '6 days ago' +%F)/$(TZ=Asia/Tashkent date -d '6 days ago' +%F)"
check "90 days: 90 buckets" "$(req "$API/admin/stats/activity?days=90" -H "$(A $T_A)")$(J '.data.daily | length')" "20090"
check "totals carry current and previous" "$(J '.data.totals.applications_sent | keys | join(",")')" "current,previous"
check "current = sum of buckets" "$(J '(.data.totals.signups_seeker.current) == ([.data.daily[].signups_seeker] | add)')" true
check "breakdown carries the same period" "$(req "$API/admin/stats/breakdown?days=7" -H "$(A $T_A)")$(J '"\(.data.period.days)/\(.data.period.to)"')" "2007/$TODAY"

base() { fresh; req "$API/admin/stats/activity?days=7" -H "$(A $T_A)" >/dev/null; cp $SP/body.json $SP/act.json
  req "$API/admin/stats/breakdown?days=7" -H "$(A $T_A)" >/dev/null; cp $SP/body.json $SP/brk.json; }
today() { jq -r --arg k "$1" '.data.daily[-1][$k]' $SP/act.json; }
total() { jq -r --arg k "$1" '.data.totals[$k].current' $SP/act.json; }
funnel() { jq -r --arg k "$1" '.data.funnel[$k]' $SP/brk.json; }
base
S0=$(today signups_seeker); E0=$(today signups_employer); V0=$(today vacancies_published); AP0=$(today applications_sent); RP0=$(today reports_filed)
VT0=$(total vacancies_published); FS0=$(funnel sent); FV0=$(funnel viewed); FI0=$(funnel invited); FH0=$(funnel hired)

echo "== activity moves"
T_B=$(register $BOSS employer); verify $T_B $BOSS
T_S=$(register $SEEK seeker); verify $T_S $SEEK
CID=$(curl -s -X POST $API/companies -H "$(A $T_B)" -H "$H" -d '{"name":"Stat Co '$R'","industry_id":'$IT',"region_id":'$TASH'}' | jq -r .data.id)
VID=$(curl -s -X POST $API/companies/$CID/vacancies -H "$(A $T_B)" -H "$H" \
  -d '{"title":"Statistika '$R' dasturchi","description":"Yuqori yuklamali backend tizimlarini loyihalash va ishlab chiqish. Go, PostgreSQL.","category_id":'$BACKEND',"region_id":'$TASH',"currency":"UZS","employment_type":"full_time","work_format":"office","experience":"1_3","schedule":"full_day","skills":["Go"]}' | jq -r .data.id)
curl -s -o /dev/null -X POST $API/vacancies/$VID/submit -H "$(A $T_B)"
curl -s -o /dev/null -X POST $API/admin/vacancies/$VID/approve -H "$(A $T_A)"
RID=$(curl -s -X POST $API/resumes -H "$(A $T_S)" -H "$H" -d '{"title":"Go dasturchi","about":"Backend","category_id":'$BACKEND',"region_id":'$TASH',"currency":"UZS","employment_types":["full_time"],"work_formats":["office"],"visibility":"public","skills":["Go"],"languages":[{"language":"uz","level":"native"}]}' | jq -r .data.id)
APP=$(curl -s -X POST $API/vacancies/$VID/applications -H "$(A $T_S)" -H "$H" -d "{\"resume_id\":\"$RID\"}" | jq -r .data.id)
curl -s -o /dev/null -X POST $API/reports -H "$(A $T_S)" -H "$H" -d "{\"target_type\":\"company\",\"target_id\":\"$CID\",\"reason\":\"spam\"}"
check "setup: application sent" "$([ ${#APP} -eq 36 ] && echo ok)" ok

base
check "seeker signup counted today" "$(today signups_seeker)" "$((S0 + 1))"
check "employer signup counted today" "$(today signups_employer)" "$((E0 + 1))"
check "published vacancy counted today" "$(today vacancies_published)" "$((V0 + 1))"
check "…and in the current total" "$(total vacancies_published)" "$((VT0 + 1))"
check "application counted today" "$(today applications_sent)" "$((AP0 + 1))"
check "report counted today" "$(today reports_filed)" "$((RP0 + 1))"
check "funnel: sent +1" "$(funnel sent)" "$((FS0 + 1))"
check "breakdown: IT among top categories (subcategory rolls up)" "$(jq -r --arg id $IT '[.data.top_categories[].id | tostring] | index($id) != null' $SP/brk.json)" true
check "breakdown: names in 4 languages" "$(jq -r '.data.top_categories[0].name | keys | join(",")' $SP/brk.json)" "en,ru,uz,uz-Cyrl"
check "breakdown: Tashkent among top regions" "$(jq -r --arg id $TASH '[.data.top_regions[].id | tostring] | index($id) != null' $SP/brk.json)" true

echo "== funnel"
curl -s -o /dev/null $API/applications/$APP -H "$(A $T_B)" # employer opens → viewed
base; check "viewed +1" "$(funnel viewed)" "$((FV0 + 1))"
curl -s -o /dev/null -X PUT $API/applications/$APP/status -H "$(A $T_B)" -H "$H" -d '{"status":"invited"}'
base; check "invited +1" "$(funnel invited)" "$((FI0 + 1))"
curl -s -o /dev/null -X PUT $API/applications/$APP/status -H "$(A $T_B)" -H "$H" -d '{"status":"hired"}'
base; check "hired +1" "$(funnel hired)" "$((FH0 + 1))"
curl -s -o /dev/null -X PUT $API/applications/$APP/status -H "$(A $T_B)" -H "$H" -d '{"status":"rejected"}'
base; check "later rejected still counts as hired (history)" "$(funnel hired)" "$((FH0 + 1))"

echo "== cache"
fresh; req "$API/admin/stats/activity?days=7" -H "$(A $T_A)" >/dev/null; C1=$(J '.data.daily[-1].signups_seeker')
register "slate$R@example.com" seeker >/dev/null
req "$API/admin/stats/activity?days=7" -H "$(A $T_A)" >/dev/null
check "served from cache within 5 minutes" "$(J '.data.daily[-1].signups_seeker')" "$C1"
check "cache key has version and day" "$(docker exec $REDIS redis-cli exists admin:stats:v1:activity:7:$TODAY)" 1

echo "== overview counters match the 7-day series"
fresh; req "$API/admin/stats/activity?days=7" -H "$(A $T_A)" >/dev/null; cp $SP/body.json $SP/act.json
req $API/admin/stats -H "$(A $T_A)" >/dev/null
check "users.signed_up_last_7d = seekers + employers (7 days)" "$(J .data.users.signed_up_last_7d)" "$(( $(total signups_seeker) + $(total signups_employer) ))"
check "applications.sent_last_7d = applications_sent (7 days)" "$(J .data.applications.sent_last_7d)" "$(total applications_sent)"
check "vacancies.live is a number" "$(J '.data.vacancies.live | type')" number

echo
echo "passed: $pass  failed: $fail"
[ $fail -eq 0 ]
