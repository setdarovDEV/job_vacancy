#!/usr/bin/env bash
# MVP features e2e (TZ FN-01…FN-06, FN-08): admin panel, vacancy reports, account deletion,
# republishing and expiry notices, company invites, districts. Presence (SEC-05) is in chat.sh.
set -u
API=${API:-http://localhost:8090/api/v1}
MP=http://localhost:8025/api/v1
SP=$(mktemp -d); trap "rm -rf $SP" EXIT
CTL=${CTL:-./bin/ctl}
REDIS_PORT=${REDIS_PORT:-6390}
pass=0; fail=0
check() { if [ "$2" == "$3" ]; then echo "  ✔ $1"; pass=$((pass+1)); else echo "  ✘ $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
req() { curl -s -o $SP/body.json -w '%{http_code}' "$@"; }
J() { jq -r "$1" $SP/body.json; }
H='Content-Type: application/json'
A() { echo "Authorization: Bearer $1"; }
# The auth endpoints allow 30 calls a minute per IP: wait for a fresh window when needed.
authwait() { local used ms; used=$(redis-cli -p $REDIS_PORT GET rl:auth_ip:127.0.0.1 2>/dev/null); used=${used:-0}
  if [ "$used" -ge "${1:-20}" ]; then ms=$(redis-cli -p $REDIS_PORT PTTL rl:auth_ip:127.0.0.1 2>/dev/null); ms=${ms:-0}
    [ "$ms" -gt 0 ] && echo "  … waiting $(( (ms+999)/1000 ))s for the auth rate-limit window" && sleep $(( (ms+999)/1000 )); fi; }
mailcode() { for i in $(seq 1 20); do [ "$(curl -s "$MP/search?query=to:$1" | jq '.messages | length')" -ge 1 ] && break; sleep 0.3; done
  curl -s "$MP/search?query=to:$1" | jq -r '.messages[0].ID' | xargs -I{} curl -s "$MP/message/{}" | jq -r '.Text' | grep -oE '\b[0-9]{6}\b' | head -1; }
user() { # email role name → token (registered with consent, e-mail verified)
  local t c; t=$(curl -s -X POST $API/auth/register -H "$H" -d "{\"consent\":true,\"email\":\"$1\",\"password\":\"Secret123\",\"full_name\":\"$3\",\"role\":\"$2\"}" | jq -r .data.access_token)
  c=$(mailcode $1); curl -s -o /dev/null -X POST $API/auth/email/verify -H "$(A $t)" -H "$H" -d "{\"code\":\"$c\"}"; echo $t; }
login() { curl -s -X POST $API/auth/login -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\"}" | jq -r .data.access_token; }
R=$RANDOM

authwait 12
TE=$(user "boss$R@example.com" employer "Bekzod Boss")
TS1=$(user "s1$R@example.com" seeker "Seeker One"); TS2=$(user "s2$R@example.com" seeker "Seeker Two"); TS3=$(user "s3$R@example.com" seeker "Seeker Three")
curl -s -o /dev/null -X POST $API/auth/register -H "$H" -d "{\"consent\":true,\"email\":\"adm$R@example.com\",\"password\":\"Secret123\",\"full_name\":\"Admin\",\"role\":\"seeker\"}"
$CTL set-role "adm$R@example.com" admin >/dev/null; TA=$(login "adm$R@example.com")
CAT=$(curl -s $API/catalog/categories | jq '.data[0].children[0].id')
SAM=$(curl -s "$API/catalog/regions?depth=1" | jq '.data[] | select(.slug=="samarkand") | .id')
DIST=$(curl -s $API/catalog/regions/samarkand/districts | jq '.data[] | select(.slug=="samarkand-urgut") | .id')
CID=$(curl -s -X POST $API/companies -H "$(A $TE)" -H "$H" -d "{\"name\":\"MVP Co $R\"}" | jq -r .data.id)
vac() { # title → published vacancy id (company unverified: submit, then the admin approves)
  local id; id=$(curl -s -X POST $API/companies/$CID/vacancies -H "$(A $TE)" -H "$H" -d '{"title":"'"$1"'","description":"Mijozlarga xizmat ko'"'"'rsatish, buyurtmalarni qabul qilish va hisobot yuritish.","category_id":'$CAT',"region_id":'$SAM',"district_id":'$DIST',"employment_type":"full_time","work_format":"office","experience":"none","schedule":"full_day","skills":["'"${2:-Excel}"'"]}' | jq -r .data.id)
  curl -s -o /dev/null -X POST $API/vacancies/$id/submit -H "$(A $TE)"; curl -s -o /dev/null -X POST $API/admin/vacancies/$id/approve -H "$(A $TA)"; echo $id; }

echo "== districts (FN-06)"
check "14 regions without districts (depth=1)" "$(req "$API/catalog/regions?depth=1")$(J '"\(.data | length)/\([.data[].children // [] | length] | add)"')" "20014/0"
check "full tree: 206 districts and cities" "$(req $API/catalog/regions)$(J '[.data[].children // [] | length] | add')" "200206"
check "Samarkand region: 16, cities first" "$(req $API/catalog/regions/samarkand/districts)$(J '"\(.data | length)/\(.data[0].name.uz)"')" "20016/Samarqand shahri"
check "by region id" "$(req $API/catalog/regions/$SAM/districts)$(J '.data | length')" "20016"
check "unknown region 404" "$(req $API/catalog/regions/atlantis/districts)$(J .error.code)" "404region_not_found"
check "a vacancy can use a new district" "$(req -X POST $API/companies/$CID/vacancies -H "$(A $TE)" -H "$H" -d '{"title":"Tuman testi","description":"Tuman bo'"'"'yicha filtr ishlashini tekshirish uchun vakansiya matni.","category_id":'$CAT',"region_id":'$SAM',"district_id":'$DIST',"employment_type":"full_time","work_format":"office","experience":"none","schedule":"full_day"}')$(J .data.district_id)" "201$DIST"
check "a district of another region is rejected" "$(req -X POST $API/companies/$CID/vacancies -H "$(A $TE)" -H "$H" -d '{"title":"Tuman testi","description":"Tuman bo'"'"'yicha filtr ishlashini tekshirish uchun vakansiya matni.","category_id":'$CAT',"region_id":'$SAM',"district_id":'$(curl -s $API/catalog/regions/bukhara/districts | jq '.data[0].id')',"employment_type":"full_time","work_format":"office","experience":"none","schedule":"full_day"}')$(J .error.fields.district_id)" "422in_region"

echo "== admin access (FN-01)"
for p in users stats audit-log skills reports companies; do
  check "employer → 403 /admin/$p" "$(req $API/admin/$p -H "$(A $TE)")$(J .error.code)" "403forbidden"
done
check "admin → 200 /admin/stats" "$(req "$API/admin/stats?days=7" -H "$(A $TA)")$(J '.data.days | length')" "2007"
check "user search by e-mail part" "$(req "$API/admin/users?q=s1$R@" -H "$(A $TA)")$(J '.data[0].full_name')" "200Seeker One"

echo "== reports (FN-02)"
V1=$(vac "Kassir $R")
check "report 201" "$(req -X POST $API/vacancies/$V1/report -H "$(A $TS1)" -H "$H" -d '{"reason":"fraud","comment":"Oldindan pul so'"'"'rashyapti"}')$(J .data.status)" "201open"
check "second report by the same user 409" "$(req -X POST $API/vacancies/$V1/report -H "$(A $TS1)" -H "$H" -d '{"reason":"spam"}')$(J .error.code)" "409already_reported"
check "own company can't report 409" "$(req -X POST $API/vacancies/$V1/report -H "$(A $TE)" -H "$H" -d '{"reason":"spam"}')$(J .error.code)" "409own_vacancy"
check "bad reason 422" $(req -X POST $API/vacancies/$V1/report -H "$(A $TS2)" -H "$H" -d '{"reason":"boring"}') 422
curl -s -o /dev/null -X POST $API/vacancies/$V1/report -H "$(A $TS2)" -H "$H" -d '{"reason":"misleading"}'
check "still public after 2 reports" $(req $API/vacancies/$V1) 200
curl -s -o /dev/null -X POST $API/vacancies/$V1/report -H "$(A $TS3)" -H "$H" -d '{"reason":"spam"}'
check "3rd report sends it back to moderation" "$(req $API/vacancies/$V1 -H "$(A $TE)")$(J .data.status)" "200moderation"
check "…and it leaves the public site" $(req $API/vacancies/$V1) 404
check "author is told" "$(req "$API/me/notifications?limit=5" -H "$(A $TE)")$(J '[.data[].type] | index("vacancy.reported") != null')" "200true"
check "admin queue: 3 open reports" "$(req "$API/admin/reports?vacancy_id=$V1" -H "$(A $TA)")$(J '"\(.data | length)/\(.data[0].open_reports)/\(.data[0].vacancy.title)"')" "2003/3/Kassir $R"
REP=$(J '.data[0].id')
check "admin resolves all 3" "$(req -X POST $API/admin/reports/$REP/resolve -H "$(A $TA)" -H "$H" -d '{"status":"resolved","note":"Rad etildi","all_for_object":true}')$(J .data.closed)" "2003"
check "queue empty for it" "$(req "$API/admin/reports?vacancy_id=$V1" -H "$(A $TA)")$(J '.data | length')" "2000"
check "resolved list" "$(req "$API/admin/reports?status=resolved&vacancy_id=$V1" -H "$(A $TA)")$(J '.data[0].resolution_note')" "200Rad etildi"
check "audited" "$(req "$API/admin/audit-log?object_type=report&object_id=$REP" -H "$(A $TA)")$(J '.data[0].action')" "200report.resolved"

echo "== republish & expiry (FN-04)"
V2=$(vac "Omborchi $R")
PGPASSWORD=jobvacancy psql -h 127.0.0.1 -p 5440 -U jobvacancy jobvacancy -qc "UPDATE vacancies SET expires_at = now() + interval '2 days' WHERE id = '$V2'"
$CTL vacancy-lifecycle >/dev/null
check "warned 3 days ahead" "$(req "$API/me/notifications?limit=10" -H "$(A $TE)")$(J '[.data[] | select(.type=="vacancy.expiring")] | length')" "2001"
$CTL vacancy-lifecycle >/dev/null
check "…only once" "$(req "$API/me/notifications?limit=10" -H "$(A $TE)")$(J '[.data[] | select(.type=="vacancy.expiring")] | length')" "2001"
PGPASSWORD=jobvacancy psql -h 127.0.0.1 -p 5440 -U jobvacancy jobvacancy -qc "UPDATE vacancies SET expires_at = now() - interval '1 minute' WHERE id = '$V2'"
$CTL vacancy-lifecycle >/dev/null
check "expired" "$(req $API/vacancies/$V2 -H "$(A $TE)")$(J '"\(.data.status)/\(.data.republish)"')" "200expired/direct"
check "author told it expired" "$(req "$API/me/notifications?limit=10" -H "$(A $TE)")$(J '[.data[] | select(.type=="vacancy.expired")] | length')" "2001"
check "republish without moderation" "$(req -X POST $API/vacancies/$V2/republish -H "$(A $TE)")$(J .data.status)" "200published"
check "public again" $(req $API/vacancies/$V2) 200
check "republish a live vacancy 409" "$(req -X POST $API/vacancies/$V2/republish -H "$(A $TE)")$(J .error.code)" "409invalid_status_transition"
curl -s -o /dev/null -X POST $API/vacancies/$V2/archive -H "$(A $TE)"
curl -s -o /dev/null -X PUT $API/vacancies/$V2 -H "$(A $TE)" -H "$H" -d '{"title":"Omborchi (tahrirlangan) '$R'","description":"Yangi matn: ombor hisobini yuritish va yuklarni qabul qilish.","category_id":'$CAT',"region_id":'$SAM',"employment_type":"full_time","work_format":"office","experience":"none","schedule":"full_day"}'
check "edited → republish goes to moderation" "$(req -X POST $API/vacancies/$V2/republish -H "$(A $TE)")$(J .data.status)" "200moderation"

echo "== featured (FN-01)"
V3=$(vac "Sotuvchi $R" "Golang$R")
UNTIL=$(date -u -d '+2 days' +%Y-%m-%dT%H:%M:%SZ)
check "TOP until a date" "$(req -X PUT $API/admin/vacancies/$V3/featured -H "$(A $TA)" -H "$H" -d "{\"until\":\"$UNTIL\"}")$(J .data.is_featured)" "200true"
check "past date 422" $(req -X PUT $API/admin/vacancies/$V3/featured -H "$(A $TA)" -H "$H" -d '{"until":"2020-01-01T00:00:00Z"}') 422
check "public page shows TOP" "$(req $API/vacancies/$V3)$(J .data.is_featured)" "200true"
check "end TOP" "$(req -X DELETE $API/admin/vacancies/$V3/featured -H "$(A $TA)")$(J .data.is_featured)" "200false"

echo "== skills (FN-01)"
check "new skill waits for review" "$(req "$API/admin/skills?verified=false&q=golang$R" -H "$(A $TA)")$(J '"\(.data | length)/\(.data[0].vacancies)"')" "2001/1"
SK=$(J '.data[0].id'); GO=$(curl -s "$API/admin/skills?q=go&verified=true&limit=100" -H "$(A $TA)" | jq '.data[] | select(.slug=="go") | .id')
check "merge into Go" "$(req -X POST $API/admin/skills/$SK/merge -H "$(A $TA)" -H "$H" -d "{\"into_id\":$GO}")$(J '"\(.data.into.name)/\(.data.vacancies)"')" "200Go/1"
sleep 2
check "vacancy now lists Go" "$(req $API/vacancies/$V3 -H "$(A $TE)")$(J '[.data.skills[].name] | index("Go") != null')" "200true"
check "duplicate gone" "$(req "$API/admin/skills?q=golang$R" -H "$(A $TA)")$(J '.data | length')" "2000"
check "verify a skill" "$(req -X PUT $API/admin/skills/$GO/verification -H "$(A $TA)")$(J .data.is_verified)" "200true"

echo "== block company (FN-01 ✅ leaves search within a minute)"
V4=$(vac "Hisobchi $R")
check "listed before" "$(req "$API/vacancies?company_id=$CID")$(J "[.data[].id] | index(\"$V4\") != null")" "200true"
T0=$(date +%s%N)
check "block company" "$(req -X POST $API/admin/companies/$CID/block -H "$(A $TA)" -H "$H" -d '{"reason":"Firibgarlik"}')$(J .data.status)" "200blocked"
check "vacancy page 404 at once" $(req $API/vacancies/$V4) 404
n=0; while [ "$(curl -s "$API/vacancies?company_id=$CID" | jq '.data | length')" != "0" ] && [ $n -lt 60 ]; do n=$((n+1)); sleep 1; done
check "gone from listings (${n}s, $(( ($(date +%s%N)-T0)/1000000 )) ms)" "$([ $n -lt 60 ] && echo ok)" "ok"
check "gone from search" "$(req "$API/vacancies?q=Hisobchi%20$R")$(J "[.data[].id] | index(\"$V4\") == null")" "200true"
check "company page 404" $(req $API/companies/$CID) 404
check "members can't manage it" "$(req $API/companies/$CID/vacancies -H "$(A $TE)")$(J .error.code)" "403company_blocked"
check "admin list shows it blocked" "$(req "$API/admin/companies?status=blocked&q=mvp%20co%20$R" -H "$(A $TA)")$(J '.data[0].status')" "200blocked"
check "unblock" "$(req -X POST $API/admin/companies/$CID/unblock -H "$(A $TA)")$(J .data.status)" "200active"

echo "== block user (FN-01)"
SID1=$(curl -s $API/me -H "$(A $TS1)" | jq -r .data.id)
check "block user" "$(req -X POST $API/admin/users/$SID1/block -H "$(A $TA)" -H "$H" -d '{"reason":"Spam"}')$(J .data.status)" "200blocked"
check "their token stops working at once" $(req $API/me -H "$(A $TS1)") 401
authwait 25
check "sign-in refused" "$(req -X POST $API/auth/login -H "$H" -d "{\"email\":\"s1$R@example.com\",\"password\":\"Secret123\"}")$(J .error.code)" "403account_blocked"
check "admins can't be blocked" "$(req -X POST $API/admin/users/$(curl -s $API/me -H "$(A $TA)" | jq -r .data.id)/block -H "$(A $TA)" -H "$H" -d '{"reason":"test"}')$(J .error.code)" "400cannot_block_self"
check "unblock" "$(req -X POST $API/admin/users/$SID1/unblock -H "$(A $TA)")$(J .data.status)" "200active"
check "can sign in again" $(req -X POST $API/auth/login -H "$H" -d "{\"email\":\"s1$R@example.com\",\"password\":\"Secret123\"}") 200
check "block is audited" "$(req "$API/admin/audit-log?object_type=user&object_id=$SID1" -H "$(A $TA)")$(J '[.data[].action] | join(",")')" "200user.unblock,user.block"

echo "== company invites (FN-05)"
NEW="new$R@example.com"
check "invite someone without an account" "$(req -X POST $API/companies/$CID/invites -H "$(A $TE)" -H "$H" -d "{\"email\":\"$NEW\",\"role\":\"recruiter\"}")$(J .data.role)" "201recruiter"
INV=$(J .data.id)
for i in $(seq 1 20); do [ "$(curl -s "$MP/search?query=to:$NEW" | jq '.messages | length')" -ge 1 ] && break; sleep 0.3; done
check "invite e-mail sent" "$(curl -s "$MP/search?query=to:$NEW" | jq -r '.messages[0].Subject')" "MVP Co $R sizni jamoaga taklif qildi"
check "pending list" "$(req $API/companies/$CID/invites -H "$(A $TE)")$(J '"\(.data | length)/\(.data[0].expired)"')" "2001/false"
authwait 25
TN=$(user "$NEW" employer "New Recruiter")
check "invitee sees the invite" "$(req $API/me/invites -H "$(A $TN)")$(J '"\(.data[0].id == "'$INV'")/\(.data[0].company.name)"')" "200true/MVP Co $R"
check "…but not the team yet" $(req $API/companies/$CID/members -H "$(A $TN)") 403
check "accept" "$(req -X POST $API/me/invites/$INV/accept -H "$(A $TN)")$(J .data.my_role)" "200recruiter"
check "now a member" "$(req $API/companies/$CID/members -H "$(A $TN)")$(J '.data | length')" "2002"
check "inviting a member 409" "$(req -X POST $API/companies/$CID/invites -H "$(A $TE)" -H "$H" -d "{\"email\":\"$NEW\",\"role\":\"recruiter\"}")$(J .error.code)" "409already_member"
check "recruiter can't invite" $(req -X POST $API/companies/$CID/invites -H "$(A $TN)" -H "$H" -d "{\"email\":\"x$R@example.com\",\"role\":\"recruiter\"}") 403
OTHER="other$R@example.com"
INV2=$(curl -s -X POST $API/companies/$CID/invites -H "$(A $TE)" -H "$H" -d "{\"email\":\"$OTHER\",\"role\":\"admin\"}" | jq -r .data.id)
check "revoke" $(req -X DELETE $API/companies/$CID/invites/$INV2 -H "$(A $TE)") 204
check "revoked invite can't be accepted" "$(req -X POST $API/me/invites/$INV2/accept -H "$(A $TN)")$(J .error.code)" "404invite_not_found"

echo "== account deletion (FN-03 ✅)"
authwait 22
DEL="del$R@example.com"; TD=$(user "$DEL" seeker "Delete Me")
check "wrong password 400" "$(req -X DELETE $API/me -H "$(A $TD)" -H "$H" -d '{"password":"Nope12345"}')$(J .error.code)" "400wrong_password"
check "delete 204" $(req -X DELETE $API/me -H "$(A $TD)" -H "$H" -d '{"password":"Secret123"}') 204
check "token dead" $(req $API/me -H "$(A $TD)") 401
check "login fails" "$(req -X POST $API/auth/login -H "$H" -d "{\"email\":\"$DEL\",\"password\":\"Secret123\"}")$(J .error.code)" "401invalid_credentials"
check "e-mail free to register again" "$(req -X POST $API/auth/register -H "$H" -d "{\"consent\":true,\"email\":\"$DEL\",\"password\":\"Secret123\",\"full_name\":\"Again\",\"role\":\"seeker\"}")$(J .data.user.email)" "201$DEL"
check "owner with a team must transfer first" "$(req -X DELETE $API/me -H "$(A $TE)" -H "$H" -d '{"password":"Secret123"}')$(J '"\(.error.code)/\(.error.fields.companies != null)"')" "409ownership_transfer_required/true"
NID=$(curl -s $API/me -H "$(A $TN)" | jq -r .data.id)
check "transfer ownership" "$(req -X POST $API/companies/$CID/owner -H "$(A $TE)" -H "$H" -d "{\"user_id\":\"$NID\"}")$(J .data.my_role)" "200admin"
check "then the old owner can leave by deleting" $(req -X DELETE $API/me -H "$(A $TE)" -H "$H" -d '{"password":"Secret123"}') 204
check "company lives on with the new owner" "$(req $API/me/companies -H "$(A $TN)")$(J '.data[0].my_role')" "200owner"

echo
echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
