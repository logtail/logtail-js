#!/usr/bin/env bash
# Deletes this run's source, then what earlier runs of the same test left behind (a cancelled job never reaches its
# cleanup): every source whose name starts with the prefix and that is older than stale-hours. Younger sources may
# belong to a run still in progress and stay. Writes <out>/cleanup.md, one line per deletion, and always exits 0:
# a failed deletion shows in the report, but never hides the test result.
# Env: INPUT_API_TOKEN, INPUT_PREFIX, INPUT_ID (optional), INPUT_STALE_HOURS (default 3), INPUT_OUT (default out).
set -euo pipefail
# A native jq.exe, as on Windows runners, ends its output lines with CRLF unless given -b.
if [ "${OS:-}" = Windows_NT ]; then jq() { command jq -b "$@"; }; fi

API=https://telemetry.betterstack.com
OUT=${INPUT_OUT:-out}
mkdir -p "$OUT"
: > "$OUT/cleanup.md"
say() { echo "$1"; echo "$1" >> "$OUT/cleanup.md"; }
trap 'status=$?; [ "$status" = 0 ] || say "- ❌ cleanup stopped on an error, see the log of this step"; exit 0' EXIT

delete() {
  local code
  code=$(curl -sS -m 60 -o /dev/null -w '%{http_code}' -X DELETE "$API/api/v1/sources/$1" -H "Authorization: Bearer $INPUT_API_TOKEN") || code=000
  case "$code" in
    204) say "- deleted $2" ;;
    404) say "- $2 was already gone" ;;
    *) say "- ❌ could not delete $2 (HTTP $code)" ;;
  esac
}

say "### Cleanup"
say ""
[ -z "${INPUT_ID:-}" ] || delete "$INPUT_ID" "this run's source $INPUT_ID"

# An empty prefix would sweep every source of the team.
[ -n "$INPUT_PREFIX" ] || { say "- ❌ no prefix given, so stale sources were not looked for"; exit 0; }
# The name filter matches anywhere in the name, so the prefix is checked again. The next-page link the API returns
# drops the filter, so pages are counted here instead of following it.
STALE=""
for ((page = 1; ; page++)); do
  RES=$(curl -sS -m 60 -G "$API/api/v1/sources" --data-urlencode "name=$INPUT_PREFIX" -d per_page=250 -d "page=$page" -H "Authorization: Bearer $INPUT_API_TOKEN") || RES=""
  jq -e '.data | type == "array"' <<<"$RES" >/dev/null 2>&1 || { say "- ❌ could not list sources, so stale ones were not deleted: $(head -c 300 <<<"${RES:-no response}")"; STALE=""; break; }
  STALE+=$(jq -r --arg prefix "$INPUT_PREFIX" --arg id "${INPUT_ID:-}" --argjson hours "${INPUT_STALE_HOURS:-3}" '.data[]
    | select((.attributes.name | startswith($prefix)) and .id != $id)
    | select((.attributes.created_at | sub("\\.[0-9]+"; "") | fromdateiso8601) < now - $hours * 3600)
    | "\(.id) \(.attributes.created_at) \(.attributes.name)"' <<<"$RES")$'\n'
  [ "$(jq -r '.pagination.next' <<<"$RES")" != null ] || break
done
while read -r id created_at name; do
  [ -n "$id" ] || continue
  delete "$id" "stale source $id \`$name\` (created $created_at)"
done <<<"$STALE"

[ "$(wc -l < "$OUT/cleanup.md")" -gt 2 ] || say "- nothing to delete"
