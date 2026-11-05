#!/usr/bin/env bash
# Installs the @logtail packages an example project uses the way a customer gets them, and proves it.
#   e2e/client.sh pack      packs every @logtail package the example needs, with the packages it depends on, from
#                           packages/ into out/pack, as the Release workflow publishes them (run `yarn build` first)
#   e2e/client.sh install   installs the example's dependencies: the tarballs from out/pack (checkout), or the
#                           newest release of each @logtail package on npm (npm), with the leg's library and wrangler
#   e2e/client.sh check     fails unless the installed @logtail packages are exactly the packed ones, file for file
#                           (checkout), or each the newest release on npm (npm), and the library and wrangler are
#                           the planned versions (wrangler with its workerd). Writes what is installed to
#                           out/installed.md
# Env: EXAMPLE (the example's directory, e.g. example-project/winston), CLIENT_FROM (checkout or npm), LIBRARY and
#      LIBRARY_VERSION (the logging library and its version, or empty), WRANGLER and WORKERD (wrangler's version and
#      the workerd it pins, or empty).
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=$ROOT/out
DIR=$ROOT/$EXAMPLE
mkdir -p "$OUT"

# The @logtail packages a package.json depends on, one per line.
logtail_deps() { jq -r '(.dependencies // {}) + (.devDependencies // {}) | keys[] | select(startswith("@logtail/"))' "$1"; }

# The directory under packages/ of the package named $1.
package_dir() {
  for manifest in "$ROOT"/packages/*/package.json; do
    if [ "$(jq -r .name "$manifest")" = "$1" ]; then dirname "$manifest"; return; fi
  done
  echo "::error::no package under packages/ is named $1" >&2
  exit 1
}

# Every installed @logtail package as "<name> <version> <directory>", nested copies included.
installed_logtail() {
  find "$DIR/node_modules" -path '*/node_modules/@logtail/*/package.json' | grep -E '/node_modules/@logtail/[^/]+/package\.json$' | sort \
    | while read -r manifest; do echo "$(jq -r '.name + " " + .version' "$manifest") $(dirname "$manifest")"; done
}

case "$1" in
  pack)
    rm -rf "$OUT/pack" && mkdir -p "$OUT/pack"
    # The example's own @logtail dependencies, and theirs, until nothing new turns up.
    WANTED=$(logtail_deps "$DIR/package.json")
    PACKED=""
    while [ -n "$WANTED" ]; do
      NEXT=""
      for name in $WANTED; do
        case " $PACKED " in *" $name "*) continue ;; esac
        PACKED="$PACKED $name"
        dir=$(package_dir "$name")
        npm pack --silent --pack-destination "$OUT/pack" "$dir" > /dev/null
        NEXT="$NEXT $(logtail_deps "$dir/package.json" | tr '\n' ' ')"
      done
      WANTED=$NEXT
    done
    ls "$OUT/pack"
    ;;

  install)
    cd "$DIR"
    # The job changes the example's package.json in place, as a customer pins a version.
    if [ -n "${LIBRARY:-}" ]; then npm pkg set "dependencies.$LIBRARY=$LIBRARY_VERSION"; fi
    if [ -n "${WRANGLER:-}" ]; then npm pkg set "devDependencies.wrangler=$WRANGLER"; fi
    if [ "$CLIENT_FROM" = checkout ]; then
      # The tarballs become top-level packages, so npm takes them for every @logtail dependency it meets.
      npm install --no-save --no-audit --no-fund "$OUT"/pack/*.tgz
    else
      # Pinned, so that npm cannot quietly keep an older release.
      for name in $(logtail_deps package.json); do npm pkg set "dependencies.$name=$(npm view "$name" version)"; done
      npm install --no-audit --no-fund
    fi
    ;;

  check)
    FAILED=0
    INSTALLED=$(installed_logtail)
    [ -n "$INSTALLED" ] || { echo "::error::no @logtail package is installed in $EXAMPLE"; exit 1; }
    if [ "$CLIENT_FROM" = checkout ]; then
      # Each tarball unpacked into out/unpacked/<package name>/package, the directory npm pack puts it in.
      rm -rf "$OUT/unpacked" && mkdir -p "$OUT/unpacked"
      for tarball in "$OUT"/pack/*.tgz; do
        mkdir -p "$OUT/unpacked/tmp"
        tar -xzf "$tarball" -C "$OUT/unpacked/tmp"
        name=$(jq -r .name "$OUT/unpacked/tmp/package/package.json")
        mkdir -p "$OUT/unpacked/$name"
        mv "$OUT/unpacked/tmp/package" "$OUT/unpacked/$name/package"
      done
    fi
    while read -r name version dir; do
      if [ "$CLIENT_FROM" = checkout ]; then
        if [ ! -d "$OUT/unpacked/$name/package" ]; then
          echo "::error::$name $version in ${dir#"$ROOT"/} was not packed in this job, npm took it from elsewhere."
          FAILED=1
        elif ! diff -r "$OUT/unpacked/$name/package" "$dir" > "$OUT/client.diff"; then
          head -n 20 "$OUT/client.diff"
          echo "::error::$name in ${dir#"$ROOT"/} differs from the tarball packed in this job."
          FAILED=1
        fi
      else
        newest=$(npm view "$name" version)
        if [ "$version" != "$newest" ]; then
          echo "::error::$name $version is installed in ${dir#"$ROOT"/}, but the newest release on npm is $newest."
          FAILED=1
        fi
      fi
    done <<<"$INSTALLED"
    if [ "$CLIENT_FROM" = checkout ]; then FROM="packed here"; else FROM="from npm"; fi
    LINE=$(awk '{ printf "%s%s %s", (NR > 1 ? ", " : ""), $1, $2 }' <<<"$INSTALLED")" $FROM"
    for check in "${LIBRARY:-} ${LIBRARY_VERSION:-}" "${WRANGLER:+wrangler} ${WRANGLER:-}" "${WORKERD:+workerd} ${WORKERD:-}"; do
      read -r name want <<<"$check" || true
      [ -n "$name" ] || continue
      got=$(jq -r .version "$DIR/node_modules/$name/package.json" 2>/dev/null || echo none)
      LINE="$LINE, $name $got"
      if [ "$got" != "$want" ]; then
        echo "::error::$name $got is installed in $EXAMPLE, but the plan asks for $want."
        FAILED=1
      fi
    done
    echo "$LINE" > "$OUT/installed.md"
    echo "$LINE"
    exit "$FAILED"
    ;;

  *) echo "usage: e2e/client.sh pack|install|check" >&2; exit 1 ;;
esac
