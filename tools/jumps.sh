#!/usr/bin/env bash
# The layout-jump audit end to end: make jumps DATA=<library> [ARGS="--runs 3"]
#
# Copies a library to /tmp/pset-jumps-<topic>/data, starts this branch's server
# and Vite on private ports (never 8420), measures every scenario real and slow
# (web/scripts/jumps), stops both and prints the report's path.
#
# The source library is only read: the database is copied with VACUUM INTO (it
# may be open in a running PSet), the rest with cp -rL, and the saved API keys
# are deleted from the copy before the server starts, so no model call can be
# made. Default DATA is the worktree's .dev/data.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
topic=$(basename "$root"); topic=${topic#pset-}
src=${DATA:-$root/.dev/data}
src=$(cd "$src" && pwd)
run=/tmp/pset-jumps-$topic
stamp=$(date +%Y%m%d-%H%M%S)
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH:/usr/local/go/bin"

[ -f "$src/pset.db" ] || { echo "no library at $src (no pset.db)" >&2; exit 1; }

free() { # first free port in a range
	for p in $(seq "$1" "$2"); do
		ss -ltn "( sport = :$p )" | grep -q ":$p" || { echo "$p"; return; }
	done
	echo "no free port in $1-$2" >&2; exit 1
}

pids=()
stop() {
	for p in ${pids[@]+"${pids[@]}"}; do
		kill -- "-$p" 2>/dev/null || kill "$p" 2>/dev/null || true
	done
}
trap stop EXIT

# The copy: database consistently, files as they are (symlinks followed), no
# logs or backups, no key.
rm -rf "$run/data"
mkdir -p "$run/data" "$run/$stamp"
sqlite3 -readonly "$src/pset.db" "VACUUM INTO '$run/data/pset.db'"
for d in "$src"/*; do
	case $(basename "$d") in pset.db*|logs|backups) continue ;; esac
	cp -rL "$d" "$run/data/"
done
sqlite3 "$run/data/pset.db" "DELETE FROM settings WHERE key IN ('chat', 'embeddings');"

(cd "$root" && go build -o "$run/pset" ./cmd/pset)
[ -d "$root/web/node_modules" ] || (cd "$root/web" && npm ci --silent)

sp=$(free 8430 8499)
vp=$(free 5180 5197)
setsid "$run/pset" -addr "127.0.0.1:$sp" -data "$run/data" -open=false \
	</dev/null >"$run/server.log" 2>&1 & pids+=($!)
for _ in $(seq 50); do
	curl -sf "http://127.0.0.1:$sp/api/settings" -o "$run/settings.json" && break
	sleep 0.2
done
# No key may be set; the response is only tested, never shown.
if [ ! -s "$run/settings.json" ] || ! grep -q '"apiKey":""' "$run/settings.json"; then
	rm -f "$run/settings.json"
	echo "the scratch server has a key or did not start; stopping" >&2
	exit 1
fi
rm -f "$run/settings.json"

(cd "$root/web" && exec env PSET_API_TARGET="http://127.0.0.1:$sp" setsid npx vite --port "$vp" --strictPort) \
	</dev/null >"$run/vite.log" 2>&1 & pids+=($!)
for _ in $(seq 75); do
	curl -sf "http://127.0.0.1:$vp/" >/dev/null && break
	sleep 0.2
done

# shellcheck disable=SC2086
(cd "$root/web" && node scripts/jumps/run.mjs --url "http://127.0.0.1:$vp" --out "$run/$stamp" ${ARGS:-})
echo "report: $run/$stamp/report.md"
