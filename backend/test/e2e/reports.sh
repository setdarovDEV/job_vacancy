#!/usr/bin/env bash
# Stage 8 e2e: reports on vacancies and companies, the admin queue, takedown.
set -u
API=${API:-http://localhost:8090/api/v1}
MP=http://localhost:8025/api/v1
SP=$(mktemp -d); trap "rm -rf $SP" EXIT
CTL=${CTL:-./bin/ctl}
pass=0; fail=0
check() { if [ "$2" == "$3" ]; then echo "  ✔ $1"; pass=$((pass+1)); else echo "  ✘ $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
req() { curl -s -o $SP/body.json -w '%{http_code}' "$@"; }
J() { jq -r "$1" $SP/body.json; }
H='Content-Type: application/json'
mailcode() { sleep 1.5; curl -s "$MP/search?query=to:$1" | jq -r '.messages[0].ID' | xargs -I{} curl -s "$MP/message/{}" | jq -r '.Text' | grep -oE '\b[0-9]{6}\b' | head -1; }
register() { # email role -> prints access token
  curl -s -X POST $API/auth/register -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\",\"full_name\":\"User $2\",\"role\":\"$2\"}" | jq -r .data.access_token; }
verify() { c=$(mailcode $2); curl -s -o /dev/null -X POST $API/auth/email/verify -H "Authorization: Bearer $1" -H "$H" -d "{\"code\":\"$c\"}"; }
login() { curl -s -X POST $API/auth/login -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\"}" | jq -r .data.access_token; }
report() { # token target_type target_id reason [comment] -> http code
  req -X POST $API/reports -H "Authorization: Bearer $1" -H "$H" -d "{\"target_type\":\"$2\",\"target_id\":\"$3\",\"reason\":\"$4\",\"comment\":\"${5:-}\"}"; }
row() { jq -c --arg id "$1" '.data[] | select(.target_id == $id)' $SP/body.json; } # queue row of a target

R=$RANDOM
W=$(echo $R | tr 0-9 a-j)
BOSS="rboss$R@example.com"; S1="rs1$R@example.com"; S2="rs2$R@example.com"; ADM="radmin$R@example.com"
IT=$(curl -s $API/catalog/categories | jq '.data[] | select(.slug=="it") | .id')
BACKEND=$(curl -s $API/catalog/categories | jq '.data[] | select(.slug=="it") | .children[] | select(.slug=="it-backend") | .id')
TASH=$(curl -s $API/catalog/regions | jq '.data[] | select(.slug=="tashkent-city") | .id')

echo "== setup: employer with two published vacancies, two seekers, an admin"
T_B=$(register $BOSS employer); verify $T_B $BOSS
req -X POST $API/companies -H "Authorization: Bearer $T_B" -H "$H" -d '{"name":"Rapor '$W'","industry_id":'$IT',"region_id":'$TASH'}' >/dev/null
CID=$(J .data.id)
vac() { # title -> id (submitted)
  req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T_B" -H "$H" \
    -d '{"title":"'"$1"'","description":"Yuqori yuklamali backend tizimlarini loyihalash va ishlab chiqish. Go, PostgreSQL.","category_id":'$BACKEND',"region_id":'$TASH',"currency":"UZS","employment_type":"full_time","work_format":"office","experience":"1_3","schedule":"full_day","skills":["Go"]}' >/dev/null
  id=$(J .data.id); curl -s -o /dev/null -X POST $API/vacancies/$id/submit -H "Authorization: Bearer $T_B"; echo $id; }
V1=$(vac "Rpt${W} kuryer"); V2=$(vac "Rpt${W} operator")
T_1=$(register $S1 seeker); T_2=$(register $S2 seeker); T_A=$(register $ADM seeker)
$CTL set-role $ADM admin >/dev/null && T_A=$(login $ADM)
A() { echo "Authorization: Bearer $1"; }
for v in $V1 $V2; do curl -s -o /dev/null -X POST $API/admin/vacancies/$v/approve -H "$(A $T_A)"; done

echo "== filing"
check "anon 401" $(req -X POST $API/reports -H "$H" -d '{}') 401
check "draft/unknown vacancy 404" "$(report $T_1 vacancy $(cat /proc/sys/kernel/random/uuid) spam)$(J .error.code)" "404report_target_not_found"
check "bad reason 422" "$(report $T_1 vacancy $V1 rude)$(J .error.fields.reason)" "422oneof=fraud misleading offensive spam other"
check "bad target type 422" "$(report $T_1 resume $V1 spam)$(J .error.fields.target_type)" "422oneof=vacancy company"
check "missing target_id 422" "$(req -X POST $API/reports -H "Authorization: Bearer $T_2" -H "$H" -d '{"target_type":"vacancy","reason":"spam"}')$(J .error.fields.target_id)" "422required"
check "malformed target_id 422" "$(req -X POST $API/reports -H "Authorization: Bearer $T_2" -H "$H" -d '{"target_type":"vacancy","target_id":"abc","reason":"spam"}')$(J .error.fields.target_id)" "422uuid"
check "other needs a comment" "$(report $T_1 vacancy $V1 other)$(J .error.fields.comment)" "422required"
check "own vacancy 403" "$(report $T_B vacancy $V1 spam)$(J .error.code)" "403cannot_report_own_company"
check "own company 403" "$(report $T_B company $CID spam)$(J .error.code)" "403cannot_report_own_company"
check "seeker 1 reports vacancy (fraud)" "$(report $T_1 vacancy $V1 fraud "Oldindan pul so'rashdi")$(J '.data.status')" "201open"
check "duplicate open report 409" "$(report $T_1 vacancy $V1 spam)$(J .error.code)" "409already_reported"
check "seeker 2 reports vacancy (other)" "$(report $T_2 vacancy $V1 other "Telefon raqami boshqa kompaniyaniki")" 201
check "seeker 1 reports company (spam)" "$(report $T_1 company $CID spam)$(J .data.target_type)" "201company"
check "seeker 2 reports vacancy 2" $(report $T_2 vacancy $V2 misleading) 201

echo "== admin queue"
check "non-admin 403" $(req $API/admin/reports -H "$(A $T_1)") 403
check "stats: open targets ≥ 3" "$(req $API/admin/stats -H "$(A $T_A)")$(J '.data.reports.open_targets >= 3')" "200true"
check "queue 200" $(req "$API/admin/reports?limit=100" -H "$(A $T_A)") 200
R1=$(row $V1)
check "vacancy grouped: 2 reports" "$(echo "$R1" | jq -r .status_report_count)" 2
check "reason counts" "$(echo "$R1" | jq -r '"\(.reasons.fraud),\(.reasons.other),\(.reasons.spam)"')" "1,1,0"
check "latest comments, newest first" "$(echo "$R1" | jq -r '.latest | map(.comment) | join(" | ")')" "Telefon raqami boshqa kompaniyaniki | Oldindan pul so'rashdi"
check "reporter names" "$(echo "$R1" | jq -r '.latest[0].reporter_name')" "User seeker"
check "vacancy summary" "$(echo "$R1" | jq -r '"\(.vacancy.status)/\(.vacancy.public)/\(.vacancy.company.id)/\(.company)"')" "published/true/$CID/null"
check "company row" "$(row $CID | jq -r '"\(.target_type)/\(.company.status)/\(.company.public)/\(.vacancy)"')" "company/active/true/null"
check "filter target_type=company" "$(req "$API/admin/reports?target_type=company&limit=100" -H "$(A $T_A)")$(J '[.data[].target_type] | unique | join(",")')" "200company"
check "bad status 422" "$(req "$API/admin/reports?status=closed" -H "$(A $T_A)")$(J .error.fields.status)" "422oneof=open resolved dismissed"
check "bad cursor 400" $(req "$API/admin/reports?cursor=xx" -H "$(A $T_A)") 400
check "paging: limit=1 has a next cursor" "$(req "$API/admin/reports?limit=1" -H "$(A $T_A)")$(J '.data | length')$(J '.meta.next_cursor != null')" "2001true"

echo "== takedown (resolves the reports in the same call)"
check "vacancy is in search" "$(curl -s "$API/vacancies?q=rpt$W%20kuryer" | jq -r --arg id $V1 '[.data[].id] | index($id) != null')" true
check "takedown needs a reason" $(req -X POST $API/admin/vacancies/$V1/takedown -H "$(A $T_A)" -H "$H" -d '{"reason":"x"}') 422
check "takedown → rejected" "$(req -X POST $API/admin/vacancies/$V1/takedown -H "$(A $T_A)" -H "$H" -d '{"reason":"Firibgarlik haqida shikoyatlar tasdiqlandi"}')$(J .data.status)" "200rejected"
check "second takedown 409" $(req -X POST $API/admin/vacancies/$V1/takedown -H "$(A $T_A)" -H "$H" -d '{"reason":"Yana bir marta urinish"}') 409
check "gone from search" "$(curl -s "$API/vacancies?q=rpt$W%20kuryer" | jq -r --arg id $V1 '[.data[].id] | index($id) != null')" false
check "public detail 404" $(req $API/vacancies/$V1) 404
check "author told it was taken down" "$(curl -s $API/me/notifications -H "$(A $T_B)" | jq -r '[.data[] | select(.type=="vacancy.taken_down")][0].payload.reason')" "Firibgarlik haqida shikoyatlar tasdiqlandi"
check "left the open queue" "$(req "$API/admin/reports?limit=100" -H "$(A $T_A)")$(row $V1)" "200"
check "in the resolved view, not public" "$(req "$API/admin/reports?status=resolved&limit=100" -H "$(A $T_A)")$(row $V1 | jq -r '"\(.status_report_count)/\(.vacancy.status)/\(.vacancy.public)"')" "2002/rejected/false"
N1=$(curl -s $API/me/notifications -H "$(A $T_1)" | jq -c '[.data[] | select(.type=="report.resolved")][0].payload')
check "reporter 1 notified" "$(echo "$N1" | jq -r '"\(.target_type)/\(.target_name)"')" "vacancy/Rpt${W} kuryer"
check "reporter 2 notified" "$(curl -s $API/me/notifications -H "$(A $T_2)" | jq '[.data[] | select(.type=="report.resolved")] | length')" 1
check "resolve again 409" "$(req -X POST $API/admin/reports/vacancy/$V1/resolve -H "$(A $T_A)")$(J .error.code)" "409no_open_reports"

echo "== takedown without resolving, then resolve explicitly"
check "takedown resolve_reports=false" "$(req -X POST $API/admin/vacancies/$V2/takedown -H "$(A $T_A)" -H "$H" -d '{"reason":"Maosh haqida yolgon malumot","resolve_reports":false}')$(J .data.status)" "200rejected"
check "its reports stay open" "$(req "$API/admin/reports?limit=100" -H "$(A $T_A)")$(row $V2 | jq -r .reasons.misleading)" "2001"
check "resolve with a note" "$(req -X POST $API/admin/reports/vacancy/$V2/resolve -H "$(A $T_A)" -H "$H" -d '{"note":"olib tashlandi"}')$(J '"\(.data.status)/\(.data.status_report_count)/\(.data.total_report_count)"')" "200resolved/1/1"
check "unknown target 404" "$(req -X POST $API/admin/reports/vacancy/$(cat /proc/sys/kernel/random/uuid)/resolve -H "$(A $T_A)")$(J .error.code)" "404reported_target_not_found"
check "malformed target 404" "$(req -X POST $API/admin/reports/resume/nope/resolve -H "$(A $T_A)")$(J .error.code)" "404reported_target_not_found"
check "malformed note body 400" $(req -X POST $API/admin/reports/vacancy/$V2/resolve -H "$(A $T_A)" -H "$H" -d '{note') 400
check "company report still open → 409" $(report $T_1 company $CID spam) 409

echo "== dismiss"
check "dismiss without a note" "$(req -X POST $API/admin/reports/company/$CID/dismiss -H "$(A $T_A)")$(J .data.status)" "200dismissed"
check "reporter told: no violation" "$(curl -s $API/me/notifications -H "$(A $T_1)" | jq -r '[.data[] | select(.type=="report.dismissed")][0].payload.target_name')" "Rapor $W"
check "file again after dismissal" $(report $T_1 company $CID spam) 201

echo
echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
