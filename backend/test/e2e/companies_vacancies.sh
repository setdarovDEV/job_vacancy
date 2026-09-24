#!/usr/bin/env bash
# Phase 2 e2e: catalogs, companies, vacancies, moderation.
set -u
API=${API:-http://localhost:8090/api/v1}
MP=http://localhost:8025/api/v1
SP=$(mktemp -d); trap "rm -rf $SP" EXIT
CTL=${CTL:-./bin/ctl}
pass=0; fail=0
check() { if [ "$2" == "$3" ]; then echo "  ✔ $1"; pass=$((pass+1)); else echo "  ✘ $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
req() { curl -s -o $SP/body.json -w '%{http_code}' "$@"; }
J() { jq -r "$1" $SP/body.json; }
hdr() { local k=$1; shift; curl -s -o /dev/null -D - "$@" | tr -d '\r' | grep -i "^$k:" | head -1 | cut -d' ' -f2-; }
H='Content-Type: application/json'
mailcode() { sleep 1.5; curl -s "$MP/search?query=to:$1" | jq -r '.messages[0].ID' | xargs -I{} curl -s "$MP/message/{}" | jq -r '.Text' | grep -oE '\b[0-9]{6}\b' | head -1; }
register() { # email role -> prints access token
  curl -s -X POST $API/auth/register -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\",\"full_name\":\"User $2\",\"role\":\"$2\"}" | jq -r .data.access_token; }
verify() { # token email
  c=$(mailcode $2); curl -s -o /dev/null -X POST $API/auth/email/verify -H "Authorization: Bearer $1" -H "$H" -d "{\"code\":\"$c\"}"; }
login() { curl -s -X POST $API/auth/login -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\"}" | jq -r .data.access_token; }
R=$RANDOM
E1="boss$R@example.com"; E2="hr$R@example.com"; S1="seeker$R@example.com"; A1="admin$R@example.com"

echo "== catalog"
check "categories 200" $(req -D $SP/h.txt $API/catalog/categories) 200
check "20 top-level categories" "$(J '.data | length')" 20
check "IT has 12 subcategories" "$(J '.data[] | select(.slug=="it") | .children | length')" 12
check "names in 4 languages" "$(J '.data[0].name | keys | join(",")')" "en,ru,uz,uz-Cyrl"
ETAG=$(grep -i '^etag' $SP/h.txt | cut -d' ' -f2 | tr -d '\r')
check "ETag → 304" $(req -H "If-None-Match: $ETAG" $API/catalog/categories) 304
check "regions 200" $(req $API/catalog/regions) 200
check "14 regions" "$(J '.data | length')" 14
check "Tashkent has 12 districts" "$(J '.data[] | select(.slug=="tashkent-city") | .children | length')" 12
check "skills search" "$(req "$API/catalog/skills?q=post")$(J '.data[0].name')" "200PostgreSQL"
IT=$(curl -s $API/catalog/categories | jq '.data[] | select(.slug=="it") | .id')
BACKEND=$(curl -s $API/catalog/categories | jq '.data[] | select(.slug=="it") | .children[] | select(.slug=="it-backend") | .id')
SALES=$(curl -s $API/catalog/categories | jq '.data[] | select(.slug=="sales") | .id')
TASH=$(curl -s $API/catalog/regions | jq '.data[] | select(.slug=="tashkent-city") | .id')
CHIL=$(curl -s $API/catalog/regions | jq '.data[] | select(.slug=="tashkent-city") | .children[] | select(.slug=="tashkent-city-chilanzar") | .id')
SAM=$(curl -s $API/catalog/regions | jq '.data[] | select(.slug=="samarkand") | .id')

echo "== companies"
T1=$(register $E1 employer)
COMPANY='{"name":"Najot   Ta'"'"'lim '$R'","industry_id":'$IT',"size":"51-200","website":"najottalim.uz","phone":"90 123 45 67","region_id":'$TASH',"about":"IT ta'"'"'lim markazi"}'
check "unverified user can't create company" "$(req -X POST $API/companies -H "Authorization: Bearer $T1" -H "$H" -d "$COMPANY")$(J .error.code)" "403verification_required"
verify $T1 $E1
check "create company 201" $(req -X POST $API/companies -H "Authorization: Bearer $T1" -H "$H" -d "$COMPANY") 201
CID=$(J .data.id); CSLUG=$(J .data.slug)
check "slug from Uzbek name" "$CSLUG" "najot-talim-$R"
check "website normalized" "$(J .data.website)" "https://najottalim.uz"
check "phone normalized" "$(J .data.phone)" "+998901234567"
check "second same-name company gets -2" "$(req -X POST $API/companies -H "Authorization: Bearer $T1" -H "$H" -d "$COMPANY")$(J .data.slug)" "201najot-talim-$R-2"
check "bad website 422" $(req -X POST $API/companies -H "Authorization: Bearer $T1" -H "$H" -d '{"name":"X Co","website":"not a url"}') 422
T_S=$(register $S1 seeker); verify $T_S $S1
check "seeker can't create company" "$(req -X POST $API/companies -H "Authorization: Bearer $T_S" -H "$H" -d "$COMPANY")$(J .error.code)" "403employer_only"
check "my companies" "$(req $API/me/companies -H "Authorization: Bearer $T1")$(J '.data[0].my_role')" "200owner"
check "public company page" "$(req $API/companies/$CSLUG)$(J .data.open_vacancies)" "2000"

echo "== vacancy validation"
V='{"title":"Senior Go dasturchi","description":"Yuqori yuklamali backend tizimlarini loyihalash va ishlab chiqish. Go, PostgreSQL, Redis.","category_id":'$BACKEND',"region_id":'$TASH',"district_id":'$CHIL',"salary_min":15000000,"salary_max":30000000,"currency":"UZS","employment_type":"full_time","work_format":"hybrid","experience":"3_6","schedule":"full_day","skills":["Go","postgresql"," Kafka  Streams "]}'
check "bad category 422" "$(req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T1" -H "$H" -d "$(echo $V | jq '.category_id=99999')")$(J '.error.fields.category_id')" "422exists"
check "district outside region 422" "$(req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T1" -H "$H" -d "$(echo $V | jq ".region_id=$SAM")")$(J '.error.fields.district_id')" "422in_region"
check "salary min>max 422" $(req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T1" -H "$H" -d "$(echo $V | jq '.salary_min=50000000')") 422
check "missing fields 422" "$(req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T1" -H "$H" -d '{"title":"x"}')$(J '.error.fields | length')" "4228"
check "outsider can't post 403" $(req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T_S" -H "$H" -d "$V") 403

echo "== lifecycle (unverified company → moderation)"
check "create draft 201" $(req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T1" -H "$H" -d "$V") 201
VID=$(J .data.id); VSLUG=$(J .data.slug)
check "status draft" "$(J .data.status)" draft
check "skills resolved (new one created)" "$(J '[.data.skills[].name] | sort | join(",")')" "Go,Kafka Streams,PostgreSQL"
check "slug readable" "$(echo $VSLUG | sed 's/-[a-z0-9]\{6\}$//')" "senior-go-dasturchi"
check "draft hidden from public" $(req $API/vacancies/$VSLUG) 404
check "draft visible to owner" "$(req $API/vacancies/$VSLUG -H "Authorization: Bearer $T1")$(J .data.can_edit)" "200true"
check "submit → moderation" "$(req -X POST $API/vacancies/$VID/submit -H "Authorization: Bearer $T1")$(J .data.status)" "200moderation"
check "submit twice 409" $(req -X POST $API/vacancies/$VID/submit -H "Authorization: Bearer $T1") 409

echo "== admin moderation"
T_A=$(register $A1 seeker)
check "non-admin blocked 403" $(req $API/admin/vacancies/moderation -H "Authorization: Bearer $T_A") 403
$CTL set-role $A1 admin >/dev/null && T_A=$(login $A1)
check "queue has vacancy" "$(req $API/admin/vacancies/moderation -H "Authorization: Bearer $T_A")$(J "[.data[].id] | index(\"$VID\") != null")" "200true"
check "reject needs reason" $(req -X POST $API/admin/vacancies/$VID/reject -H "Authorization: Bearer $T_A" -H "$H" -d '{"reason":"no"}') 422
check "reject 200" "$(req -X POST $API/admin/vacancies/$VID/reject -H "Authorization: Bearer $T_A" -H "$H" -d '{"reason":"Maosh oralig'"'"'ini aniqlashtiring"}')$(J .data.status)" "200rejected"
check "owner sees reason" "$(req $API/vacancies/$VID -H "Authorization: Bearer $T1")$(J .data.reject_reason)" "200Maosh oralig'ini aniqlashtiring"
check "resubmit → moderation" "$(req -X POST $API/vacancies/$VID/submit -H "Authorization: Bearer $T1")$(J .data.status)" "200moderation"
check "approve → published" "$(req -X POST $API/admin/vacancies/$VID/approve -H "Authorization: Bearer $T_A")$(J .data.status)" "200published"
check "expires in 30 days" "$(J '((.data.expires_at | sub("\\..*";"") | strptime("%Y-%m-%dT%H:%M:%S") | mktime) - now) / 86400 | round')" 30
check "approve again 409" $(req -X POST $API/admin/vacancies/$VID/approve -H "Authorization: Bearer $T_A") 409
check "public now 200" "$(req $API/vacancies/$VSLUG)$(J .data.can_edit)" "200false"
check "reject_reason hidden from public" "$(J '.data.reject_reason // "hidden"')" hidden

echo "== edits"
check "unverified edit of live vacancy → moderation" "$(req -X PUT $API/vacancies/$VID -H "Authorization: Bearer $T1" -H "$H" -d "$(echo $V | jq '.title="Senior Go developer"')")$(J .data.status)" "200moderation"
check "slug unchanged after edit" "$(J .data.slug)" "$VSLUG"
check "admin verifies company" "$(req -X PUT $API/admin/companies/$CID/verification -H "Authorization: Bearer $T_A")$(J .data.verified)" "200true"
req -X POST $API/admin/vacancies/$VID/approve -H "Authorization: Bearer $T_A" >/dev/null
check "verified edit stays published" "$(req -X PUT $API/vacancies/$VID -H "Authorization: Bearer $T1" -H "$H" -d "$V")$(J .data.status)" "200published"

echo "== response cache (TZ BE-05)"
curl -s -o /dev/null $API/vacancies/$VSLUG   # warm
check "public page from cache" "$(hdr x-cache $API/vacancies/$VSLUG)" HIT
check "anonymous Cache-Control" "$(hdr cache-control $API/vacancies/$VSLUG)" "public, max-age=60"
ETAG=$(hdr etag $API/vacancies/$VSLUG)
check "If-None-Match → 304" $(req -H "If-None-Match: $ETAG" $API/vacancies/$VSLUG) 304
check "pre-gzipped bytes" "$(hdr content-encoding -H 'Accept-Encoding: gzip' $API/vacancies/$VSLUG)" gzip
req -X PUT $API/vacancies/$VID -H "Authorization: Bearer $T1" -H "$H" -d "$(echo $V | jq '.title="Senior Go dasturchi (yangi)"')" >/dev/null
check "edit visible to visitors at once" "$(req $API/vacancies/$VSLUG)$(J .data.title)" "200Senior Go dasturchi (yangi)"
check "old ETag is stale → 200" $(req -H "If-None-Match: $ETAG" $API/vacancies/$VSLUG) 200
check "owner gets a fresh private copy" "$(hdr cache-control -H "Authorization: Bearer $T1" $API/vacancies/$VSLUG)" "private, no-cache"
check "company page cached" "$(curl -s -o /dev/null $API/companies/$CSLUG; hdr x-cache $API/companies/$CSLUG)" HIT
req -X PUT $API/vacancies/$VID -H "Authorization: Bearer $T1" -H "$H" -d "$V" >/dev/null
check "archive" "$(req -X POST $API/vacancies/$VID/archive -H "Authorization: Bearer $T1")$(J .data.status)" "200archived"
check "archived hidden" $(req $API/vacancies/$VSLUG) 404
check "verified submit publishes directly" "$(req -X POST $API/vacancies/$VID/submit -H "Authorization: Bearer $T1")$(J .data.status)" "200published"
check "can't delete published" "$(req -X DELETE $API/vacancies/$VID -H "Authorization: Bearer $T1")$(J .error.code)" "409only_drafts_deletable"
req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T1" -H "$H" -d "$V" >/dev/null; DRAFT=$(J .data.id)
check "delete draft 204" $(req -X DELETE $API/vacancies/$DRAFT -H "Authorization: Bearer $T1") 204

echo "== team"
T2=$(register $E2 employer); verify $T2 $E2
check "add recruiter 204" $(req -X POST $API/companies/$CID/members -H "Authorization: Bearer $T1" -H "$H" -d "{\"email\":\"$E2\",\"role\":\"recruiter\"}") 204
check "seeker can't be added" $(req -X POST $API/companies/$CID/members -H "Authorization: Bearer $T1" -H "$H" -d "{\"email\":\"$S1\",\"role\":\"recruiter\"}") 404
check "recruiter posts vacancy" $(req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T2" -H "$H" -d "$(echo $V | jq '.title="Frontend React dasturchi" | .category_id='$IT' | .work_format="remote" | .skills=["React","TypeScript"]')") 201
V2=$(J .data.id)
req -X POST $API/vacancies/$V2/submit -H "Authorization: Bearer $T2" >/dev/null
check "recruiter can't manage team" $(req -X POST $API/companies/$CID/members -H "Authorization: Bearer $T2" -H "$H" -d "{\"email\":\"$E1\",\"role\":\"recruiter\"}") 403
check "members list" "$(req $API/companies/$CID/members -H "Authorization: Bearer $T2")$(J '.data | length')" "2002"
check "company dashboard (all statuses)" "$(req "$API/companies/$CID/vacancies" -H "Authorization: Bearer $T2")$(J '.data | length')" "2002"
check "owner removes recruiter" $(req -X DELETE $API/companies/$CID/members/$(J '.data[0].company.id' >/dev/null; curl -s $API/me -H "Authorization: Bearer $T2" | jq -r .data.id) -H "Authorization: Bearer $T1") 204
check "removed member loses access" $(req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T2" -H "$H" -d "$V") 403

echo "== public listing & filters"
# three more published vacancies (company is verified → publish directly)
for t in "Savdo menejeri" "Kassir" "Buxgalter"; do
  req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T1" -H "$H" -d "$(echo $V | jq --arg t "$t" '.title=$t | .category_id='$SALES' | .work_format="office" | .salary_min=4000000 | .salary_max=6000000 | .skills=[]')" >/dev/null
  req -X POST $API/vacancies/$(J .data.id)/submit -H "Authorization: Bearer $T1" >/dev/null
done
Q="$API/vacancies?company_id=$CID"
check "list 5 published" "$(req "$Q")$(J '.data | length')" "2005"
check "newest first" "$(J '.data[0].title')" "Buxgalter"
check "parent category includes children" "$(req "$Q&category_id=$IT")$(J '.data | length')" "2002"
check "subcategory only" "$(req "$Q&category_id=$BACKEND")$(J '.data | length')" "2001"
check "work_format multi" "$(req "$Q&work_format=remote,hybrid")$(J '.data | length')" "2002"
check "salary_from" "$(req "$Q&salary_from=10000000")$(J '.data | length')" "2002"
check "salary_from in USD finds none" "$(req "$Q&salary_from=100&currency=USD")$(J '.data | length')" "2000"
check "region filter" "$(req "$Q&region_id=$SAM")$(J '.data | length')" "2000"
check "invalid enum 422" "$(req "$Q&work_format=space")$(J '.error.fields.work_format')" "422oneof"
check "page 1 (limit 2)" "$(req "$Q&limit=2")$(J '.data | length')" "2002"
NEXT=$(J .meta.next_cursor); P1=$(J '[.data[].id] | join(",")')
check "page 2" "$(req "$Q&limit=2&cursor=$NEXT")$(J '.data | length')" "2002"
P2=$(J '[.data[].id] | join(",")')
check "pages don't overlap" "$([ "$P1" != "$P2" ] && echo ok)" ok
NEXT=$(J .meta.next_cursor)
check "last page" "$(req "$Q&limit=2&cursor=$NEXT")$(J '.data | length')$(J .meta.next_cursor)" "2001null"
check "bad cursor 400" $(req "$Q&cursor=garbage") 400
check "company open_vacancies" "$(req $API/companies/$CSLUG)$(J .data.open_vacancies)" "2005"

echo "== company directory (TZ BE-03: trigger-kept counter, keyset pages)"
check "directory search 200" $(req "$API/companies?q=najot%20ta%27lim%20$R") 200
check "verified company listed before the unverified one" \
  "$(J "[.data[] | select(.slug==\"$CSLUG\" or .slug==\"$CSLUG-2\") | .slug] | join(\",\")")" "$CSLUG,$CSLUG-2"
check "directory shows the trigger-kept count" "$(J ".data[] | select(.slug==\"$CSLUG\") | .open_vacancies")" "5"
check "directory meta: page, total, page_count" "$(J .meta.page)/$(J '.meta.total >= 2')/$(J '.meta.page_count >= 1')" "1/true/true"
req -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T1" -H "$H" -d "$(echo $V | jq '.title="Vaqtinchalik" | .skills=[]')" >/dev/null
VTMP=$(J .data.id); req -X POST $API/vacancies/$VTMP/submit -H "Authorization: Bearer $T1" >/dev/null
check "publishing bumps open_vacancies" "$(req $API/companies/$CSLUG)$(J .data.open_vacancies)" "2006"
req -X POST $API/vacancies/$VTMP/archive -H "Authorization: Bearer $T1" >/dev/null
check "archiving lowers it" "$(req $API/companies/$CSLUG)$(J .data.open_vacancies)" "2005"
# Numbered pages seek from anchors cached ~3 min; drop them so this run's new companies
# are placed (without redis-cli the comparison can legitimately differ for a few minutes).
redis-cli -p "${REDIS_PORT:-6390}" DEL company:dir:v1:all >/dev/null 2>&1 || true
req "$API/companies?page=1" >/dev/null; DC=$(J .meta.next_cursor); DPC=$(J .meta.page_count)
check "page 1 has ≤ 24 rows" "$([ "$(J '.data | length')" -le 24 ] && echo ok)" ok
if [ "$DC" != "null" ]; then
  check "page 2 by number == page 2 by cursor" "$(curl -s "$API/companies?page=2" | jq -r '[.data[].id]|join(",")')" \
    "$(curl -s "$API/companies?cursor=$DC" | jq -r '[.data[].id]|join(",")')"
else
  check "single page: no next page" "$DPC" "1"
fi
check "page past the end is empty" "$(req "$API/companies?page=9999")$(J '.data | length')$(J .meta.next_page)" "2000null"
check "bad directory cursor 400" "$(req "$API/companies?cursor=garbage")$(J .error.code)" "400invalid_cursor"

echo "== views: beacon + GET, bots skipped (Redis → Postgres flush every minute)"
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
check "beacon 204" $(req -X POST -A "$UA" $API/vacancies/$VSLUG/view) 204
for i in 1 2; do curl -s -o /dev/null -X POST -A "$UA" $API/vacancies/$VID/view; done       # same IP: deduped
curl -s -o /dev/null -A "$UA" $API/vacancies/$VSLUG -H "Authorization: Bearer $T_S"          # cached GET still counts
curl -s -o /dev/null -X POST -A "$UA" $API/vacancies/$VSLUG/view -H "Authorization: Bearer $T1"  # owner: not counted
curl -s -o /dev/null -X POST $API/vacancies/$VSLUG/view -H "Authorization: Bearer $T2"       # curl UA = bot: not counted
curl -s -o /dev/null -X POST -A "Googlebot/2.1 (+http://www.google.com/bot.html)" $API/vacancies/$VSLUG/view -H "Authorization: Bearer $T2"
check "beacon for unknown vacancy 404" $(req -X POST -A "$UA" $API/vacancies/no-such-vacancy-xyz/view) 404
echo "  … waiting for the flush job"
for i in $(seq 1 14); do sleep 5; v=$(curl -s $API/vacancies/$VID -H "Authorization: Bearer $T1" | jq .data.views_count); [ "$v" != "0" ] && break; done
check "views deduped: 1 anon IP + 1 seeker, no owner, no bots" "$v" 2

echo
echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
