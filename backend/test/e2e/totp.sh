#!/usr/bin/env bash
# Two-factor sign-in (TOTP) for admins: enrollment, login challenge, recovery codes,
# replay protection, attempt budget, regenerate and disable. Codes come from `ctl totp`.
# Takes ~1.5 min: steps that need an unused code wait for the next 30-second window.
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

R=$RANDOM
ADM="tfa$R@example.com"; SEEK="tfaseek$R@example.com"
T_S=$(register $SEEK seeker)
T_A=$(register $ADM seeker); $CTL set-role $ADM admin >/dev/null
check "admin without 2FA signs in directly" "$(login_req $ADM)" 200
T_A=$(J .data.access_token)
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
check "setup again refused" "$(req -X POST $API/me/two-factor/setup -H "$AUTH")" 409
check "  code" "$(J .error.code)" two_factor_already_enabled
check "status: on, 10 left" "$(curl -s $API/me/two-factor -H "$AUTH" | jq -r '"\(.data.enabled) \(.data.recovery_codes_left)"')" "true 10"

echo "== sign-in challenge"
check "password alone: 202" "$(login_req $ADM)" 202
check "  no session yet" "$(J '"\(.data.two_factor_required) \(.data.access_token // "none")"')" "true none"
CH=$(J .data.challenge_token)
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
check "fresh code completes sign-in" "$(req -X POST $API/auth/two-factor/verify -H "$H" -d "{\"challenge_token\":\"$CH\",\"code\":\"$(code)\"}")" 200
T_A2=$(J .data.access_token)
check "  works on /me" "$(req $API/me -H "Authorization: Bearer $T_A2")" 200

echo "== regenerate recovery codes"
check "wrong password" "$(req -X POST $API/me/two-factor/recovery-codes -H "$AUTH" -H "$H" -d '{"password":"Nope12345","code":"123456"}')" 400
check "  code" "$(J .error.code)" wrong_password
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
  check "admin with 2FA passes" "$(req $GATE_API/admin/stats -H "Authorization: Bearer $T_A2")" 200
else
  echo "  (skipped: set GATE_API to an API with ADMIN_2FA_REQUIRED=true)"
fi

echo "== disable"
next_window
check "disable" "$(req -X POST $API/me/two-factor/disable -H "$AUTH" -H "$H" -d "{\"password\":\"Secret123\",\"code\":\"$(code)\"}")" 204
check "  status off" "$(curl -s $API/me/two-factor -H "$AUTH" | jq -r .data.enabled)" false
check "  password alone signs in again" "$(login_req $ADM)" 200

echo; echo "passed: $pass  failed: $fail"; [ $fail -eq 0 ]
