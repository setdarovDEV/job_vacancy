#!/usr/bin/env bash
# Stage 8 e2e: admin overview, company and user directories, blocking.
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
verify() { # token email
  c=$(mailcode $2); curl -s -o /dev/null -X POST $API/auth/email/verify -H "Authorization: Bearer $1" -H "$H" -d "{\"code\":\"$c\"}"; }
login() { curl -s -X POST $API/auth/login -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\"}" | jq -r .data.access_token; }
has() { jq -r --arg id "$1" '[.data[].id] | index($id) != null' $SP/body.json; } # is id in .data[]?

R=$RANDOM
W=$(echo $R | tr 0-9 a-j)   # letters only, so the word is a single search term
BOSS="boss$R@example.com"; SEEK="seeker$R@example.com"; ADM="admin$R@example.com"
IT=$(curl -s $API/catalog/categories | jq '.data[] | select(.slug=="it") | .id')
BACKEND=$(curl -s $API/catalog/categories | jq '.data[] | select(.slug=="it") | .children[] | select(.slug=="it-backend") | .id')
TASH=$(curl -s $API/catalog/regions | jq '.data[] | select(.slug=="tashkent-city") | .id')

echo "== setup: employer with a published vacancy, a seeker, an admin"
T_B=$(register $BOSS employer); verify $T_B $BOSS
req -X POST $API/companies -H "Authorization: Bearer $T_B" -H "$H" \
  -d '{"name":"Kvazar '$W'","industry_id":'$IT',"region_id":'$TASH'}' >/dev/null
CID=$(J .data.id); CSLUG=$(J .data.slug)
V='{"title":"Kvz'$W' backend dasturchi","description":"Yuqori yuklamali backend tizimlarini loyihalash va ishlab chiqish. Go, PostgreSQL.","category_id":'$BACKEND',"region_id":'$TASH',"currency":"UZS","employment_type":"full_time","work_format":"office","experience":"1_3","schedule":"full_day","skills":["Go"]}'
req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T_B" -H "$H" -d "$V" >/dev/null
VID=$(J .data.id)
req -X POST $API/vacancies/$VID/submit -H "Authorization: Bearer $T_B" >/dev/null
T_S=$(register $SEEK seeker)
T_A=$(register $ADM seeker)
$CTL set-role $ADM admin >/dev/null && T_A=$(login $ADM)
SEEK_ID=$(curl -s $API/me -H "Authorization: Bearer $T_S" | jq -r .data.id)
ADM_ID=$(curl -s $API/me -H "Authorization: Bearer $T_A" | jq -r .data.id)

echo "== access"
check "anon 401" $(req $API/admin/stats) 401
check "seeker 403" $(req $API/admin/stats -H "Authorization: Bearer $T_S") 403
check "employer 403" $(req $API/admin/users -H "Authorization: Bearer $T_B") 403

echo "== stats"
check "stats 200" $(req $API/admin/stats -H "Authorization: Bearer $T_A") 200
check "pending moderation ≥ 1" "$(J '.data.vacancies.pending_moderation >= 1')" true
check "active unverified companies ≥ 1" "$(J '.data.companies.active_unverified >= 1')" true
check "all sections present" "$(J '.data | keys | join(",")')" "applications,companies,reports,skills,users,vacancies"
check "renamed counters" "$(J '[.data.users.signed_up_last_7d, .data.applications.sent_last_7d, .data.vacancies.live] | map(type) | join(",")')" "number,number,number"

echo "== moderation (existing endpoints)"
check "queue contains the vacancy" "$(req "$API/admin/vacancies/moderation?limit=50" -H "Authorization: Bearer $T_A")$(has $VID)" "200true"
check "approve → published" "$(req -X POST $API/admin/vacancies/$VID/approve -H "Authorization: Bearer $T_A")$(J .data.status)" "200published"

