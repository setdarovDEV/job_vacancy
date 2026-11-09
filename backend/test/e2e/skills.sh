#!/usr/bin/env bash
# Stage 8 e2e: admin skill catalog — review, rename, merge (aliases), delete, search refresh.
# Needs the worker running (search refresh is a background job).
set -u
API=${API:-http://localhost:8090/api/v1}
MP=http://localhost:8025/api/v1
SP=$(mktemp -d); trap "rm -rf $SP" EXIT
CTL=${CTL:-./bin/ctl}
pass=0; fail=0
check() { if [ "$2" == "$3" ]; then echo "  ✔ $1"; pass=$((pass+1)); else echo "  ✘ $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
req() { curl -s -o $SP/body.json -w '%{http_code}' "$@"; }
J() { jq -r "$@" $SP/body.json; }
H='Content-Type: application/json'
mailcode() { sleep 1.5; curl -s "$MP/search?query=to:$1" | jq -r '.messages[0].ID' | xargs -I{} curl -s "$MP/message/{}" | jq -r '.Text' | grep -oE '\b[0-9]{6}\b' | head -1; }
register() { curl -s -X POST $API/auth/register -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\",\"full_name\":\"User $2\",\"role\":\"$2\"}" | jq -r .data.access_token; }
verify() { c=$(mailcode $2); curl -s -o /dev/null -X POST $API/auth/email/verify -H "Authorization: Bearer $1" -H "$H" -d "{\"code\":\"$c\"}"; }
login() { curl -s -X POST $API/auth/login -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\"}" | jq -r .data.access_token; }
# until <seconds> <command...>: retries a check command that prints "true" (background refresh).
until_true() { local n=$1; shift; for i in $(seq 1 $((n*2))); do [ "$("$@")" == "true" ] && { echo true; return; }; sleep 0.5; done; echo false; }

R=$RANDOM
W=$(echo $R | tr 0-9 a-j)         # letters only: one search term
TGT="Kvx$W"; DUP="Kvx$W.js"; OLD="Qwz$W"; NEW="Plm$W"
BOSS="sboss$R@example.com"; SEEK="sseek$R@example.com"; ADM="sadmin$R@example.com"
IT=$(curl -s $API/catalog/categories | jq '.data[] | select(.slug=="it") | .id')
BACKEND=$(curl -s $API/catalog/categories | jq '.data[] | select(.slug=="it") | .children[] | select(.slug=="it-backend") | .id')
TASH=$(curl -s $API/catalog/regions | jq '.data[] | select(.slug=="tashkent-city") | .id')

echo "== setup: two vacancies and a resume using new skills"
T_B=$(register $BOSS employer); verify $T_B $BOSS
req -X POST $API/companies -H "Authorization: Bearer $T_B" -H "$H" -d '{"name":"Skillco '$W'","industry_id":'$IT',"region_id":'$TASH'}' >/dev/null
CID=$(J .data.id)
vac() { # title skills-json -> id
  req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T_B" -H "$H" -d '{"title":"'"$1"'","description":"Frontend ilovalarni ishlab chiqish va qo'"'"'llab-quvvatlash, jamoa bilan ishlash.","category_id":'$BACKEND',"region_id":'$TASH',"currency":"UZS","employment_type":"full_time","work_format":"office","experience":"1_3","schedule":"full_day","skills":'"$2"'}' >/dev/null
  J .data.id; }
V1=$(vac "Frontend muhandis" '["'$TGT'","'$OLD'"]')
V2=$(vac "Veb dasturchi" '["'$DUP'"]')
T_A=$(register $ADM seeker); $CTL set-role $ADM admin >/dev/null && T_A=$(login $ADM)
AA="Authorization: Bearer $T_A"
for v in $V1 $V2; do
  curl -s -o /dev/null -X POST $API/vacancies/$v/submit -H "Authorization: Bearer $T_B"
  curl -s -o /dev/null -X POST $API/admin/vacancies/$v/approve -H "$AA"
done
T_S=$(register $SEEK seeker)
req -X POST $API/resumes -H "Authorization: Bearer $T_S" -H "$H" -d '{"title":"Frontend '$R'","about":"Interfeyslar.","category_id":'$BACKEND',"region_id":'$TASH',"currency":"UZS","employment_types":["full_time"],"work_formats":["office"],"visibility":"public","experiences":[],"educations":[],"skills":["'$DUP'","'$OLD'"],"languages":[]}' >/dev/null
RID=$(J .data.id)
check "fixtures created" "$( [ -n "$V1" ] && [ -n "$V2" ] && [ -n "$RID" ] && [ "$RID" != null ] && echo ok)" ok

echo "== access"
check "anon 401" $(req $API/admin/skills) 401
check "seeker 403" $(req $API/admin/skills -H "Authorization: Bearer $T_S") 403
check "employer 403" $(req -X DELETE $API/admin/skills/1 -H "Authorization: Bearer $T_B") 403

echo "== directory"
check "unverified list 200" $(req "$API/admin/skills?q=$W&verified=false" -H "$AA") 200
check "three new skills to review" "$(J '[.data[].name] | sort | join(",")')" "$(printf '%s\n' "$TGT" "$DUP" "$OLD" | sort | paste -sd,)"
id_of() { jq -r --arg n "$1" '.data[] | select(.name==$n) | .id' $SP/body.json; }
S_TGT=$(id_of $TGT); S_DUP=$(id_of $DUP); S_OLD=$(id_of $OLD)
check "usage counts" "$(jq -r --arg n "$DUP" '.data[] | select(.name==$n) | "\(.vacancy_count)/\(.resume_count)"' $SP/body.json)" "1/1"
check "complete row shape" "$(jq -r '.data[0] | keys | join(",")' $SP/body.json)" "aliases,created_at,id,in_use,name,popularity,resume_count,slug,vacancy_count,verified"
check "stats count unverified skills" "$(req $API/admin/stats -H "$AA")$(J '.data.skills.unverified >= 3')" "200true"
check "sort=popularity 200" $(req "$API/admin/skills?q=$W&sort=popularity" -H "$AA") 200
check "in_use sort: most listed first" "$(req "$API/admin/skills?q=$W&sort=in_use" -H "$AA")$(J '[.data[].in_use] | . == (sort | reverse)')" "200true"
check "in_use = vacancies + resumes" "$(J '[.data[] | .in_use == .vacancy_count + .resume_count] | all')" true
CUR_IU=$(curl -s "$API/admin/skills?q=$W&sort=in_use&limit=1" -H "$AA" | jq -r .meta.next_cursor)
check "in_use cursor pages" "$(req "$API/admin/skills?q=$W&sort=in_use&limit=1&cursor=$CUR_IU" -H "$AA")$(J '.data | length')" "2001"
check "bad sort 422" "$(req "$API/admin/skills?sort=abc" -H "$AA")$(J .error.fields.sort)" "422oneof=newest popularity in_use"
check "bad verified 422" "$(req "$API/admin/skills?verified=maybe" -H "$AA")$(J .error.fields.verified)" "422boolean"
CUR=$(curl -s "$API/admin/skills?q=$W&limit=1" -H "$AA" | jq -r .meta.next_cursor)
check "newest cursor pages" "$(req "$API/admin/skills?q=$W&limit=1&cursor=$CUR" -H "$AA")$(J '.data | length')" "2001"
check "cursor from another sort 400" "$(req "$API/admin/skills?q=$W&sort=popularity&cursor=$CUR" -H "$AA")$(J .error.code)" "400invalid_cursor"

echo "== verification"
check "verify → verified" "$(req -X PUT $API/admin/skills/$S_TGT/verification -H "$AA")$(J .data.verified)" "200true"
check "verify again is idempotent" "$(req -X PUT $API/admin/skills/$S_TGT/verification -H "$AA")$(J .data.verified)" "200true"
check "unverify" "$(req -X DELETE $API/admin/skills/$S_TGT/verification -H "$AA")$(J .data.verified)" "200false"
curl -s -o /dev/null -X PUT $API/admin/skills/$S_TGT/verification -H "$AA"
check "verified filter" "$(req "$API/admin/skills?q=$W&verified=true" -H "$AA")$(J '[.data[].id] | join(",")')" "200$S_TGT"
check "bulk verify is all or nothing" "$(req -X POST $API/admin/skills/verification -H "$AA" -H "$H" -d '{"ids":['$S_DUP',99999999]}')$(J .error.fields.ids)$(curl -s "$API/admin/skills?q=$W&verified=true" -H "$AA" | jq --arg id $S_DUP '[.data[].id | tostring] | index($id) == null')" "422not_foundtrue"
check "bulk verify needs ids" "$(req -X POST $API/admin/skills/verification -H "$AA" -H "$H" -d '{"ids":[]}')$(J .error.fields.ids)" "422min=1"
check "bulk verify 200" "$(req -X POST $API/admin/skills/verification -H "$AA" -H "$H" -d '{"ids":['$S_DUP','$S_TGT']}')$(J '[.data[] | .verified] | all')$(J '.data | length')" "200true2"
curl -s -o /dev/null -X DELETE $API/admin/skills/$S_DUP/verification -H "$AA"
check "unknown skill 404" "$(req -X PUT $API/admin/skills/99999999/verification -H "$AA")$(J .error.code)" "404skill_not_found"
check "malformed id 404" "$(req -X PUT $API/admin/skills/abc/verification -H "$AA")$(J .error.code)" "404skill_not_found"

echo "== rename"
check "rename 200" "$(req -X PATCH $API/admin/skills/$S_OLD -H "$AA" -H "$H" -d '{"name":" '$NEW' "}')$(J .data.name)" "200$NEW"
check "old name kept as alias" "$(J --arg s "$(echo $OLD | tr A-Z a-z)" '.data.aliases | index($s) != null')" true
check "rename onto another skill 409" "$(req -X PATCH $API/admin/skills/$S_OLD -H "$AA" -H "$H" -d '{"name":"'$TGT'"}')$(J .error.code)" "409skill_exists"
check "empty name 422" $(req -X PATCH $API/admin/skills/$S_OLD -H "$AA" -H "$H" -d '{"name":"   "}') 422
vac_found() { curl -s "$API/vacancies?q=$1" | jq -r --arg id $2 '[.data[].id] | index($id) != null'; }
res_found() { curl -s "$API/resumes?q=$1" -H "Authorization: Bearer $T_B" | jq -r --arg id $2 '[.data[].id] | index($id) != null'; }
check "vacancy search finds the new name (background refresh)" "$(until_true 15 vac_found "$(echo $NEW | tr A-Z a-z)" $V1)" true
check "resume search finds the new name" "$(until_true 15 res_found "$(echo $NEW | tr A-Z a-z)" $RID)" true
check "typing the old name resolves to the renamed skill" "$(req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T_B" -H "$H" -d '{"title":"Old name","description":"Frontend ilovalarni ishlab chiqish va qo'"'"'llab-quvvatlash, jamoa bilan ishlash.","category_id":'$BACKEND',"region_id":'$TASH',"currency":"UZS","employment_type":"full_time","work_format":"office","experience":"1_3","schedule":"full_day","skills":["'$OLD'"]}')$(J '[.data.skills[].id] | join(",")')" "201$S_OLD"

