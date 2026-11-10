#!/usr/bin/env bash
# Two-factor sign-in (TOTP) for admins: enrollment, login challenge, recovery codes,
# replay protection, attempt budget, regenerate and disable. Codes come from `ctl totp`.
# Takes ~2.5 min: steps that need an unused code wait for the next 30-second window.
# GATE_API=http://localhost:8091/api/v1 additionally checks the /admin enrollment gate
# against an API started with ADMIN_2FA_REQUIRED=true.
set -u
API=${API:-http://localhost:8090/api/v1}
SP=$(mktemp -d); trap "rm -rf $SP" EXIT
CTL=${CTL:-./bin/ctl}
pass=0; fail=0
check() { if [ "$2" == "$3" ]; then echo "  ✔ $1"; pass=$((pass+1)); else echo "  ✘ $1 (got '$2', want '$3')"; fail=$((fail+1)); fi; }
req() { curl -s -o $SP/body.json -w '%{http_code}' "$@"; }
J() { jq -r "$1" $SP/body.json; }
H='Content-Type: application/json'
register() { curl -s -X POST $API/auth/register -H "$H" -d "{\"email\":\"$1\",\"password\":\"Secret123\",\"full_name\":\"User $2\",\"role\":\"$2\"}" | jq -r .data.access_token; }
login_req() { req -X POST $API/auth/login -H "$H" -H "X-Client-Type: android" -d "{\"email\":\"$1\",\"password\":\"Secret123\"}"; }
next_window() { sleep $(( 31 - $(date +%s) % 30 )); }   # a code from a step not used yet
code() { $CTL totp "$SECRET"; }
# Wrong answers on purpose add up in the per-user budget (10 per 15 min); start fresh.
reset_budget() { docker exec ${REDIS_CONTAINER:-jobvacancy-dev-redis-1} sh -c "redis-cli --scan --pattern 'mfa:fail:*' | xargs -r redis-cli del" >/dev/null; }

R=$RANDOM
ADM="tfa$R@example.com"; SEEK="tfaseek$R@example.com"
T_S=$(register $SEEK seeker)
T_A=$(register $ADM seeker); $CTL set-role $ADM admin >/dev/null
check "admin without 2FA signs in directly" "$(login_req $ADM)" 200
T_A=$(J .data.access_token)
login_req $ADM >/dev/null; T_OLD=$(J .data.access_token)   # a second session, from before 2FA
AUTH="Authorization: Bearer $T_A"

echo "== enrollment"
check "seekers can't enroll" "$(req -X POST $API/me/two-factor/setup -H "Authorization: Bearer $T_S")" 403
check "  code" "$(J .error.code)" two_factor_admins_only
check "status before" "$(req $API/me/two-factor -H "$AUTH")" 200
check "  off" "$(J '.data.enabled')" false
check "setup" "$(req -X POST $API/me/two-factor/setup -H "$AUTH")" 200
SECRET=$(J .data.secret)
check "  otpauth uri" "$(J '.data.otpauth_uri | startswith("otpauth://totp/")')" true
check "  pending" "$(curl -s $API/me/two-factor -H "$AUTH" | jq -r .data.pending)" true
check "confirm with a wrong code" "$(req -X POST $API/me/two-factor/confirm -H "$AUTH" -H "$H" -d '{"code":"000000"}')" 400
check "  code" "$(J .error.code)" two_factor_code_invalid
check "confirm" "$(req -X POST $API/me/two-factor/confirm -H "$AUTH" -H "$H" -d "{\"code\":\"$(code)\"}")" 200
check "  10 recovery codes" "$(J '.data.recovery_codes | length')" 10
RC1=$(J '.data.recovery_codes[0]'); RC2=$(J '.data.recovery_codes[1]')
check "  this session counts as verified" "$(curl -s $API/me/two-factor -H "$AUTH" | jq -r .data.session_verified)" true
check "  the older session is signed out" "$(req $API/me -H "Authorization: Bearer $T_OLD")" 401
check "setup again refused" "$(req -X POST $API/me/two-factor/setup -H "$AUTH")" 409
check "  code" "$(J .error.code)" two_factor_already_enabled
check "status: on, 10 left" "$(curl -s $API/me/two-factor -H "$AUTH" | jq -r '"\(.data.enabled) \(.data.recovery_codes_left)"')" "true 10"

echo "== sign-in challenge"
check "password alone: 202" "$(login_req $ADM)" 202
check "  no session yet" "$(J '"\(.data.two_factor_required) \(.data.access_token // "none")"')" "true none"
CH=$(J .data.challenge_token)
check "code and recovery code together" "$(req -X POST $API/auth/two-factor/verify -H "$H" -d "{\"challenge_token\":\"$CH\",\"code\":\"123456\",\"recovery_code\":\"abcde-fghij\"}")" 422
check "code and recovery code both missing" "$(req -X POST $API/auth/two-factor/verify -H "$H" -d "{\"challenge_token\":\"$CH\"}")" 422
check "wrong code" "$(req -X POST $API/auth/two-factor/verify -H "$H" -d "{\"challenge_token\":\"$CH\",\"code\":\"123456\"}")" 400
check "replayed code (step used by confirm)" "$(req -X POST $API/auth/two-factor/verify -H "$H" -d "{\"challenge_token\":\"$CH\",\"code\":\"$(code)\"}")" 400
check "recovery code (any case, with dash)" "$(req -X POST $API/auth/two-factor/verify -H "$H" -H "X-Client-Type: android" -d "{\"challenge_token\":\"$CH\",\"recovery_code\":\"${RC1^^}\"}")" 200
check "  session issued" "$(J '.data.access_token | length > 20')" true
check "challenge is single use" "$(req -X POST $API/auth/two-factor/verify -H "$H" -d "{\"challenge_token\":\"$CH\",\"recovery_code\":\"$RC2\"}")" 401
check "  code" "$(J .error.code)" two_factor_challenge_invalid
login_req $ADM >/dev/null; CH=$(J .data.challenge_token)
check "used recovery code refused" "$(req -X POST $API/auth/two-factor/verify -H "$H" -d "{\"challenge_token\":\"$CH\",\"recovery_code\":\"$RC1\"}")" 400
check "9 recovery codes left" "$(curl -s $API/me/two-factor -H "$AUTH" | jq -r .data.recovery_codes_left)" 9

echo "== attempt budget"
login_req $ADM >/dev/null; CH2=$(J .data.challenge_token)
for i in 1 2 3 4 5; do req -X POST $API/auth/two-factor/verify -H "$H" -d "{\"challenge_token\":\"$CH2\",\"code\":\"11111$i\"}" >/dev/null; done
check "6th try ends the challenge" "$(req -X POST $API/auth/two-factor/verify -H "$H" -d "{\"challenge_token\":\"$CH2\",\"code\":\"111116\"}")" 401
check "invalid challenge token" "$(req -X POST $API/auth/two-factor/verify -H "$H" -d '{"challenge_token":"nope","code":"123456"}')" 401

echo "== TOTP sign-in (next window)"
next_window
check "fresh code completes sign-in" "$(req -X POST $API/auth/two-factor/verify -H "$H" -H "X-Client-Type: android" -d "{\"challenge_token\":\"$CH\",\"code\":\"$(code)\"}")" 200
T_A2=$(J .data.access_token); R_A2=$(J .data.refresh_token)
check "  works on /me" "$(req $API/me -H "Authorization: Bearer $T_A2")" 200
check "  session verified" "$(curl -s $API/me/two-factor -H "Authorization: Bearer $T_A2" | jq -r .data.session_verified)" true
check "  refresh keeps it verified" "$(req -X POST $API/auth/refresh -H "$H" -H "X-Client-Type: android" -d "{\"refresh_token\":\"$R_A2\"}")" 200
T_A2=$(J .data.access_token)
check "  …on the new token" "$(curl -s $API/me/two-factor -H "Authorization: Bearer $T_A2" | jq -r .data.session_verified)" true

echo "== regenerate recovery codes"
reset_budget
check "wrong password" "$(req -X POST $API/me/two-factor/recovery-codes -H "$AUTH" -H "$H" -d '{"password":"Nope12345","code":"123456"}')" 400
check "  one code for any failure" "$(J .error.code)" reauth_failed
check "wrong code" "$(req -X POST $API/me/two-factor/recovery-codes -H "$AUTH" -H "$H" -d '{"password":"Secret123","code":"123456"}')" 400
check "  same code" "$(J .error.code)" reauth_failed
check "code and recovery code together" "$(req -X POST $API/me/two-factor/recovery-codes -H "$AUTH" -H "$H" -d '{"password":"Secret123","code":"123456","recovery_code":"abcde-fghij"}')" 422
next_window
check "regenerate" "$(req -X POST $API/me/two-factor/recovery-codes -H "$AUTH" -H "$H" -d "{\"password\":\"Secret123\",\"code\":\"$(code)\"}")" 200
check "  10 new codes" "$(J '.data.recovery_codes | length')" 10
check "  old codes gone" "$(curl -s $API/me/two-factor -H "$AUTH" | jq -r .data.recovery_codes_left)" 10

echo "== admin gate"
if [ -n "${GATE_API:-}" ]; then
  T_N=$(register "tfanew$R@example.com" seeker); $CTL set-role "tfanew$R@example.com" admin >/dev/null
  T_N=$(curl -s -X POST $GATE_API/auth/login -H "$H" -d "{\"email\":\"tfanew$R@example.com\",\"password\":\"Secret123\"}" | jq -r .data.access_token)
  check "admin without 2FA blocked from /admin" "$(req $GATE_API/admin/stats -H "Authorization: Bearer $T_N")" 403
  check "  code" "$(J .error.code)" two_factor_setup_required
  check "admin with 2FA, verified session, passes" "$(req $GATE_API/admin/stats -H "Authorization: Bearer $T_A2")" 200
else
  echo "  (skipped: set GATE_API to an API with ADMIN_2FA_REQUIRED=true)"
fi

echo "== disable with a recovery code (lost phone)"
RC3=$(curl -s -X POST $API/me/two-factor/recovery-codes -H "$AUTH" -H "$H" -d "{\"password\":\"Secret123\",\"code\":\"$(next_window; code)\"}" | jq -r '.data.recovery_codes[0]')
check "disable" "$(req -X POST $API/me/two-factor/disable -H "$AUTH" -H "$H" -d "{\"password\":\"Secret123\",\"recovery_code\":\"$RC3\"}")" 204
check "  status off" "$(curl -s $API/me/two-factor -H "$AUTH" | jq -r .data.enabled)" false
check "  other sessions signed out" "$(req $API/me -H "Authorization: Bearer $T_A2")" 401
check "  this one kept" "$(req $API/me -H "$AUTH")" 200
check "  password alone signs in again" "$(login_req $ADM)" 200

echo "== operator commands (ctl two-factor)"
OPS="tfaops$R@example.com"; register $OPS seeker >/dev/null
check "enroll refuses non-admins" "$($CTL two-factor enroll $OPS >/dev/null 2>&1; echo $?)" 1
$CTL set-role $OPS admin >/dev/null
OUT=$($CTL two-factor enroll $OPS 2>$SP/audit.log)
SECRET=$(echo "$OUT" | awk '/key:/ {print $2}')
check "enroll prints the otpauth URI" "$(echo "$OUT" | grep -c 'otpauth://totp/')" 1
check "  and 10 recovery codes" "$(echo "$OUT" | grep -cE '^  [a-z0-9]{5}-[a-z0-9]{5}$')" 10
check "  audit line, without the secret" "$(grep -c 'two-factor enrolled' $SP/audit.log) $(grep -c "$SECRET" $SP/audit.log)" "1 0"
check "again without --force refused" "$($CTL two-factor enroll $OPS >/dev/null 2>&1; echo $?)" 1
check "password now asks for a code" "$(login_req $OPS)" 202
CH=$(J .data.challenge_token)
check "  the printed key works" "$(req -X POST $API/auth/two-factor/verify -H "$H" -d "{\"challenge_token\":\"$CH\",\"code\":\"$(code)\"}")" 200
T_OPS=$(J .data.access_token)
check "reset" "$($CTL two-factor reset $OPS 2>/dev/null | grep -c 'turned off')" 1
check "  sessions signed out" "$(req $API/me -H "Authorization: Bearer $T_OPS")" 401
check "  password alone signs in" "$(login_req $OPS)" 200

echo; echo "passed: $pass  failed: $fail"; [ $fail -eq 0 ]
