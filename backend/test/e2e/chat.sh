#!/usr/bin/env bash
# Phase 5c e2e: conversations, realtime delivery over WebSocket, idempotent sends,
# typing, read receipts, attachments, location, deletion, presence, offline push.
set -u
API=${API:-http://localhost:8090/api/v1}
WS=${WS:-ws://localhost:8090/api/v1/ws}
MP=http://localhost:8025/api/v1
SP=$(mktemp -d); trap 'kill $(jobs -p) 2>/dev/null; rm -rf $SP' EXIT
CTL=${CTL:-./bin/ctl}; WSC=${WSC:-./bin/wsclient}
WORKER_LOG=${WORKER_LOG:?set WORKER_LOG}
pass=0; fail=0
check() { if [ "$2" == "$3" ]; then echo "  ✔ $1"; pass=$((pass+1)); else echo "  ✘ $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
req() { curl -s -o $SP/body.json -w '%{http_code}' "$@"; }
J() { jq -r "$1" $SP/body.json; }
H='Content-Type: application/json'
A() { echo "Authorization: Bearer $1"; }
uuid() { cat /proc/sys/kernel/random/uuid; }
mailcode() { for i in $(seq 1 20); do [ "$(curl -s "$MP/search?query=to:$1" | jq '.messages | length')" -ge 1 ] && break; sleep 0.3; done
  curl -s "$MP/search?query=to:$1" | jq -r '.messages[0].ID' | xargs -I{} curl -s "$MP/message/{}" | jq -r '.Text' | grep -oE '\b[0-9]{6}\b' | head -1; }
user() { local t; t=$(curl -s -X POST $API/auth/register -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\",\"full_name\":\"$3\",\"role\":\"$2\"}" | jq -r .data.access_token)
  c=$(mailcode $1); curl -s -o /dev/null -X POST $API/auth/email/verify -H "$(A $t)" -H "$H" -d "{\"code\":\"$c\"}"; echo $t; }
connect() { # name token → starts a client writing $SP/<name>.events, reading $SP/<name>.frames
  local t; t=$(curl -s -X POST $API/ws/ticket -H "$(A $2)" | jq -r .data.ticket)
  : > $SP/$1.events; : > $SP/$1.frames
  $WSC -url "$WS?ticket=$t" -out $SP/$1.events -in $SP/$1.frames 2>$SP/$1.err & eval "PID_$1=$!"
  for i in $(seq 1 30); do grep -q '"ready"' $SP/$1.events && return; sleep 0.1; done; }
frame() { echo "$2" >> $SP/$1.frames; }
waitev() { # name jq-filter → prints first matching event (waits up to 3 s)
  for i in $(seq 1 30); do local m; m=$(jq -c "select($2)" $SP/$1.events 2>/dev/null | head -1); [ -n "$m" ] && { echo "$m"; return; }; sleep 0.1; done; echo "{}"; }
count() { jq -c "select($2)" $SP/$1.events 2>/dev/null | wc -l | tr -d ' '; }
upload() { # token purpose ctype path → file id
  local size b url args id; size=$(stat -c %s "$4")
  b=$(curl -s -X POST $API/files -H "$(A $1)" -H "$H" -d "{\"purpose\":\"$2\",\"content_type\":\"$3\",\"size\":$size,\"name\":\"$(basename $4)\"}")
  url=$(echo $b | jq -r .data.upload.url); args=(); while IFS= read -r kv; do args+=(-F "$kv"); done < <(echo $b | jq -r '.data.upload.fields | to_entries[] | "\(.key)=\(.value)"')
  curl -s -o /dev/null -X POST "$url" "${args[@]}" -F "file=@$4;type=$3"; id=$(echo $b | jq -r .data.file.id)
  curl -s -o /dev/null -X POST $API/files/$id/complete -H "$(A $1)"; echo $id; }
R=$RANDOM

# --- setup: company with two members, a seeker who applied
TE=$(user "hr$R@example.com" employer "Aziza HR")
TE2=$(user "hr2$R@example.com" employer "Sardor Recruiter")
TS=$(user "cand$R@example.com" seeker "Jasur Toshmatov")
TX=$(user "x$R@example.com" seeker "Stranger")
CID=$(curl -s -X POST $API/companies -H "$(A $TE)" -H "$H" -d "{\"name\":\"Chat Co $R\"}" | jq -r .data.id)
curl -s -o /dev/null -X POST "$API/auth/register" -H "$H" -d "{\"email\":\"adm$R@example.com\",\"password\":\"Secret123\",\"full_name\":\"Admin\",\"role\":\"seeker\"}"; $CTL set-role "adm$R@example.com" admin >/dev/null
TA=$(curl -s -X POST $API/auth/login -H "$H" -d "{\"email\":\"adm$R@example.com\",\"password\":\"Secret123\"}" | jq -r .data.access_token)
curl -s -o /dev/null -X PUT $API/admin/companies/$CID/verification -H "$(A $TA)"
curl -s -o /dev/null -X POST $API/companies/$CID/members -H "$(A $TE)" -H "$H" -d "{\"email\":\"hr2$R@example.com\",\"role\":\"recruiter\"}"
CAT=$(curl -s $API/catalog/categories | jq '.data[0].children[0].id'); REG=$(curl -s $API/catalog/regions | jq '.data[0].id')
V=$(curl -s -X POST $API/companies/$CID/vacancies -H "$(A $TE)" -H "$H" -d '{"title":"Operator","description":"Qo'"'"'ng'"'"'iroqlarga javob berish va mijozlarga maslahat berish.","category_id":'$CAT',"region_id":'$REG',"employment_type":"full_time","work_format":"office","experience":"none","schedule":"shift"}' | jq -r .data.id)
curl -s -o /dev/null -X POST $API/vacancies/$V/submit -H "$(A $TE)"
RID=$(curl -s -X POST $API/resumes -H "$(A $TS)" -H "$H" -d '{"title":"Operator"}' | jq -r .data.id)
APP=$(curl -s -X POST $API/vacancies/$V/applications -H "$(A $TS)" -H "$H" -d "{\"resume_id\":\"$RID\"}" | jq -r .data.id)
EID=$(curl -s $API/me -H "$(A $TE)" | jq -r .data.id); SID=$(curl -s $API/me -H "$(A $TS)" | jq -r .data.id)
curl -s -o /dev/null -X POST $API/me/devices -H "$(A $TE)" -H "$H" -d "{\"token\":\"push-e-$R\",\"platform\":\"android\"}"

echo "== conversations"
check "seeker opens chat" "$(req -X POST $API/applications/$APP/conversation -H "$(A $TS)")$(J .data.side)" "200seeker"
CONV=$(J .data.id)
check "employer opens the same chat" "$(req -X POST $API/applications/$APP/conversation -H "$(A $TE)")$(J '"\(.data.id == "'$CONV'")/\(.data.side)"')" "200true/company"
check "stranger can't open" $(req -X POST $API/applications/$APP/conversation -H "$(A $TX)") 404
check "stranger can't read" $(req $API/conversations/$CONV/messages -H "$(A $TX)") 404

echo "== websocket"
check "no ticket rejected" "$(curl -s -o /dev/null -w '%{http_code}' "$API/ws?ticket=nope")" 401
connect E $TE; connect S $TS; connect E2 $TE2
check "employer connected" "$(count E '.type=="ready"')" 1
T1=$(curl -s -X POST $API/ws/ticket -H "$(A $TS)" | jq -r .data.ticket)
$WSC -url "$WS?ticket=$T1" -out $SP/once.events 2>/dev/null & P=$!; sleep 0.5; kill $P 2>/dev/null
$WSC -url "$WS?ticket=$T1" -out $SP/twice.events 2>$SP/twice.err; check "ticket is single-use" "$(grep -o 'dial failed: [0-9]*' $SP/twice.err)" "dial failed: 401"

echo "== messages"
C1=$(uuid)
check "seeker sends text" "$(req -X POST $API/conversations/$CONV/messages -H "$(A $TS)" -H "$H" -d "{\"client_id\":\"$C1\",\"kind\":\"text\",\"body\":\"Assalomu alaykum! Suhbat qachon bo'ladi?\"}")$(J .data.kind)" "201text"
M1=$(J .data.id)
check "employer gets it live" "$(waitev E '.type=="message.new"' | jq -r .data.body)" "Assalomu alaykum! Suhbat qachon bo'ladi?"
check "other company member too" "$(waitev E2 '.type=="message.new"' | jq -r .data.sender.full_name)" "Jasur Toshmatov"
check "sender's other devices too" "$(waitev S '.type=="message.new"' | jq -r .data.client_id)" "$C1"
check "resend same client_id → same message" "$(req -X POST $API/conversations/$CONV/messages -H "$(A $TS)" -H "$H" -d "{\"client_id\":\"$C1\",\"kind\":\"text\",\"body\":\"dup\"}")$(J .data.id)" "201$M1"
sleep 0.3; check "…and no duplicate event" "$(count E '.type=="message.new"')" 1
check "empty text rejected" $(req -X POST $API/conversations/$CONV/messages -H "$(A $TS)" -H "$H" -d "{\"client_id\":\"$(uuid)\",\"kind\":\"text\",\"body\":\"  \"}") 422
check "employer sees unread 1" "$(req $API/conversations -H "$(A $TE)")$(J ".data[] | select(.id==\"$CONV\") | .unread")" "2001"
check "company member lists it" "$(req $API/conversations -H "$(A $TE2)")$(J "[.data[].id] | index(\"$CONV\") != null")" "200true"
check "unread conversations badge" "$(req $API/conversations/unread-count -H "$(A $TE)")$(J .data.conversations)" "2001"

echo "== typing & read receipts"
frame E "{\"type\":\"typing\",\"conversation_id\":\"$CONV\"}"
check "seeker sees typing" "$(waitev S '.type=="typing"' | jq -r .data.user_id)" "$EID"
check "typer doesn't get own typing" "$(count E '.type=="typing"')" 0
frame E "{\"type\":\"read\",\"conversation_id\":\"$CONV\",\"message_id\":$M1}"
check "seeker gets read receipt" "$(waitev S '.type=="message.read"' | jq -r '"\(.data.user_id)/\(.data.message_id)"')" "$EID/$M1"
check "unread now 0" "$(req $API/conversations -H "$(A $TE)")$(J ".data[] | select(.id==\"$CONV\") | .unread")" "2000"
check "seeker sees it was read" "$(req $API/conversations/$CONV -H "$(A $TS)")$(J .data.read_up_to)" "200$M1"
check "can't read past the end" "$(req -X POST $API/conversations/$CONV/read -H "$(A $TE)" -H "$H" -d '{"message_id":999999999}')$(curl -s $API/conversations/$CONV -H "$(A $TS)" | jq .data.read_up_to)" "204$M1"
frame S "{\"type\":\"typing\",\"conversation_id\":\"00000000-0000-0000-0000-000000000000\"}"
check "typing in a foreign chat → error event" "$(waitev S '.type=="error"' | jq -r .data.frame)" "typing"

echo "== attachments & location"
python3 -c "
import struct,zlib
raw=b''.join(b'\x00'+b'\x10\x80\x40'*8 for _ in range(8)); ch=lambda t,d: struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
open('$SP/p.png','wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',8,8,8,2,0,0,0))+ch(b'IDAT',zlib.compress(raw))+ch(b'IEND',b''))
open('$SP/v.webm','wb').write(bytes.fromhex('1a45dfa39f4286810142f7810142f2810442f381084282847765626d42878104428581021853806701')+b'\x00'*200)
open('$SP/cv.pdf','wb').write(b'%PDF-1.4\n1 0 obj<<>>endobj\n')"
IMG=$(upload $TE chat_image image/png $SP/p.png)
check "image message" "$(req -X POST $API/conversations/$CONV/messages -H "$(A $TE)" -H "$H" -d "{\"client_id\":\"$(uuid)\",\"kind\":\"image\",\"file_id\":\"$IMG\",\"body\":\"Ofis xaritasi\"}")$(J '.data.file.url | contains("X-Amz-Signature")')" "201true"
check "signed image URL works" "$(curl -s -o /dev/null -w '%{http_code}' "$(J .data.file.url)")" 200
check "someone else's file rejected" "$(req -X POST $API/conversations/$CONV/messages -H "$(A $TS)" -H "$H" -d "{\"client_id\":\"$(uuid)\",\"kind\":\"image\",\"file_id\":\"$IMG\"}")$(J .error.code)" "404file_not_found"
VOICE=$(upload $TS chat_voice audio/webm $SP/v.webm)
check "voice message" "$(req -X POST $API/conversations/$CONV/messages -H "$(A $TS)" -H "$H" -d "{\"client_id\":\"$(uuid)\",\"kind\":\"voice\",\"file_id\":\"$VOICE\"}")$(J .data.file.content_type)" "201audio/webm"
PDF=$(upload $TS chat_file application/pdf $SP/cv.pdf)
check "file message downloads as attachment" "$(req -X POST $API/conversations/$CONV/messages -H "$(A $TS)" -H "$H" -d "{\"client_id\":\"$(uuid)\",\"kind\":\"file\",\"file_id\":\"$PDF\"}")$(curl -s -D - -o /dev/null "$(J .data.file.url)" | grep -ci 'content-disposition: attachment')" "2011"
check "voice file can't be sent as image" "$(req -X POST $API/conversations/$CONV/messages -H "$(A $TS)" -H "$H" -d "{\"client_id\":\"$(uuid)\",\"kind\":\"image\",\"file_id\":\"$VOICE\"}")$(J .error.code)" "400file_wrong_purpose"
check "location" "$(req -X POST $API/conversations/$CONV/messages -H "$(A $TE)" -H "$H" -d "{\"client_id\":\"$(uuid)\",\"kind\":\"location\",\"location\":{\"lat\":41.3111,\"lng\":69.2797,\"name\":\"Amir Temur xiyoboni\"}}")$(J .data.location.name)" "201Amir Temur xiyoboni"
LOC=$(J .data.id)
check "bad latitude" $(req -X POST $API/conversations/$CONV/messages -H "$(A $TE)" -H "$H" -d "{\"client_id\":\"$(uuid)\",\"kind\":\"location\",\"location\":{\"lat\":141,\"lng\":69}}") 422

echo "== history & deletion"
check "history newest first" "$(req "$API/conversations/$CONV/messages?limit=2" -H "$(A $TS)")$(J '.data[0].kind')" "200location"
NB=$(J .meta.next_before)
check "page back" "$(req "$API/conversations/$CONV/messages?limit=10&before=$NB" -H "$(A $TS)")$(J '.data | length')" "2003"
check "catch-up after reconnect" "$(req "$API/conversations/$CONV/messages?after=$M1" -H "$(A $TS)")$(J '.data | length')" "2004"
check "can't delete other's message" $(req -X DELETE $API/messages/$LOC -H "$(A $TS)") 404
check "delete own message" $(req -X DELETE $API/messages/$LOC -H "$(A $TE)") 204
check "deletion pushed live" "$(waitev S '.type=="message.deleted"' | jq -r .data.message_id)" "$LOC"
check "deleted message is blanked" "$(req "$API/conversations/$CONV/messages?limit=1" -H "$(A $TS)")$(J '"\(.data[0].deleted)/\(.data[0].location)"')" "200true/null"

echo "== presence & offline push"
frame S "{\"type\":\"watch_presence\",\"user_ids\":[\"$EID\"]}"
check "snapshot: employer online" "$(waitev S '.type=="presence.snapshot"' | jq -r '.data[0].online')" true
check "REST presence" "$(req "$API/ws/presence?ids=$SID" -H "$(A $TE)")$(J '.data[0].online')" "200true"
kill $PID_E 2>/dev/null; wait $PID_E 2>/dev/null
check "employer went offline" "$(waitev S '.type=="presence" and .data.online==false' | jq -r .data.user_id)" "$EID"
curl -s -o /dev/null -X POST $API/conversations/$CONV/messages -H "$(A $TS)" -H "$H" -d "{\"client_id\":\"$(uuid)\",\"kind\":\"text\",\"body\":\"Javobingizni kutyapman\"}"
curl -s -o /dev/null -X POST $API/conversations/$CONV/messages -H "$(A $TS)" -H "$H" -d "{\"client_id\":\"$(uuid)\",\"kind\":\"text\",\"body\":\"Yana bir savol\"}"
sleep 2.5
check "offline employer gets one push" "$(grep 'DEV: push' $WORKER_LOG | grep -c "push-e-$R.*Jasur Toshmatov: yangi xabar")" 1
check "online recruiter gets no push" "$(grep 'DEV: push' $WORKER_LOG | grep -c "hr2$R")" 0

echo
echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