echo "== companies"
check "list 200" $(req "$API/admin/companies?q=kvazar%20$W" -H "Authorization: Bearer $T_A") 200
check "search by name finds it" "$(has $CID)" true
check "owner email shown" "$(J '.data[0].owner_email')" "$BOSS"
check "open vacancies counted" "$(J '.data[0].open_vacancies')" 1
check "status active" "$(J '.data[0].status')" active
check "filter verified=false" "$(req "$API/admin/companies?verified=false&q=$W" -H "Authorization: Bearer $T_A")$(has $CID)" "200true"
check "filter status=active" "$(req "$API/admin/companies?status=active&q=$W" -H "Authorization: Bearer $T_A")$(has $CID)" "200true"
check "bad status 422" "$(req "$API/admin/companies?status=verified" -H "Authorization: Bearer $T_A")$(J .error.fields.status)" "422oneof=active blocked"
check "bad verified 422" "$(req "$API/admin/companies?verified=maybe" -H "Authorization: Bearer $T_A")$(J .error.fields.verified)" "422boolean"
check "limit=0 → min=1" "$(req "$API/admin/companies?limit=0" -H "Authorization: Bearer $T_A")$(J .error.fields.limit)" "422min=1"
check "limit=101 → max=100" "$(req "$API/admin/companies?limit=101" -H "Authorization: Bearer $T_A")$(J .error.fields.limit)" "422max=100"
check "moderation queue takes limit=100" $(req "$API/admin/vacancies/moderation?limit=100" -H "Authorization: Bearer $T_A") 200
check "bad cursor 400" $(req "$API/admin/companies?cursor=xx" -H "Authorization: Bearer $T_A") 400
check "verify" "$(req -X PUT $API/admin/companies/$CID/verification -H "Authorization: Bearer $T_A")$(J .data.verified)" "200true"
check "verify returns the admin shape" "$(J '[.data.status, .data.owner_email, .data.open_vacancies] | join(",")')" "active,$BOSS,1"
check "filter verified=true" "$(req "$API/admin/companies?verified=true&q=$W" -H "Authorization: Bearer $T_A")$(has $CID)" "200true"
check "verify unknown 404" $(req -X PUT $API/admin/companies/no-such-company-$R/verification -H "Authorization: Bearer $T_A") 404
check "paging: limit=1 gives a cursor" "$(req "$API/admin/companies?limit=1" -H "Authorization: Bearer $T_A")$(J '.data | length')$(J '.meta.next_cursor != null')" "2001true"
NEXT=$(J .meta.next_cursor)
check "next page differs" "$(req "$API/admin/companies?limit=1&cursor=$NEXT" -H "Authorization: Bearer $T_A")$(J '.data[0].id != "'$(curl -s "$API/admin/companies?limit=1" -H "Authorization: Bearer $T_A" | jq -r '.data[0].id')'"')" "200true"

echo "== blocking a company hides its vacancies"
check "search finds vacancy before block" "$(req "$API/vacancies?q=kvz$W")$(has $VID)" "200true"
check "suggestions know the title" "$(req "$API/search/suggest?q=kvz$W")$(J '[.data.titles[]?.title] | any(test("(?i)kvz'$W'"))')" "200true"
check "block" "$(req -X PUT $API/admin/companies/$CID/block -H "Authorization: Bearer $T_A")$(J .data.status)" "200blocked"
check "block returns owner and counters" "$(J '[.data.owner_email, .data.open_vacancies] | join(",")')" "$BOSS,1"
check "block is idempotent" "$(req -X PUT $API/admin/companies/$CSLUG/block -H "Authorization: Bearer $T_A")$(J .data.status)" "200blocked"
check "search hides it" "$(req "$API/vacancies?q=kvz$W")$(has $VID)" "200false"
check "suggestions forget it (cache dropped)" "$(req "$API/search/suggest?q=kvz$W")$(J '[.data.titles[]?.title] | any(test("(?i)kvz'$W'"))')" "200false"
check "browse hides it" "$(req "$API/vacancies?region_id=$TASH&limit=50")$(has $VID)" "200false"
check "vacancy page 404" $(req $API/vacancies/$VID) 404
check "company page 404" $(req $API/companies/$CSLUG) 404
check "filter blocked" "$(req "$API/admin/companies?status=blocked&q=$W" -H "Authorization: Bearer $T_A")$(has $CID)" "200true"
check "owner can't edit while blocked" "$(req -X PUT $API/companies/$CID -H "Authorization: Bearer $T_B" -H "$H" -d '{"name":"Kvazar '$W'"}')$(J .error.code)" "403company_blocked"
check "unblock" "$(req -X DELETE $API/admin/companies/$CID/block -H "Authorization: Bearer $T_A")$(J .data.status)" "200active"
check "search finds it again" "$(req "$API/vacancies?q=kvz$W")$(has $VID)" "200true"
check "vacancy page back" $(req $API/vacancies/$VID) 200
check "unknown company 404" $(req -X PUT $API/admin/companies/no-such-company-$R/block -H "Authorization: Bearer $T_A") 404

