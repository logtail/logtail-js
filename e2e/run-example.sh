#!/usr/bin/env bash
# Loads or runs one flavour's example project the way its README tells a customer to. The output goes to
# out/<command>.log as well, and a failure ends with one ::error:: line giving the reason.
#   e2e/run-example.sh load   checks that the installed client loads, before a source is created for nothing
#   e2e/run-example.sh run    runs the example, which sends its logs to BETTER_STACK_INGESTING_HOST with
#                             BETTER_STACK_SOURCE_TOKEN, and fails when it exits non-zero
# Env: FLAVOUR (node, bun, winston, pino, bunyan, koa, browser or edge), EXAMPLE (its directory), and for run
#      BETTER_STACK_SOURCE_TOKEN, BETTER_STACK_INGESTING_HOST, CHROME (browser: the Chrome executable) and
#      COMPATIBILITY_DATE (edge: the date the Worker runs with).
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=$ROOT/out
LOG=$OUT/$1.log
mkdir -p "$OUT"
cd "$ROOT/$EXAMPLE"

# The first line of the log that says what went wrong, or its last line.
fail() {
  local reason
  reason=$(grep -m 1 -E 'Error|error|Not all logs' "$LOG" || tail -n 1 "$LOG")
  reason=${reason:-see the log of this step}
  echo "::error::$1: ${reason:0:300}"
  exit 1
}

# Waits up to 60 s for process $2 ($1) to print $3, its line saying it listens. A request would wait as well, but
# every request is logged and the rows are counted.
wait_for_line() {
  for _ in $(seq 60); do
    if grep -q "$3" "$LOG"; then return; fi
    kill -0 "$2" 2> /dev/null || { cat "$LOG"; fail "$1 exited before it listened"; }
    sleep 1
  done
  cat "$LOG"
  fail "$1 did not print \"$3\" within 60 s"
}

case "$1" in
  load)
    case "$FLAVOUR" in
      node) node -e 'require("@logtail/js")' > "$LOG" 2>&1 || fail "@logtail/js does not load on $(node -v)" ;;
      bun) bun -e 'require("@logtail/js")' > "$LOG" 2>&1 || fail "@logtail/js does not load on Bun $(bun --version)" ;;
      winston | pino | bunyan | koa)
        node -e "require('$FLAVOUR'); require('@logtail/$FLAVOUR')" > "$LOG" 2>&1 || fail "@logtail/$FLAVOUR does not load on $(node -v)" ;;
      # The bundle a script tag loads defines window.Logtail.
      browser)
        node -e 'globalThis.window = globalThis.self = globalThis; require("./node_modules/@logtail/browser/dist/umd/logtail.js");
          if (typeof window.Logtail !== "function") throw new Error("dist/umd/logtail.js defines no window.Logtail")' > "$LOG" 2>&1 \
          || fail "@logtail/browser's dist/umd/logtail.js does not load" ;;
      # wrangler bundles the Worker as it would deploy it, which resolves its imports.
      edge) npx wrangler deploy --dry-run --outdir "$OUT/worker" > "$LOG" 2>&1 || fail "wrangler cannot bundle the Worker" ;;
    esac
    cat "$LOG"
    ;;

  run)
    case "$FLAVOUR" in
      node | winston | pino | bunyan) node index.js 2>&1 | tee "$LOG" || fail "The example failed" ;;
      bun) bun index.js 2>&1 | tee "$LOG" || fail "The example failed" ;;
      # A server: one request, then the stop signal, on which it sends what is left and exits.
      koa)
        PORT=3000 node index.js > "$LOG" 2>&1 &
        PID=$!
        wait_for_line "The Koa app" "$PID" "Listening on"
        curl -sS -m 10 --fail-with-body http://127.0.0.1:3000/ | tee "$OUT/response.txt" || fail "The Koa app did not answer"
        echo
        kill -TERM "$PID"
        STATUS=0
        wait "$PID" || STATUS=$?
        cat "$LOG"
        [ "$STATUS" = 0 ] || fail "The Koa app exited with $STATUS"
        ;;
      browser) node "$ROOT/e2e/browser/run.mjs" 2>&1 | tee "$LOG" || fail "The page failed" ;;
      # The Worker under workerd, Cloudflare's runtime, as wrangler dev runs it locally: one request, a few seconds
      # for the logs it sends after its response (ctx.waitUntil), then wrangler stops.
      edge)
        printf 'BETTER_STACK_SOURCE_TOKEN=%s\nBETTER_STACK_INGESTING_HOST=%s\n' "$BETTER_STACK_SOURCE_TOKEN" "$BETTER_STACK_INGESTING_HOST" > .dev.vars
        NO_COLOR=1 npx wrangler dev --ip 127.0.0.1 --port 8787 --compatibility-date "$COMPATIBILITY_DATE" --show-interactive-dev-session=false > "$LOG" 2>&1 &
        PID=$!
        wait_for_line "wrangler dev" "$PID" "Ready on"
        curl -sS -m 30 --fail-with-body http://127.0.0.1:8787/ | tee "$OUT/response.txt" || fail "The Worker did not answer"
        sleep 5
        kill -TERM "$PID"
        wait "$PID" || true
        rm -f .dev.vars
        cat "$LOG"
        # The client prints a send Better Stack rejected, as no caller is left to see it, and wrangler marks it.
        if grep -q '\[ERROR\]' "$LOG"; then fail "The Worker logged an error"; fi
        ;;
    esac
    ;;

  *) echo "usage: e2e/run-example.sh load|run" >&2; exit 1 ;;
esac
