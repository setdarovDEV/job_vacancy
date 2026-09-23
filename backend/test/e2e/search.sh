#!/usr/bin/env bash
# Phase 3 e2e: cross-script full-text search, typos, relevance, pagination, suggest, cache.
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
enc() { jq -rn --arg v "$1" '$v|@uri'; }
mailcode() { sleep 1.5; curl -s "$MP/search?query=to:$1" | jq -r '.messages[0].ID' | xargs -I{} curl -s "$MP/message/{}" | jq -r '.Text' | grep -oE '\b[0-9]{6}\b' | head -1; }
R=$RANDOM; E="search$R@example.com"; A="sadmin$R@example.com"

# --- setup: verified company with vacancies written in different scripts/languages
T=$(curl -s -X POST $API/auth/register -H "$H" -d "{\"email\":\"$E\",\"password\":\"Secret123\",\"full_name\":\"Search Test\",\"role\":\"employer\"}" | jq -r .data.access_token)
c=$(mailcode $E); curl -s -o /dev/null -X POST $API/auth/email/verify -H "Authorization: Bearer $T" -H "$H" -d "{\"code\":\"$c\"}"
curl -s -o /dev/null -X POST $API/auth/register -H "$H" -d "{\"email\":\"$A\",\"password\":\"Secret123\",\"full_name\":\"Admin\",\"role\":\"seeker\"}"
$CTL set-role $A admin >/dev/null
TA=$(curl -s -X POST $API/auth/login -H "$H" -d "{\"email\":\"$A\",\"password\":\"Secret123\"}" | jq -r .data.access_token)
CNAME="Zarafshon Texnologiyalari $R"
CID=$(curl -s -X POST $API/companies -H "Authorization: Bearer $T" -H "$H" -d "{\"name\":\"$CNAME\"}" | jq -r .data.id)
curl -s -o /dev/null -X PUT $API/admin/companies/$CID/verification -H "Authorization: Bearer $TA"

CATS=$(curl -s $API/catalog/categories); REGS=$(curl -s $API/catalog/regions)
cat_id() { echo "$CATS" | jq "[.data[] | .children[]?] | .[] | select(.slug==\"$1\") | .id"; }
reg_id() { echo "$REGS" | jq ".data[] | select(.slug==\"$1\") | .id"; }
TASH=$(reg_id tashkent-city); SAM=$(reg_id samarkand)
post() { # title category region format skills(json) description
  id=$(curl -s -X POST $API/companies/$CID/vacancies -H "Authorization: Bearer $T" -H "$H" -d "$(jq -n \
    --arg t "$1" --argjson c $(cat_id $2) --argjson r $3 --arg f "$4" --argjson s "$5" --arg d "$6" \
    '{title:$t, category_id:$c, region_id:$r, work_format:$f, skills:$s, description:$d, employment_type:"full_time", experience:"1_3", schedule:"full_day", salary_min:5000000, salary_max:12000000}')" | jq -r .data.id)
  curl -s -o /dev/null -X POST $API/vacancies/$id/submit -H "Authorization: Bearer $T"
  echo $id; }
V_GO=$(post "Backend dasturchi (Go)" it-backend $TASH hybrid '["Go","PostgreSQL","Redis"]' "Yuqori yuklamali mikroservislarni ishlab chiqish. Jamoamizga tajribali dasturchi kerak.")
V_ACC=$(post "Бош ҳисобчи" fin-accountant $SAM office '["1C","Microsoft Excel"]' "Корхона бухгалтериясини юритиш, солиқ ҳисоботларини тайёрлаш ва молиявий назорат.")
V_RU=$(post "Менеджер по продажам" sales-manager $TASH office '["CRM","amoCRM"]' "Поиск клиентов, проведение переговоров, выполнение плана продаж. Опыт от года.")
V_EN=$(post "Ingliz tili o'qituvchisi" edu-language $SAM office '[]' "IELTS va umumiy ingliz tili kurslarini olib borish uchun o'qituvchi izlaymiz. Dasturchi emas.")
V_FL=$(post "Flutter developer" it-mobile $TASH remote '["Flutter","Dart"]' "Build beautiful cross-platform mobile apps. Remote position with flexible hours.")
S="$API/vacancies?company_id=$CID"
ids() { J '[.data[].id] | join(",")'; }
first() { J '.data[0].id'; }