echo "== merge"
check "merge into itself 422" "$(req -X POST $API/admin/skills/$S_DUP/merge -H "$AA" -H "$H" -d '{"into":'$S_DUP'}')$(J .error.fields.into)" "422not_self"
check "merge into unknown target 422" "$(req -X POST $API/admin/skills/$S_DUP/merge -H "$AA" -H "$H" -d '{"into":99999999}')$(J .error.fields.into)" "422not_found"
check "merge an unknown skill 404" "$(req -X POST $API/admin/skills/99999999/merge -H "$AA" -H "$H" -d '{"into":'$S_TGT'}')$(J .error.code)" "404skill_not_found"
check "merge → target answered" "$(req -X POST $API/admin/skills/$S_DUP/merge -H "$AA" -H "$H" -d '{"into":'$S_TGT'}')$(J .data.id)" "200$S_TGT"
check "target now used by both vacancies and the resume" "$(J '"\(.data.vacancy_count)/\(.data.resume_count)"')" "2/1"
check "target inherits popularity only for moved vacancies" "$(J .data.popularity)" 2
check "duplicate's slug is an alias" "$(J '.data.aliases | index("'"$(echo $DUP | tr A-Z a-z | sed 's/\./-/')"'") != null')" true
check "duplicate is gone" "$(req "$API/admin/skills?q=$W" -H "$AA")$(J --arg id $S_DUP '[.data[].id | tostring] | index($id) == null')" "200true"
check "vacancy shows the target" "$(req $API/vacancies/$V2 -H "Authorization: Bearer $T_B")$(J '[.data.skills[].name] | join(",")')" "200$TGT"
check "resume shows the target" "$(req $API/resumes/$RID -H "Authorization: Bearer $T_S")$(J --arg n $TGT '[.data.skills[].name] | index($n) != null')" "200true"
check "typing the duplicate now resolves to the target" "$(req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T_B" -H "$H" -d '{"title":"Alias","description":"Frontend ilovalarni ishlab chiqish va qo'"'"'llab-quvvatlash, jamoa bilan ishlash.","category_id":'$BACKEND',"region_id":'$TASH',"currency":"UZS","employment_type":"full_time","work_format":"office","experience":"1_3","schedule":"full_day","skills":["'$DUP'"]}')$(J '[.data.skills[].id] | join(",")')" "201$S_TGT"
DUP_SLUG=$(echo $DUP | tr A-Z a-z | sed 's/\./-/')
check "database refuses a skill on an alias slug" "$(docker exec jobvacancy-dev-postgres-1 psql -U jobvacancy -d jobvacancy -Atc "INSERT INTO skills (name, slug) VALUES ('x', '$DUP_SLUG')" 2>&1 | grep -c 'is an alias')" 1
check "merging the gone duplicate again 404" $(req -X POST $API/admin/skills/$S_DUP/merge -H "$AA" -H "$H" -d '{"into":'$S_TGT'}') 404

echo "== delete"
check "delete 204" $(req -X DELETE $API/admin/skills/$S_OLD -H "$AA") 204
check "resume lost the skill" "$(req $API/resumes/$RID -H "Authorization: Bearer $T_S")$(J --arg n $NEW '[.data.skills[].name] | index($n) == null')" "200true"
res_gone() { [ "$(res_found "$(echo $NEW | tr A-Z a-z)" $RID)" == "false" ] && echo true || echo false; }
check "resume search no longer finds the deleted name" "$(until_true 15 res_gone)" true
check "delete again 404" $(req -X DELETE $API/admin/skills/$S_OLD -H "$AA") 404

echo
echo "passed: $pass  failed: $fail"
[ $fail -eq 0 ]
