#!/usr/bin/env bash
# Send a Telegram message using the gitignored config/telegram-comms.yaml.
#
# Usage:
#   scripts/notify.sh "your message"
#   echo "your message" | scripts/notify.sh
#
# The YAML file is expected to contain two scalar fields, in any order:
#   bot_token: "..."
#   chat_id:   "..."
#
# Exits 0 on Telegram "ok": true, otherwise non-zero with the API error.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG="${TELEGRAM_CONFIG:-$PROJECT_ROOT/config/telegram-comms.yaml}"

if [ ! -f "$CONFIG" ]; then
  echo "notify.sh: config not found at $CONFIG" >&2
  echo "Copy config/telegram-comms.yaml.example and fill in your credentials." >&2
  exit 2
fi

read_field() {
  # Match `key: "value"` or `key: value` and strip surrounding quotes.
  awk -v key="$1" '
    $0 ~ "^[[:space:]]*"key"[[:space:]]*:" {
      sub("^[[:space:]]*"key"[[:space:]]*:[[:space:]]*", "")
      gsub(/^["'\'']|["'\'']$/, "")
      print
      exit
    }
  ' "$CONFIG"
}

BOT_TOKEN="$(read_field bot_token)"
CHAT_ID="$(read_field chat_id)"

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ]; then
  echo "notify.sh: bot_token or chat_id missing in $CONFIG" >&2
  exit 2
fi

if [ "$#" -ge 1 ]; then
  TEXT="$*"
else
  TEXT="$(cat)"
fi

if [ -z "$TEXT" ]; then
  echo "notify.sh: empty message text" >&2
  exit 2
fi

# Build JSON body without depending on jq: escape backslashes, quotes, newlines.
escape_json() {
  python3 -c 'import json,sys; sys.stdout.write(json.dumps(sys.stdin.read()))'
}

JSON_TEXT="$(printf '%s' "$TEXT" | escape_json)"
PAYLOAD=$(printf '{"chat_id":"%s","text":%s,"parse_mode":"HTML"}' "$CHAT_ID" "$JSON_TEXT")

RESPONSE="$(curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage")"

if printf '%s' "$RESPONSE" | grep -q '"ok":true'; then
  echo "$RESPONSE"
  exit 0
fi

echo "notify.sh: Telegram API returned an error:" >&2
echo "$RESPONSE" >&2
exit 1
