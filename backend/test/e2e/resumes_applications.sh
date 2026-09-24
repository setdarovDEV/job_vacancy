#!/usr/bin/env bash
# Phase 4 e2e: resume builder, visibility & contact rules, candidate search, PDF,
# applications pipeline, invitations, bookmarks.
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
user() { # email role verify(yes/no) -> token
  local t; t=$(curl -s -X POST $API/auth/register -H "$H" -d "{\"consent\":true,\"email\":\"$1\",\"password\":\"Secret123\",\"full_name\":\"$4\",\"role\":\"$2\"}" | jq -r .data.access_token)
  if [ "$3" = yes ]; then c=$(mailcode $1); curl -s -o /dev/null -X POST $API/auth/email/verify -H "Authorization: Bearer $t" -H "$H" -d "{\"code\":\"$c\"}"; fi
  echo $t; }
login() { curl -s -X POST $API/auth/login -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\"}" | jq -r .data.access_token; }
A() { echo "Authorization: Bearer $1"; }
R=$RANDOM

# --- setup
TE=$(user "hr$R@example.com" employer yes "HR Manager")
TE2=$(user "other$R@example.com" employer yes "Other HR")
TS=$(user "seeker$R@example.com" seeker yes "Dilnoza Karimova")
TS2=$(user "seeker2$R@example.com" seeker no "Unverified Seeker")
user "adm$R@example.com" seeker no "Admin" >/dev/null; $CTL set-role "adm$R@example.com" admin >/dev/null; TA=$(login "adm$R@example.com")
CID=$(curl -s -X POST $API/companies -H "$(A $TE)" -H "$H" -d "{\"name\":\"Ipak Yoli Tech $R\"}" | jq -r .data.id)
curl -s -o /dev/null -X PUT $API/admin/companies/$CID/verification -H "$(A $TA)"
curl -s -o /dev/null -X POST $API/companies -H "$(A $TE2)" -H "$H" -d "{\"name\":\"Other Co $R\"}"
CATS=$(curl -s $API/catalog/categories); REGS=$(curl -s $API/catalog/regions)
BACKEND=$(echo "$CATS" | jq '[.data[].children[]?] | .[] | select(.slug=="it-backend") | .id')
TASH=$(echo "$REGS" | jq '.data[] | select(.slug=="tashkent-city") | .id')
VAC='{"title":"Go backend dasturchi","description":"Mikroservislar, PostgreSQL, Redis bilan ishlash tajribasi talab qilinadi.","category_id":'$BACKEND',"region_id":'$TASH',"employment_type":"full_time","work_format":"hybrid","experience":"3_6","schedule":"full_day","skills":["Go"]}'
newvac() { local id; id=$(curl -s -X POST $API/companies/$CID/vacancies -H "$(A $TE)" -H "$H" -d "$VAC" | jq -r .data.id); [ "$1" = publish ] && curl -s -o /dev/null -X POST $API/vacancies/$id/submit -H "$(A $TE)"; echo $id; }
V1=$(newvac publish); V2=$(newvac publish); VDRAFT=$(newvac draft)

echo "== resume builder"
RES='{"title":"Go dasturchi '$R'","about":"Backend tizimlar bo'"'"'yicha 7 yillik tajriba.\nYuqori yuklamali servislar.","category_id":'$BACKEND',"region_id":'$TASH',"desired_salary":25000000,"currency":"UZS","employment_types":["full_time"],"work_formats":["remote","hybrid"],"visibility":"public",
 "experiences":[{"company":"Uzum","position":"Senior Go Engineer","start":"2021-06","end":null,"description":"Payments platform."},{"company":"EPAM","position":"Go Developer","start":"2019-01","end":"2021-12","description":"Microservices."}],
 "educations":[{"institution":"TATU","level":"bachelor","field":"Dasturiy injiniring","start_year":2014,"end_year":2018}],
 "skills":["Go","PostgreSQL","Kubernetes"],"languages":[{"language":"uz","level":"native"},{"language":"ru","level":"c1"},{"language":"en","level":"b2"}]}'
