#!/usr/bin/env bash
# Demo accounts for trying the web app by hand and for browser tests (idempotent):
#   seeker@demo.uz / Secret123   — verified, one public resume, one application
#   hr@demo.uz     / Secret123   — verified, owner of the verified company "Demo Texnologiyalari"
set -eu
API=${API:-http://localhost:8090/api/v1}
MP=http://localhost:8025/api/v1
CTL=${CTL:-./bin/ctl}
H='Content-Type: application/json'
A() { echo "Authorization: Bearer $1"; }
mailcode() { sleep 1.5; curl -s "$MP/search?query=to:$1" | jq -r '.messages[0].ID' | xargs -I{} curl -s "$MP/message/{}" | jq -r '.Text' | grep -oE '\b[0-9]{6}\b' | head -1; }
login() { curl -s -X POST $API/auth/login -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\"}" | jq -r '.data.access_token // empty'; }
account() { # email role name -> token (registers + verifies on first run)
  local t; t=$(login "$1")
  if [ -z "$t" ]; then
    t=$(curl -s -X POST $API/auth/register -H "$H" -d "{\"consent\":true,\"email\":\"$1\",\"password\":\"Secret123\",\"full_name\":\"$3\",\"role\":\"$2\"}" | jq -r .data.access_token)
    c=$(mailcode "$1"); curl -s -o /dev/null -X POST $API/auth/email/verify -H "$(A $t)" -H "$H" -d "{\"code\":\"$c\"}"
  fi
  echo "$t"; }

TE=$(account hr@demo.uz employer "Madina Rahimova")
TS=$(account seeker@demo.uz seeker "Jasur Aliyev")

CID=$(curl -s $API/me/companies -H "$(A $TE)" | jq -r '.data[0].id // empty')
if [ -z "$CID" ]; then
  CID=$(curl -s -X POST $API/companies -H "$(A $TE)" -H "$H" -d '{"name":"Demo Texnologiyalari","size":"51-200","website":"demo.uz","about":"Toshkentdagi mahsulot kompaniyasi. Fintech va logistika uchun servislar quramiz."}' | jq -r .data.id)
  if curl -s -X POST $API/auth/register -H "$H" -d '{"consent":true,"email":"admin@demo.uz","password":"Secret123","full_name":"Demo Admin","role":"seeker"}' >/dev/null; then :; fi
  $CTL set-role admin@demo.uz admin >/dev/null
  TA=$(login admin@demo.uz)
  curl -s -o /dev/null -X PUT $API/admin/companies/$CID/verification -H "$(A $TA)"
fi

CATS=$(curl -s $API/catalog/categories); REGS=$(curl -s $API/catalog/regions)
BACKEND=$(echo "$CATS" | jq '[.data[].children[]?] | .[] | select(.slug=="it-backend") | .id')
TASH=$(echo "$REGS" | jq '.data[] | select(.slug=="tashkent-city") | .id')

VID=$(curl -s "$API/companies/$CID/vacancies" -H "$(A $TE)" | jq -r '.data[0].id // empty')
if [ -z "$VID" ]; then
  for title in "Go backend dasturchi" "Mahsulot dizayneri" "Mijozlar bilan ishlash menejeri"; do
    id=$(curl -s -X POST $API/companies/$CID/vacancies -H "$(A $TE)" -H "$H" -d '{"title":"'"$title"'","description":"Jamoamizga tajribali mutaxassis kerak.\n\nVazifalar:\n- Yangi funksiyalarni ishlab chiqish\n- Jamoa bilan birga rejalashtirish\n- Sifatni nazorat qilish\n\n**Biz taklif qilamiz:** rasmiy ishga joylashish, zamonaviy ofis, o'"'"'qish uchun byudjet.","category_id":'$BACKEND',"region_id":'$TASH',"salary_min":12000000,"salary_max":20000000,"employment_type":"full_time","work_format":"hybrid","experience":"1_3","schedule":"full_day","skills":["Go","PostgreSQL"]}' | jq -r .data.id)
    curl -s -o /dev/null -X POST $API/vacancies/$id/submit -H "$(A $TE)"
    VID=${VID:-$id}
  done
fi

RID=$(curl -s $API/me/resumes -H "$(A $TS)" | jq -r '.data[0].id // empty')
if [ -z "$RID" ]; then
  RID=$(curl -s -X POST $API/resumes -H "$(A $TS)" -H "$H" -d '{"title":"Go dasturchi","about":"Backend tizimlar bo'"'"'yicha 4 yillik tajriba.","category_id":'$BACKEND',"region_id":'$TASH',"desired_salary":18000000,"currency":"UZS","employment_types":["full_time"],"work_formats":["hybrid","remote"],"visibility":"public","experiences":[{"company":"Uzum","position":"Go Engineer","start":"2022-03","end":null,"description":"To'"'"'lov tizimi."}],"educations":[{"institution":"TATU","level":"bachelor","field":"Dasturiy injiniring","start_year":2016,"end_year":2020}],"skills":["Go","PostgreSQL","Docker"],"languages":[{"language":"uz","level":"native"},{"language":"ru","level":"b2"}]}' | jq -r .data.id)
  curl -s -o /dev/null -X POST $API/vacancies/$VID/applications -H "$(A $TS)" -H "$H" -d '{"resume_id":"'$RID'","cover_letter":"Assalomu alaykum! Go bo'"'"'yicha tajribam vakansiyaga mos keladi."}'
fi
echo "seeker@demo.uz / hr@demo.uz (Secret123) ready; company $CID, vacancy $VID, resume $RID"
