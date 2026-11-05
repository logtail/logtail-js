#!/usr/bin/env bash
# Reads a source's logs back through the team's SQL API connection and checks them against an expected file: as
# many rows as expected, each expected entry matched by exactly one row, no row left unmatched. Rows land in hot
# storage first and are copied to cold storage later, so both are read and a cold row counts only when hot storage
# lacks it. Once enough rows arrived it reads again 30 s later, so a duplicate delivery fails instead of slipping
# through. Writes <out>/rows.json and <out>/summary.md on every exit path: the summary is what a failure report shows.
# Env: INPUT_CONNECTION_USERNAME, INPUT_CONNECTION_PASSWORD, INPUT_CONNECT_HOST, INPUT_COLLECTION, INPUT_EXPECTED,
#      INPUT_OUT (default out), INPUT_DEADLINE_SECONDS (default 300), INPUT_IGNORE_MESSAGE_PREFIX (default "e2e warm-up").
set -euo pipefail
# A native jq.exe, as on Windows runners, ends its output lines with CRLF unless given -b.
if [ "${OS:-}" = Windows_NT ]; then jq() { command jq -b "$@"; }; fi

OUT=${INPUT_OUT:-out}
IGNORE=${INPUT_IGNORE_MESSAGE_PREFIX-e2e warm-up}
# jq: the warm-up lines of create-source, rows whose message starts with the ignore prefix.
IGNORED='def ignored: $ignore != "" and (.raw.message | type) == "string" and (.raw.message | startswith($ignore));'
CHECKS=""
FAILURE=""
COUNTS=""
mkdir -p "$OUT"
echo '[]' > "$OUT/rows.json"

fail() { FAILURE="$1"; echo "::error::$1"; exit 1; }

summarize() {
  local status=$?
  {
    echo "Read back through \`$INPUT_CONNECT_HOST\` from \`$INPUT_COLLECTION\`${COUNTS:+: $COUNTS}"
    echo
    if [ -n "$CHECKS" ]; then printf '%s' "$CHECKS"; else echo "- ❌ ${FAILURE:-stopped on an error, see the log of this step}"; fi
    if [ "$(jq length "$OUT/rows.json")" -gt 0 ]; then
      echo
      echo "<details><summary>One stored row</summary>"
      echo
      echo '```json'
      jq --arg ignore "$IGNORE" "$IGNORED"' (map(select(ignored | not)) | max_by(.raw | keys | length)) // .[0]' "$OUT/rows.json"
      echo '```'
      echo
      echo "</details>"
    fi
  } > "$OUT/summary.md"
  exit "$status"
}
trap summarize EXIT

jq -e 'type == "array" and length > 0 and all(.[]; type == "object" and has("level") and (has("message") or has("message_prefix")))' "$INPUT_EXPECTED" >/dev/null 2>&1 \
  || fail "$INPUT_EXPECTED is not a JSON array of {\"level\", \"message\" or \"message_prefix\", optional \"contains\"} objects"
WANT=$(jq length "$INPUT_EXPECTED")

# Writes the rows as JSONEachRow into $2, or nothing while the collection does not exist: it is created with the
# source's first stored row.
sql() {
  local code
  code=$(curl -sS -m 60 -o "$2" -w '%{http_code}' -u "$INPUT_CONNECTION_USERNAME:$INPUT_CONNECTION_PASSWORD" \
    -H 'Content-Type: plain/text' --data-binary "$1 FORMAT JSONEachRow" "https://$INPUT_CONNECT_HOST/") || code=000
  if [ "$code" = 500 ] && grep -qE 'CLUSTER_DOESNT_EXIST|NAMED_COLLECTION_DOESNT_EXIST|UNKNOWN_TABLE' "$2"; then : > "$2"; return; fi
  [ "$code" = 200 ] || fail "the SQL API on $INPUT_CONNECT_HOST answered HTTP $code: $(head -c 300 "$2" 2>/dev/null)"
}

