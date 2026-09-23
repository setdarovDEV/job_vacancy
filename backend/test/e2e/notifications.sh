#!/usr/bin/env bash
# Phase 5b e2e: in-app notifications, localized e-mail delivery, Telegram linking,
# settings, devices.
set -u
API=${API:-http://localhost:8090/api/v1}
MP=http://localhost:8025/api/v1
SP=$(mktemp -d); trap "rm -rf $SP" EXIT
CTL=${CTL:-./bin/ctl}
WORKER_LOG=${WORKER_LOG:?set WORKER_LOG to the worker log file}
SECRET=${TELEGRAM_WEBHOOK_SECRET:-dev-webhook-secret}
pass=0; fail=0
check() { if [ "$2" == "$3" ]; then echo "  ✔ $1"; pass=$((pass+1)); else echo "  ✘ $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
req() { curl -s -o $SP/body.json -w '%{http_code}' "$@"; }
J() { jq -r "$1" $SP/body.json; }
H='Content-Type: application/json'
A() { echo "Authorization: Bearer $1"; }
mails() { curl -s "$MP/search?query=to:$1" | jq -r '[.messages[].Subject] | join(" | ")'; }
waitmail() { for i in $(seq 1 20); do [ "$(curl -s "$MP/search?query=to:$1" | jq '.messages | length')" -ge "$2" ] && return; sleep 0.5; done; }
mailcode() { waitmail $1 1; curl -s "$MP/search?query=to:$1" | jq -r '.messages[0].ID' | xargs -I{} curl -s "$MP/message/{}" | jq -r '.Text' | grep -oE '\b[0-9]{6}\b' | head -1; }
user() { local t; t=$(curl -s -X POST $API/auth/register -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\",\"full_name\":\"$3\",\"role\":\"$2\",\"locale\":\"$4\"}" | jq -r .data.access_token)
  c=$(mailcode $1); curl -s -o /dev/null -X POST $API/auth/email/verify -H "$(A $t)" -H "$H" -d "{\"code\":\"$c\"}"
  curl -s -o /dev/null -X DELETE "$MP/search?query=to:$1"; echo $t; }
hook() { curl -s -o /dev/null -w '%{http_code}' -X POST $API/telegram/webhook -H "$H" -H "X-Telegram-Bot-Api-Secret-Token: $1" -d "$2"; }
R=$RANDOM; EE="boss$R@example.com"; ES="seeker$R@example.com"

TE=$(user $EE employer "Bobur Aliyev" uz)
TS=$(user $ES seeker "Nodira Rahimova" ru)
curl -s -o /dev/null -X POST $API/auth/register -H "$H" -d "{\"email\":\"adm$R@example.com\",\"password\":\"Secret123\",\"full_name\":\"Admin\",\"role\":\"seeker\"}"
$CTL set-role "adm$R@example.com" admin >/dev/null
TA=$(curl -s -X POST $API/auth/login -H "$H" -d "{\"email\":\"adm$R@example.com\",\"password\":\"Secret123\"}" | jq -r .data.access_token)
CID=$(curl -s -X POST $API/companies -H "$(A $TE)" -H "$H" -d "{\"name\":\"Samarqand Soft $R\"}" | jq -r .data.id)
BACKEND=$(curl -s $API/catalog/categories | jq '[.data[].children[]?] | .[] | select(.slug=="it-backend") | .id')
TASH=$(curl -s $API/catalog/regions | jq '.data[] | select(.slug=="tashkent-city") | .id')
VAC='{"title":"Python dasturchi","description":"Django va FastAPI bilan backend servislarini ishlab chiqish, testlar yozish.","category_id":'$BACKEND',"region_id":'$TASH',"employment_type":"full_time","work_format":"office","experience":"1_3","schedule":"full_day"}'

echo "== moderation notifications"
V=$(curl -s -X POST $API/companies/$CID/vacancies -H "$(A $TE)" -H "$H" -d "$VAC" | jq -r .data.id)
curl -s -o /dev/null -X POST $API/vacancies/$V/submit -H "$(A $TE)"
curl -s -o /dev/null -X POST $API/admin/vacancies/$V/reject -H "$(A $TA)" -H "$H" -d '{"reason":"Maoshni ko'"'"'rsating"}'
check "rejection notification" "$(req $API/me/notifications -H "$(A $TE)")$(J '.data[0] | "\(.type)/\(.payload.reason)"')" "200vacancy.rejected/Maoshni ko'rsating"
waitmail $EE 1
check "rejection e-mail (uz)" "$(mails $EE)" "Vakansiya rad etildi"
curl -s -o /dev/null -X POST $API/vacancies/$V/submit -H "$(A $TE)"
curl -s -o /dev/null -X POST $API/admin/vacancies/$V/approve -H "$(A $TA)"
check "approval notification" "$(req $API/me/notifications -H "$(A $TE)")$(J '.data[0].type')" "200vacancy.approved"
check "unread count 2" "$(req $API/me/notifications/unread-count -H "$(A $TE)")$(J .data.unread)" "2002"
check "mark all read" "$(req -X POST $API/me/notifications/read -H "$(A $TE)" -H "$H" -d '{}')$(curl -s $API/me/notifications/unread-count -H "$(A $TE)" | jq .data.unread)" "2040"

echo "== telegram linking"
check "settings default" "$(req $API/me/notification-settings -H "$(A $TE)")$(J '"\(.data.email)/\(.data.telegram)/\(.data.telegram_linked)"')" "200true/true/false"
check "link url" "$(req -X POST $API/me/telegram/link -H "$(A $TE)")$(J '.data.url | startswith("https://t.me/")')" "200true"
TOKEN=$(J '.data.url' | sed 's/.*start=//')
CHAT=$((700000000 + R))
MSG() { echo "{\"update_id\":1,\"message\":{\"text\":\"$1\",\"chat\":{\"id\":$CHAT,\"type\":\"private\"},\"from\":{\"language_code\":\"uz\"}}}"; }
check "forged webhook rejected" "$(hook wrong "$(MSG "/start $TOKEN")")" 401
check "webhook /start token" "$(hook $SECRET "$(MSG "/start $TOKEN")")" 200
check "linked" "$(req $API/me/notification-settings -H "$(A $TE)")$(J .data.telegram_linked)" "200true"
check "token is single-use" "$(hook $SECRET "$(MSG "/start $TOKEN")")$(grep -c "chat_id=$CHAT.*Havola eskirgan" "${API_LOG:?set API_LOG}")" "2001"

echo "== application notifications"
RID=$(curl -s -X POST $API/resumes -H "$(A $TS)" -H "$H" -d '{"title":"Python developer","skills":["Python"]}' | jq -r .data.id)
curl -s -o $SP/app.json -X POST $API/vacancies/$V/applications -H "$(A $TS)" -H "$H" -d "{\"resume_id\":\"$RID\"}"; APP=$(jq -r .data.id $SP/app.json)
check "employer: new application" "$(req $API/me/notifications -H "$(A $TE)")$(J '.data[0] | "\(.type)/\(.payload.candidate_name)"')" "200application.new/Nodira Rahimova"
waitmail $EE 3
check "employer e-mail (uz)" "$(mails $EE | grep -c 'Yangi ariza')" 1
sleep 1
check "employer telegram (dev log)" "$(grep 'DEV: telegram message' $WORKER_LOG | grep -c "chat_id=$CHAT.*Yangi ariza")" 1
curl -s -o /dev/null $API/applications/$APP -H "$(A $TE)"     # opening marks it viewed
check "seeker: viewed" "$(req $API/me/notifications -H "$(A $TS)")$(J '.data[0] | "\(.type)/\(.payload.status)"')" "200application.status/viewed"
waitmail $ES 1
check "seeker e-mail in Russian" "$(mails $ES)" "Ваш отклик: просмотрен"
curl -s -o /dev/null -X PUT $API/applications/$APP/status -H "$(A $TE)" -H "$H" -d '{"status":"interview"}'
waitmail $ES 2
check "interview e-mail" "$(mails $ES | grep -c 'приглашение на собеседование')" 1

echo "== settings"
check "turn e-mail off" "$(req -X PUT $API/me/notification-settings -H "$(A $TS)" -H "$H" -d '{"email":false,"telegram":true}')$(J .data.email)" "200false"
curl -s -o /dev/null -X PUT $API/applications/$APP/status -H "$(A $TE)" -H "$H" -d '{"status":"hired"}'
sleep 2
check "…in-app still arrives" "$(req $API/me/notifications -H "$(A $TS)")$(J '.data[0].payload.status')" "200hired"
check "…but no new e-mail" "$(curl -s "$MP/search?query=to:$ES" | jq '.messages | length')" 2
check "unread only filter" "$(req "$API/me/notifications?unread=true&limit=2" -H "$(A $TS)")$(J '.data | length')" "2002"
N=$(J .meta.next_cursor)
check "cursor page 2" "$(req "$API/me/notifications?unread=true&limit=2&cursor=$N" -H "$(A $TS)")$(J '.data | length')" "2001"
check "/stop unlinks" "$(hook $SECRET "$(MSG /stop)")$(curl -s $API/me/notification-settings -H "$(A $TE)" | jq .data.telegram_linked)" "200false"

echo "== devices"
check "register device" $(req -X POST $API/me/devices -H "$(A $TS)" -H "$H" -d '{"token":"fcm-token-'$R'","platform":"android"}') 204
check "bad platform" $(req -X POST $API/me/devices -H "$(A $TS)" -H "$H" -d '{"token":"x","platform":"nokia"}') 422
check "remove device" $(req -X DELETE $API/me/devices/fcm-token-$R -H "$(A $TS)") 204

echo
echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
