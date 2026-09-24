#!/bin/sh
# Render alertmanager.yml from the environment, keep secrets in files, start Alertmanager.
#   ALERT_TELEGRAM_BOT_TOKEN, ALERT_TELEGRAM_CHAT_ID   the bot (@BotFather) and the chat (a
#                                                      group id is negative, e.g. -1001234567890)
#   ALERT_TELEGRAM_THREAD_ID                           topic in a forum group (optional)
#   ALERT_TELEGRAM_API_URL                             https://api.telegram.org (a mock in drills)
#   ALERT_WATCHDOG_URL                                 healthchecks.io ping URL (optional)
# Without a bot token or chat id alerts are dropped (receiver "null") and this says so.
set -eu
out=/tmp/alertmanager
mkdir -p "$out"
umask 077

receiver=telegram
if [ -z "${ALERT_TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${ALERT_TELEGRAM_CHAT_ID:-}" ]; then
  echo "alertmanager: ALERT_TELEGRAM_BOT_TOKEN / ALERT_TELEGRAM_CHAT_ID not set: alerts are NOT delivered" >&2
  receiver='"null"'
fi
case "${ALERT_TELEGRAM_CHAT_ID:--1}" in
  -[0-9]* | [0-9]*) ;;
  *) echo "alertmanager: ALERT_TELEGRAM_CHAT_ID must be a number" >&2; exit 1 ;;
esac
printf '%s' "${ALERT_TELEGRAM_BOT_TOKEN:-unset}" >"$out/telegram_token"
printf '%s' "${ALERT_TELEGRAM_CHAT_ID:--1}" >"$out/telegram_chat_id"

watchdog=watchdog
if [ -z "${ALERT_WATCHDOG_URL:-}" ]; then watchdog='"null"'; fi
printf '%s' "${ALERT_WATCHDOG_URL:-http://127.0.0.1:9/}" >"$out/watchdog_url"

api=${ALERT_TELEGRAM_API_URL:-https://api.telegram.org}
thread=${ALERT_TELEGRAM_THREAD_ID:-}
sed -e "s#@DEFAULT_RECEIVER@#$receiver#g" \
    -e "s#@WATCHDOG_RECEIVER@#$watchdog#g" \
    -e "s#@TELEGRAM_API_URL@#$api#g" \
    /etc/alertmanager/alertmanager.yml >"$out/alertmanager.yml.tmp"
if [ -n "$thread" ]; then
  sed -i "s#@TELEGRAM_THREAD_ID@#$thread#g" "$out/alertmanager.yml.tmp"
else
  sed -i '/message_thread_id: @TELEGRAM_THREAD_ID@/d' "$out/alertmanager.yml.tmp"
fi
mv "$out/alertmanager.yml.tmp" "$out/alertmanager.yml"
exec /bin/alertmanager "$@"
