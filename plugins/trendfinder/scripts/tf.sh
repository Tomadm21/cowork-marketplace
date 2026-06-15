#!/usr/bin/env bash
# tf.sh — Trendfinder API helper. Usage:
#   tf.sh GET /api/niches/config
#   tf.sh POST /api/schedules '{"niche_id":"acme-beauty","interval_hours":6}'
#   tf.sh POST /api/ingest @/tmp/body.json          # 3rd arg starting with @ sends file body
#   tf.sh DELETE /api/schedules/3
# Reads {base_url, api_key} from .trendfinder/config.json — resolved from
# $TRENDFINDER_CONFIG, else ./.trendfinder/config.json, else walking up
# parent directories. Prints the response body; exit 0 on 2xx, 1 otherwise.
# SECURITY: never echoes the api key, never enables xtrace.
set -euo pipefail

find_config() {
  if [[ -n "${TRENDFINDER_CONFIG:-}" ]]; then echo "$TRENDFINDER_CONFIG"; return; fi
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/.trendfinder/config.json" ]]; then echo "$dir/.trendfinder/config.json"; return; fi
    dir="$(dirname "$dir")"
  done
  return 1
}

CONFIG="$(find_config)" || { echo "tf.sh: no .trendfinder/config.json found (set TRENDFINDER_CONFIG or run inside the workspace)" >&2; exit 1; }
BASE_URL="$(jq -r '.base_url // empty' "$CONFIG")"
API_KEY="$(jq -r '.api_key // empty' "$CONFIG")"
[[ -n "$BASE_URL" && -n "$API_KEY" ]] || { echo "tf.sh: config $CONFIG is missing base_url or api_key" >&2; exit 1; }

METHOD="${1:-}"; ENDPOINT="${2:-}"; BODY="${3:-}"
[[ -n "$METHOD" && -n "$ENDPOINT" ]] || { echo "usage: tf.sh METHOD /api/path ['{json body}' | @/path/to/body.json]" >&2; exit 1; }

ARGS=(-sS -X "$METHOD" -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" -w '\n%{http_code}')
if [[ -n "$BODY" ]]; then
  if [[ "$BODY" == @* ]]; then
    ARGS+=(--data-binary "$BODY")
  else
    ARGS+=(-d "$BODY")
  fi
fi

RESPONSE="$(curl "${ARGS[@]}" "${BASE_URL}${ENDPOINT}")" || { echo "tf.sh: request failed (network/curl)" >&2; exit 1; }
HTTP_CODE="$(printf '%s' "$RESPONSE" | tail -n1)"
BODY_OUT="$(printf '%s' "$RESPONSE" | sed '$d')"
echo "$BODY_OUT"
[[ "$HTTP_CODE" =~ ^2 ]] || { echo "tf.sh: HTTP $HTTP_CODE" >&2; exit 1; }