read_rows() {
  sql "SELECT dt, raw FROM remote(${INPUT_COLLECTION}_logs)" "$OUT/hot.ndjson"
  sql "SELECT dt, raw FROM s3Cluster(primary, ${INPUT_COLLECTION}_s3) WHERE _row_type = 1" "$OUT/cold.ndjson"
  jq -n --slurpfile hot "$OUT/hot.ndjson" --slurpfile cold "$OUT/cold.ndjson" \
    '($hot | map({dt, raw})) as $h | $h + ($cold | map({dt, raw}) | map(select(IN($h[]) | not))) | map(.raw |= fromjson) | sort_by(.dt)' > "$OUT/rows.json"
  local all hot
  all=$(jq length "$OUT/rows.json")
  hot=$(jq -s length "$OUT/hot.ndjson")
  GOT=$(jq --arg ignore "$IGNORE" "$IGNORED"' map(select(ignored | not)) | length' "$OUT/rows.json")
  COUNTS="$hot rows in hot storage, $((all - hot)) more in cold storage, $((all - GOT)) of them ignored as \"$IGNORE\" lines"
}

DEADLINE=$((SECONDS + ${INPUT_DEADLINE_SECONDS:-300}))
while :; do
  read_rows
  [ "$GOT" -lt "$WANT" ] || break
  [ "$SECONDS" -lt "$DEADLINE" ] || { echo "deadline passed with $GOT of $WANT rows"; break; }
  echo "$GOT of $WANT rows so far, reading again in 10 s"
  sleep 10
done
echo "$GOT of $WANT rows, reading once more in 30 s to catch duplicate delivery"
sleep 30
read_rows

# One check per line: the row count, each expected entry (exactly one row matches it), each row no entry matches.
# "contains" is jq's contains: objects and arrays may hold more than expected, strings match as substrings.
RESULT=$(jq -c --arg ignore "$IGNORE" --slurpfile expected "$INPUT_EXPECTED" "$IGNORED"'
  def text: tostring | gsub("\\s+"; " ") | if length > 100 then .[0:100] + "..." else . end;
  def message_matches($e): (.message | type) == "string" and if $e | has("message") then .message == $e.message else .message | startswith($e.message_prefix) end;
  def matches($e): .level == $e.level and message_matches($e) and (($e | has("contains") | not) or contains($e.contains));
  def describe: "`\(.level)` " + (if has("message") then "\"\(.message | text)\"" else "message starting with \"\(.message_prefix | text)\"" end)
    + (if has("contains") then " containing `\(.contains | tojson | text)`" else "" end);
  def near($e): [.[] | select(message_matches($e)) | if .level != $e.level then "a row with this message has level `\(.level)`" else "a row with this message lacks part of what it should contain" end] | unique;
  map(select(ignored | not) | .raw) as $rows | $expected[0] as $expected
  | [{ok: (($rows | length) == ($expected | length)), text: "\($rows | length) rows stored, \($expected | length) expected"}]
  + [$expected[] as $e | ([$rows[] | select(matches($e))] | length) as $n | ($rows | near($e)) as $near
      | {ok: ($n == 1), text: (($e | describe) + if $n == 1 then " stored once" elif $n > 1 then " stored \($n) times"
          elif $near == [] then " missing" else " missing (\($near | join(", ")))" end)}]
  + [$rows[] | select(. as $r | any($expected[]; . as $e | $r | matches($e)) | not) | {ok: false, text: "unexpected row: `\(.level)` \"\(.message | text)\""}]
' "$OUT/rows.json")
CHECKS=$(jq -r '.[] | "- \(if .ok then "✅" else "❌" end) \(.text)"' <<<"$RESULT")$'\n'
printf '%s' "$CHECKS"
PROBLEMS=$(jq -r 'map(select(.ok | not) | .text) | join("; ")' <<<"$RESULT")
[ -z "$PROBLEMS" ] || fail "the stored rows differ from $INPUT_EXPECTED: $PROBLEMS"
echo "every expected row is stored exactly once"
