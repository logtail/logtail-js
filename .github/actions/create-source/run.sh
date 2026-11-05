#!/usr/bin/env bash
# Creates a source and warms it up. A fresh source drops what it receives in its first seconds, and every ingest
# process picks up a new token on its own schedule, so one accepted line proves nothing: the source counts as ready
# after 20 probe lines in a row were accepted, plus a short pause to settle. Probe lines carry the message
# "e2e warm-up <source name>", which verify-logs ignores.
# Env: INPUT_API_TOKEN, INPUT_NAME, INPUT_PLATFORM, GITHUB_OUTPUT.
set -euo pipefail
# A native jq.exe, as on Windows runners, ends its output lines with CRLF unless given -b.
if [ "${OS:-}" = Windows_NT ]; then jq() { command jq -b "$@"; }; fi

API=https://telemetry.betterstack.com

BODY=$(jq -nc --arg name "$INPUT_NAME" --arg platform "$INPUT_PLATFORM" '{name: $name, platform: $platform}')
RES=$(curl -sS -m 60 -X POST "$API/api/v1/sources" -H "Authorization: Bearer $INPUT_API_TOKEN" -H 'Content-Type: application/json' -d "$BODY") || true
ID=$(jq -er '.data.id' <<<"$RES" 2>/dev/null) || { echo "::error::creating source $INPUT_NAME failed: ${RES:-no response}"; exit 1; }
TOKEN=$(jq -r '.data.attributes.token' <<<"$RES")
INGESTING_HOST=$(jq -r '.data.attributes.ingesting_host' <<<"$RES")
DATA_REGION=$(jq -r '.data.attributes.data_region' <<<"$RES")
echo "::add-mask::$TOKEN"
{
  echo "id=$ID"
  echo "token=$TOKEN"
  echo "ingesting-host=$INGESTING_HOST"
  echo "data-region=$DATA_REGION"
  echo "collection=t$(jq -r '.data.attributes.team_id' <<<"$RES")_$(jq -r '.data.attributes.table_name' <<<"$RES")"
  echo "connect-host=$DATA_REGION-connect.betterstackdata.com"
} >> "$GITHUB_OUTPUT"
echo "created source $ID \`$INPUT_NAME\` in data region $DATA_REGION"

PROBE=$(jq -nc --arg message "e2e warm-up $INPUT_NAME" '{message: $message}')
STREAK=0
DEADLINE=$((SECONDS + 300))
while [ "$STREAK" -lt 20 ]; do
  CODE=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -X POST "https://$INGESTING_HOST/" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$PROBE") || true
  if [ "$CODE" = 202 ]; then STREAK=$((STREAK + 1)); else echo "ingest answered HTTP $CODE after $STREAK accepted in a row"; STREAK=0; fi
  [ "$SECONDS" -lt "$DEADLINE" ] || { echo "::error::ingest did not accept the token of source $ID 20 times in a row within 5 min"; exit 1; }
  sleep 1
done
sleep 15
echo "ingest accepted 20 probe lines in a row, source $ID is ready"