echo "== users"
check "search by email" "$(req "$API/admin/users?q=seeker$R" -H "Authorization: Bearer $T_A")$(has $SEEK_ID)" "200true"
check "user fields" "$(J '.data[0].status'),$(J '.data[0].role')" "active,seeker"
check "filter role=admin" "$(req "$API/admin/users?role=admin&q=admin$R" -H "Authorization: Bearer $T_A")$(has $ADM_ID)" "200true"
check "filter role=employer excludes seeker" "$(req "$API/admin/users?role=employer&q=seeker$R" -H "Authorization: Bearer $T_A")$(J '.data | length')" "2000"
check "bad role filter 422" $(req "$API/admin/users?role=king" -H "Authorization: Bearer $T_A") 422
check "change role → employer" "$(req -X PUT $API/admin/users/$SEEK_ID/role -H "Authorization: Bearer $T_A" -H "$H" -d '{"role":"employer"}')$(J .data.role)" "200employer"
check "role change signs them out" $(req $API/me -H "Authorization: Bearer $T_S") 401
T_S=$(login $SEEK)
check "new login has new role" "$(req $API/me -H "Authorization: Bearer $T_S")$(J .data.role)" "200employer"
check "bad role 422" $(req -X PUT $API/admin/users/$SEEK_ID/role -H "Authorization: Bearer $T_A" -H "$H" -d '{"role":"king"}') 422
check "can't change own role" "$(req -X PUT $API/admin/users/$ADM_ID/role -H "Authorization: Bearer $T_A" -H "$H" -d '{"role":"seeker"}')$(J .error.code)" "403admin_cannot_change_own_role"
check "can't block self" "$(req -X PUT $API/admin/users/$ADM_ID/block -H "Authorization: Bearer $T_A")$(J .error.code)" "403admin_cannot_block_self"
check "block user" "$(req -X PUT $API/admin/users/$SEEK_ID/block -H "Authorization: Bearer $T_A")$(J .data.status)" "200blocked"
check "blocked token rejected" $(req $API/me -H "Authorization: Bearer $T_S") 401
check "blocked login refused" "$(req -X POST $API/auth/login -H "$H" -d "{\"email\":\"$SEEK\",\"password\":\"Secret123\"}")" 403
check "filter status=blocked" "$(req "$API/admin/users?status=blocked&q=seeker$R" -H "Authorization: Bearer $T_A")$(has $SEEK_ID)" "200true"
check "unblock user" "$(req -X DELETE $API/admin/users/$SEEK_ID/block -H "Authorization: Bearer $T_A")$(J .data.status)" "200active"
check "login works again" "$(login $SEEK | grep -c '^ey')" 1
check "unknown user 404" $(req -X PUT $API/admin/users/00000000-0000-7000-8000-000000000000/block -H "Authorization: Bearer $T_A") 404
check "malformed user id 404" $(req -X PUT $API/admin/users/nope/block -H "Authorization: Bearer $T_A") 404

echo
echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
