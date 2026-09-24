#!/usr/bin/env bash
# End-to-end smoke test of the auth flow against a running API + worker + Mailpit.
set -u
API=${API:-http://localhost:8090/api/v1}
MP=http://localhost:8025/api/v1
SP=$(mktemp -d); trap "rm -rf $SP" EXIT
JAR=$SP/cookies.txt
EMAIL="test$RANDOM@example.com"
pass=0; fail=0
check() { if [ "$2" == "$3" ]; then echo "  ✔ $1"; pass=$((pass+1)); else echo "  ✘ $1 (got $2, want $3)"; fail=$((fail+1)); fi; }
req() { curl -s -o $SP/body.json -w '%{http_code}' "$@"; }
mailcode() { sleep 1.5; curl -s "$MP/search?query=to:$EMAIL" | jq -r '.messages[0].ID' | xargs -I{} curl -s "$MP/message/{}" | jq -r '.Text' | grep -oE '\b[0-9]{6}\b' | head -1; }
curl -s -X DELETE $MP/messages >/dev/null

echo "== register"
code=$(req -c $JAR -X POST $API/auth/register -H 'Content-Type: application/json' -H 'Accept-Language: ru-RU' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Secret123\",\"full_name\":\"  Ali   Valiyev \",\"role\":\"seeker\"}")
check "201 created" $code 201
AT=$(jq -r .data.access_token $SP/body.json)
check "no refresh token in web body" "$(jq -r '.data.refresh_token // "none"' $SP/body.json)" none
check "locale from Accept-Language" "$(jq -r .data.user.locale $SP/body.json)" ru
check "name normalized" "$(jq -r .data.user.full_name $SP/body.json)" "Ali Valiyev"
check "refresh cookie set" "$(grep -c jv_refresh $JAR)" 1

echo "== duplicate & validation"
check "duplicate email 409" $(req -X POST $API/auth/register -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"Secret123\",\"full_name\":\"Ali\",\"role\":\"seeker\"}") 409
code=$(req -X POST $API/auth/register -H 'Content-Type: application/json' -d '{"email":"bad","password":"short","full_name":"A","role":"admin"}')
check "validation 422" $code 422
check "fields reported" "$(jq -r '.error.fields | keys | join(",")' $SP/body.json)" "email,full_name,password,role"

echo "== email verification (via worker + Mailpit)"
CODE=$(mailcode)
check "email received with code" "${#CODE}" 6
check "russian subject" "$(curl -s "$MP/search?query=to:$EMAIL" | jq -r '.messages[0].Subject')" "Подтвердите адрес электронной почты"
check "wrong code 400" $(req -X POST $API/auth/email/verify -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"code":"000000"}') 400
check "verify 200" $(req -X POST $API/auth/email/verify -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d "{\"code\":\"$CODE\"}") 200
check "email_verified=true" "$(jq -r .data.email_verified $SP/body.json)" true
check "resend when verified 409" $(req -X POST $API/auth/email/send-code -H "Authorization: Bearer $AT") 409

echo "== me"
check "GET /me 200" $(req $API/me -H "Authorization: Bearer $AT") 200
check "no token 401" $(req $API/me) 401
check "PATCH /me" $(req -X PATCH $API/me -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"locale":"uz-Cyrl"}') 200
check "locale updated" "$(jq -r .data.locale $SP/body.json)" uz-Cyrl

echo "== refresh rotation (web cookie)"
cp $JAR $SP/old_cookies.txt
check "refresh 200" $(req -b $JAR -c $JAR -X POST $API/auth/refresh) 200
check "old cookie right after -> race 401" $(req -b $SP/old_cookies.txt -X POST $API/auth/refresh) 401
check "race code" "$(jq -r .error.code $SP/body.json)" refresh_race
check "new cookie still works" $(req -b $JAR -c $JAR -X POST $API/auth/refresh) 200
AT=$(jq -r .data.access_token $SP/body.json)

echo "== login (mobile)"
check "wrong password 401" $(req -X POST $API/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"Wrong1234\"}") 401
check "login 200" $(req -X POST $API/auth/login -H 'X-Client-Type: android' -H 'Content-Type: application/json' -d "{\"email\":\"${EMAIL^^}\",\"password\":\"Secret123\"}") 200
MAT=$(jq -r .data.access_token $SP/body.json); MRT=$(jq -r .data.refresh_token $SP/body.json)
check "refresh token in mobile body" "${#MRT}" 43
check "mobile refresh 200" $(req -X POST $API/auth/refresh -H 'X-Client-Type: android' -H 'Content-Type: application/json' -d "{\"refresh_token\":\"$MRT\"}") 200
MAT=$(jq -r .data.access_token $SP/body.json)

echo "== phone via Telegram (dev: code in api log)"
check "invalid phone 422" $(req -X POST $API/auth/phone/send-code -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d '{"phone":"123"}') 422
PHONE="+99890$(printf '%07d' $RANDOM)"
check "send code 202" $(req -X POST $API/auth/phone/send-code -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d "{\"phone\":\"${PHONE:4}\"}") 202
check "normalized to E.164" "$(jq -r .data.phone $SP/body.json)" "$PHONE"
check "cooldown 429" $(req -X POST $API/auth/phone/send-code -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\"}") 429
PCODE=$(grep "phone=$PHONE" "${API_LOG:?set API_LOG to the API log file}" | tail -1 | grep -oE 'code=[0-9]{6}' | cut -d= -f2)
check "verify phone 200" $(req -X POST $API/auth/phone/verify -H "Authorization: Bearer $AT" -H 'Content-Type: application/json' -d "{\"code\":\"$PCODE\"}") 200
check "phone_verified" "$(jq -r .data.phone_verified $SP/body.json)" true

echo "== sessions & revocation"
check "list sessions 200" $(req $API/me/sessions -H "Authorization: Bearer $AT") 200
check "2 active sessions" "$(jq '.data | length' $SP/body.json)" 2
MSID=$(jq -r '.data[] | select(.platform=="android") | .id' $SP/body.json)
check "revoke mobile session 204" $(req -X DELETE $API/me/sessions/$MSID -H "Authorization: Bearer $AT") 204
check "revoked access token rejected" $(req $API/me -H "Authorization: Bearer $MAT") 401

echo "== password reset"
check "forgot unknown email 204" $(req -X POST $API/auth/password/forgot -H 'Content-Type: application/json' -d '{"email":"nobody@example.com"}') 204
curl -s -X DELETE $MP/messages >/dev/null
check "forgot 204" $(req -X POST $API/auth/password/forgot -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\"}") 204
RCODE=$(mailcode)
check "reset 204" $(req -X POST $API/auth/password/reset -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"code\":\"$RCODE\",\"password\":\"NewSecret456\"}") 204
check "old sessions revoked" $(req $API/me -H "Authorization: Bearer $AT") 401
check "login with new password" $(req -c $JAR -X POST $API/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"NewSecret456\"}") 200
echo "== logout"
check "logout 204" $(req -b $JAR -c $JAR -X POST $API/auth/logout) 204
check "refresh after logout 401" $(req -b $JAR -X POST $API/auth/refresh) 401

echo "== misc"
check "google disabled 503" $(req -X POST $API/auth/google -H 'Content-Type: application/json' -d '{"id_token":"x"}') 503
check "unknown route 404 json" "$(req $API/nope)$(jq -r .error.code $SP/body.json)" 404route_not_found

echo "== change password (TZ BE-12: one statement revokes the other sessions)"
# The auth endpoints allow 30 calls per minute per IP, shared with anything else hitting
# this API from the same address: wait for the window to roll over when it's nearly spent
# (reads the limiter's key; without redis-cli it just continues).
used=$(redis-cli -p "${REDIS_PORT:-6390}" GET rl:auth_ip:127.0.0.1 2>/dev/null); used=${used:-0}
if [ "$used" -ge 26 ]; then
  ms=$(redis-cli -p "${REDIS_PORT:-6390}" PTTL rl:auth_ip:127.0.0.1 2>/dev/null); ms=${ms:-0}
  [ "$ms" -gt 0 ] && echo "  … waiting $(( (ms+999)/1000 ))s for the auth rate-limit window" && sleep $(( (ms+999)/1000 ))
fi
mlogin() { curl -s -X POST $API/auth/login -H 'X-Client-Type: android' -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"NewSecret456\"}" | jq -r .data.access_token; }
PA=$(mlogin); PB=$(mlogin)
check "wrong current password 400" "$(req -X PUT $API/me/password -H "Authorization: Bearer $PA" -H 'Content-Type: application/json' \
  -d '{"current_password":"Nope12345","new_password":"Changed789"}')$(jq -r .error.code $SP/body.json)" "400wrong_password"
check "change password 204" $(req -X PUT $API/me/password -H "Authorization: Bearer $PA" -H 'Content-Type: application/json' \
  -d '{"current_password":"NewSecret456","new_password":"Changed789"}') 204
check "the changing session keeps working" $(req $API/me -H "Authorization: Bearer $PA") 200
check "the other session is cut off at once" $(req $API/me -H "Authorization: Bearer $PB") 401
check "one active session left" "$(req $API/me/sessions -H "Authorization: Bearer $PA")$(jq '.data | length' $SP/body.json)" 2001
echo
echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