check "employer can't create resume" "$(req -X POST $API/resumes -H "$(A $TE)" -H "$H" -d "$RES")$(J .error.code)" "403seeker_only"
check "bad month format 422" "$(req -X POST $API/resumes -H "$(A $TS)" -H "$H" -d "$(echo "$RES" | jq '.experiences[0].start="06/2021"')")" 422
check "end before start 422" "$(req -X POST $API/resumes -H "$(A $TS)" -H "$H" -d "$(echo "$RES" | jq '.experiences[1].end="2018-01"')")$(J .error.fields.experiences)" "422date_range"
check "future start 422" $(req -X POST $API/resumes -H "$(A $TS)" -H "$H" -d "$(echo "$RES" | jq '.experiences[0].start="2099-01"')") 422
check "duplicate language 422" "$(req -X POST $API/resumes -H "$(A $TS)" -H "$H" -d "$(echo "$RES" | jq '.languages += [{"language":"en","level":"c1"}]')")$(J .error.fields.languages)" "422unique"
check "create 201" $(req -X POST $API/resumes -H "$(A $TS)" -H "$H" -d "$RES") 201
RID=$(J .data.id)
WANT=$(( ($(date +%Y)*12 + 10#$(date +%m)) - (2019*12 + 1) + 1 ))
check "overlapping jobs counted once ($WANT months)" "$(J .data.experience_months)" "$WANT"
check "last job = most recent" "$(J '.data.last_job | "\(.position)@\(.company)/\(.current)"')" "Senior Go Engineer@Uzum/true"
check "owner sees contacts" "$(J .data.contacts.email)" "seeker$R@example.com"
check "3 skills, 3 languages" "$(J '"\(.data.skills|length)/\(.data.languages|length)"')" "3/3"
check "my resumes" "$(req $API/me/resumes -H "$(A $TS)")$(J '.data[0].visibility')" "200public"

echo "== visibility & contacts"
check "other employer sees public resume" "$(req $API/resumes/$RID -H "$(A $TE2)")$(J .data.title)" "200Go dasturchi $R"
check "...but not contacts" "$(J .data.contacts)" null
check "another seeker: 404" $(req $API/resumes/$RID -H "$(A $TS2)") 404
check "anonymous: 401" $(req $API/resumes/$RID) 401

echo "== candidate search"
S="$API/resumes?q=$(jq -rn --arg v "dasturchi $R" '$v|@uri')"
has() { J "[.data[].id] | index(\"$RID\") != null"; }
check "found by title" "$(req "$S" -H "$(A $TE2)")$(has)" "200true"
check "cyrillic query 'дастурчи'" "$(req "$API/resumes?q=$(jq -rn --arg v "дастурчи $R" '$v|@uri')" -H "$(A $TE2)")$(has)" "200true"
check "by skill kubernetes" "$(req "$API/resumes?q=kubernetes%20$R" -H "$(A $TE2)")$(has)" "200true"
check "experience=6_plus" "$(req "$S&experience=6_plus" -H "$(A $TE2)")$(has)" "200true"
check "experience=1_3 excludes" "$(req "$S&experience=1_3" -H "$(A $TE2)")$(has)" "200false"
check "language=en" "$(req "$S&language=en" -H "$(A $TE2)")$(has)" "200true"
check "language=de excludes" "$(req "$S&language=de" -H "$(A $TE2)")$(has)" "200false"
check "work_format=office excludes" "$(req "$S&work_format=office" -H "$(A $TE2)")$(has)" "200false"
check "salary_to below desired excludes" "$(req "$S&salary_to=10000000" -H "$(A $TE2)")$(has)" "200false"
check "salary_to above desired" "$(req "$S&salary_to=30000000" -H "$(A $TE2)")$(has)" "200true"
check "no q: newest list" "$(req "$API/resumes?limit=50" -H "$(A $TE2)")$(has)" "200true"
check "seeker can't search" "$(req "$S" -H "$(A $TS)")$(J .error.code)" "403employer_only"
check "card has no contacts" "$(req "$S" -H "$(A $TE2)")$(J '.data[0] | has("contacts")')" "200false"

echo "== PDF"
check "pdf 200" $(curl -s -o $SP/r.pdf -w '%{http_code}' "$API/resumes/$RID/pdf?lang=ru" -H "$(A $TS)") 200
check "is a PDF" "$(head -c 4 $SP/r.pdf)" "%PDF"
if command -v pdftotext >/dev/null; then
  pdftotext $SP/r.pdf $SP/r.txt
  check "russian labels" "$(grep -c 'ОПЫТ РАБОТЫ' $SP/r.txt)" 1
  check "uzbek text kept (bo'yicha)" "$(grep -c "bo'yicha" $SP/r.txt)" 1
  check "contacts printed for owner" "$(grep -c "seeker$R@example.com" $SP/r.txt)" 1
  curl -s -o $SP/e.pdf "$API/resumes/$RID/pdf?lang=uz-Cyrl" -H "$(A $TE2)"; pdftotext $SP/e.pdf $SP/e.txt
  check "cyrillic uzbek labels" "$(grep -c 'ИШ ТАЖРИБАСИ' $SP/e.txt)" 1
  check "no contacts for unlinked employer" "$(grep -c "seeker$R@example.com" $SP/e.txt)" 0
fi

echo "== apply"
check "hide resume" "$(req -X PUT $API/resumes/$RID/visibility -H "$(A $TS)" -H "$H" -d '{"visibility":"hidden"}')$(J .data.visibility)" "200hidden"
check "hidden: not in search" "$(req "$S" -H "$(A $TE2)")$(has)" "200false"
check "hidden: other employer 404" $(req $API/resumes/$RID -H "$(A $TE2)") 404
check "unverified seeker can't apply" "$(req -X POST $API/vacancies/$V1/applications -H "$(A $TS2)" -H "$H" -d "{\"resume_id\":\"$RID\"}")$(J .error.code)" "403verification_required"
check "employer can't apply" "$(req -X POST $API/vacancies/$V1/applications -H "$(A $TE2)" -H "$H" -d "{\"resume_id\":\"$RID\"}")$(J .error.code)" "403seeker_only"
check "draft vacancy closed" "$(req -X POST $API/vacancies/$VDRAFT/applications -H "$(A $TS)" -H "$H" -d "{\"resume_id\":\"$RID\"}")$(J .error.code)" "409vacancy_closed"
check "apply 201" "$(req -X POST $API/vacancies/$V1/applications -H "$(A $TS)" -H "$H" -d "{\"resume_id\":\"$RID\",\"cover_letter\":\"Assalomu alaykum! Ushbu vakansiyaga qiziqaman.\"}")$(J .data.status)" "201sent"
APP=$(J .data.id)
check "apply twice 409" "$(req -X POST $API/vacancies/$V1/applications -H "$(A $TS)" -H "$H" -d "{\"resume_id\":\"$RID\"}")$(J .error.code)" "409already_applied"
check "applications_count" "$(req $API/vacancies/$V1)$(J .data.applications_count)" "2001"
check "hiring company sees the hidden resume it received" "$(req $API/resumes/$RID -H "$(A $TE)")$(J .data.contacts.email)" "200seeker$R@example.com"
check "resume in use can't be deleted" "$(req -X DELETE $API/resumes/$RID -H "$(A $TS)")$(J .error.code)" "409resume_in_use"

echo "== pipeline"
check "stats: 1 sent" "$(req $API/vacancies/$V1/applications/stats -H "$(A $TE)")$(J .data.sent)" "2001"
check "list for vacancy" "$(req $API/vacancies/$V1/applications -H "$(A $TE)")$(J '.data[0].candidate.full_name')" "200Dilnoza Karimova"
check "other company can't list" $(req $API/vacancies/$V1/applications -H "$(A $TE2)") 404
check "employer opens → viewed" "$(req $API/applications/$APP -H "$(A $TE)")$(J .data.status)" "200viewed"
check "events: sent → viewed" "$(J '[.data.events[].to] | join(">")')" "sent>viewed"
check "move to interview with note" "$(req -X PUT $API/applications/$APP/status -H "$(A $TE)" -H "$H" -d '{"status":"interview","note":"Ertaga 10:00 da ofisda"}')$(J .data.status)" "200interview"
check "private note" "$(req -X PUT $API/applications/$APP/note -H "$(A $TE)" -H "$H" -d '{"note":"Kuchli nomzod"}')$(J .data.employer_note)" "200Kuchli nomzod"
check "seeker sees status" "$(req $API/applications/$APP -H "$(A $TS)")$(J .data.status)" "200interview"
check "seeker doesn't see private note" "$(J '.data | has("employer_note")')" false
check "seeker doesn't see internal event notes" "$(J '[.data.events[].note // empty] | length')" 0
check "seeker sees vacancy card" "$(J .data.vacancy.title)" "Go backend dasturchi"
check "stranger 404" $(req $API/applications/$APP -H "$(A $TE2)") 404
check "employer can't set withdrawn" $(req -X PUT $API/applications/$APP/status -H "$(A $TE)" -H "$H" -d '{"status":"withdrawn"}') 422
check "my applications" "$(req $API/me/applications -H "$(A $TS)")$(J '.data[0].vacancy.company.name')" "200Ipak Yoli Tech $R"
check "seeker withdraws" "$(req -X POST $API/applications/$APP/withdraw -H "$(A $TS)")$(J .data.status)" "200withdrawn"
check "withdrawn is final" "$(req -X PUT $API/applications/$APP/status -H "$(A $TE)" -H "$H" -d '{"status":"hired"}')$(J .error.code)" "409invalid_status_transition"
check "filter by status" "$(req "$API/me/applications?status=withdrawn" -H "$(A $TS)")$(J '.data | length')" "2001"

echo "== invitations"
R2=$(curl -s -X POST $API/resumes -H "$(A $TS)" -H "$H" -d "$(echo "$RES" | jq '.title="Golang backend engineer" | .visibility="public"')" | jq -r .data.id)
check "invite to V2" "$(req -X POST $API/resumes/$R2/invite -H "$(A $TE)" -H "$H" -d "{\"vacancy_id\":\"$V2\",\"message\":\"Sizni suhbatga taklif qilamiz!\"}")$(J '"\(.data.status)/\(.data.source)"')" "201invited/invite"
INV=$(J .data.id)
check "invite twice 409" $(req -X POST $API/resumes/$R2/invite -H "$(A $TE)" -H "$H" -d "{\"vacancy_id\":\"$V2\"}") 409
check "seeker sees invitation message" "$(req $API/applications/$INV -H "$(A $TS)")$(J '.data.events[0].note')" "200Sizni suhbatga taklif qilamiz!"
check "other company can't invite to our vacancy" $(req -X POST $API/resumes/$R2/invite -H "$(A $TE2)" -H "$H" -d "{\"vacancy_id\":\"$V2\"}") 403
check "invited candidate's contacts unlocked" "$(req $API/resumes/$R2 -H "$(A $TE)")$(J .data.contacts.email)" "200seeker$R@example.com"

echo "== bookmarks"
check "save 204" $(req -X PUT $API/vacancies/$V1/save -H "$(A $TS)") 204
check "save twice is idempotent" $(req -X PUT $API/vacancies/$V1/save -H "$(A $TS)") 204
check "saved ids" "$(req $API/me/saved-vacancies/ids -H "$(A $TS)")$(J "index(\"$V1\") != null")" "200false"
check "saved ids (data)" "$(J ".data | index(\"$V1\") != null")" true
check "saved list card" "$(req $API/me/saved-vacancies -H "$(A $TS)")$(J '.data[0].id')" "200$V1"
check "can't save draft" $(req -X PUT $API/vacancies/$VDRAFT/save -H "$(A $TS)") 404
check "unsave" "$(req -X DELETE $API/vacancies/$V1/save -H "$(A $TS)")$(curl -s $API/me/saved-vacancies/ids -H "$(A $TS)" | jq '.data | length')" "2040"

echo
echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