echo "== cross-script matching"
check "latin 'dasturchi' → Go vacancy first" "$(req "$S&q=dasturchi")$(first)" "200$V_GO"
check "cyrillic 'дастурчи' → same" "$(req "$S&q=$(enc дастурчи)")$(first)" "200$V_GO"
check "plural 'dasturchilar'" "$(req "$S&q=dasturchilar")$(first)" "200$V_GO"
check "latin 'hisobchi' finds Cyrillic vacancy" "$(req "$S&q=hisobchi")$(ids)" "200$V_ACC"
check "'Бош ҳисобчи' exact script" "$(req "$S&q=$(enc 'бош ҳисобчи')")$(ids)" "200$V_ACC"
check "russian inflection 'продажам'" "$(req "$S&q=$(enc продажам)")$(ids)" "200$V_RU"
check "russian 'менеджера' → prefix stem" "$(req "$S&q=$(enc менеджера)")$(ids)" "200$V_RU"
check "apostrophe variants 'oʻqituvchi'" "$(req "$S&q=$(enc 'oʻqituvchi')")$(first)" "200$V_EN"
check "cyrillic 'ўқитувчи'" "$(req "$S&q=$(enc ўқитувчи)")$(first)" "200$V_EN"

echo "== tags, catalog names, typos"
check "skill 'postgresql'" "$(req "$S&q=postgresql")$(ids)" "200$V_GO"
check "skill in cyrillic-free doc 'amocrm'" "$(req "$S&q=amocrm")$(ids)" "200$V_RU"
check "category name 'savdo' (not in text)" "$(req "$S&q=savdo")$(ids)" "200$V_RU"
check "region 'go toshkent'" "$(req "$S&q=$(enc 'go toshkent')")$(ids)" "200$V_GO"
check "region mismatch 'go samarqand'" "$(req "$S&q=$(enc 'go samarqand')")$(J '.data | length')" "2000"
check "english 'mobile remote'" "$(req "$S&q=$(enc 'mobile remote')")$(ids)" "200$V_FL"
check "typo 'dasturchy' (trigram)" "$(req "$S&q=dasturchy")$(first)" "200$V_GO"
check "typo 'fluter'" "$(req "$S&q=fluter")$(first)" "200$V_FL"
check "company name search" "$(req "$S&q=$(enc "zarafshon $R")")$(J '.data | length')" "2005"
check "stop words only → plain list" "$(req "$S&q=va")$(J '.data | length')" "2005"

echo "== relevance"
req "$S&q=dasturchi" >/dev/null
check "title match outranks body match" "$(J '[.data[].id] | index("'$V_EN'") > index("'$V_GO'")')" true
check "filters combine with q" "$(req "$S&q=dasturchi&region_id=$SAM")$(ids)" "200$V_EN"
check "sort=newest with q" "$(req "$S&q=dasturchi&sort=newest")$(first)" "200$V_EN"
check "invalid sort 422" $(req "$S&q=go&sort=cheapest") 422

echo "== pagination & totals"
Q="$S&q=$(enc "zarafshon $R")&limit=2"
check "page 1" "$(req "$Q")$(J '.data | length')$(J .meta.total)" "20025"
P1=$(ids); N=$(J .meta.next_cursor)
check "page 2" "$(req "$Q&cursor=$N")$(J '.data | length')$(J '.meta.total // "none"')" "2002none"
P2=$(ids); N=$(J .meta.next_cursor)
check "page 3 (last)" "$(req "$Q&cursor=$N")$(J '.data | length')$(J .meta.next_cursor)" "2001null"
P3=$(ids)
check "5 distinct results across pages" "$(echo "$P1,$P2,$P3" | tr , '\n' | sort -u | wc -l | tr -d ' ')" 5
NEWEST=$(curl -s "$S&limit=2" | jq -r .meta.next_cursor)
check "newest cursor rejected for relevance" $(req "$Q&cursor=$NEWEST") 400

echo "== cache"
U="$S&q=dasturchi&work_format=hybrid,office"
req "$U" >/dev/null; A1=$(ids)
U2="$S&q=dasturchi&work_format=office,hybrid"   # same filter, different order
req "$U2" >/dev/null
check "canonical cache key (param order)" "$(ids)" "$A1"
check "cached pages in Redis" "$(docker exec jobvacancy-dev-redis-1 redis-cli --scan --pattern 'vacancy:list:*' | head -1 | cut -c1-13)" "vacancy:list:"

echo "== suggest & popular"
check "suggest titles" "$(req "$API/search/suggest?q=dastur")$(J '[.data.titles[].title] | index("Backend dasturchi (Go)") != null')" "200true"
check "suggest cyrillic prefix" "$(req "$API/search/suggest?q=$(enc ҳисоб)")$(J '[.data.titles[].title] | index("Бош ҳисобчи") != null')" "200true"
check "suggest companies" "$(req "$API/search/suggest?q=$(enc "zarafshon texnologiyalari $R")")$(J '[.data.companies[].id] | index("'$CID'") != null')" "200true"
check "suggest skills" "$(req "$API/search/suggest?q=flut")$(J '.data.skills[0].name')" "200Flutter"
check "suggest empty q" "$(req "$API/search/suggest?q=")$(J '.data.titles | length')" "2000"
docker exec jobvacancy-dev-redis-1 redis-cli del search:popular:top >/dev/null
check "popular searches recorded" "$(req $API/search/popular)$(J '.data | index("dasturchi") != null')" "200true"

echo
echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
