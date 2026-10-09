#!/usr/bin/env bash
# The layout-jump audit end to end: make jumps DATA=<library> [ARGS="--runs 3"]
#
# Copies a library to /tmp/pset-jumps-<topic>/data, starts this branch's server
# and Vite on private ports (never 8420), measures every scenario real and slow
# (web/scripts/jumps), stops both and prints the report's path.
#
# make jumps-check (--check) is the guard: it builds the public fixture library
# (tools/fixturelib) instead of copying one, runs the audit on it, and exits 1 if anything jumps (web/scripts/jumps/check.mjs). It touches no
# library of yours and needs no key. The core profile (the default) measures the
# hand-written scenarios with --runs 2; FULL=1 adds discovery and --runs 3.
#
# The source library is only read: the database is copied with VACUUM INTO (it
# may be open in a running PSet), the rest with cp -rL, and the saved API keys
# are deleted from the copy before the server starts, so no model call can be
# made. SRC=<checkout> builds the server and runs Vite from that checkout (a
# detached worktree of another branch, say) while this worktree's audit
# scripts do the measuring. Default DATA is the test library in ~/.local/share/pset-test-library.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
topic=$(basename "$root")
topic=${topic#pset-}
topic=$(basename "$root"); topic=${topic#pset-}
check=
[ "${1:-}" = "--check" ] && check=1
src=${DATA:-$HOME/.local/share/pset-test-library}
if [ -z "$check" ] && [ ! -d "$src" ]; then
	if [ -n "${DATA:-}" ]; then echo "DATA=$DATA is not a directory" >&2; else echo "no library at $src: make test-library makes it" >&2; fi
	exit 1
fi
[ -n "$check" ] || src=$(cd "$src" && pwd)
run=/tmp/pset-jumps-$topic
stamp=$(date +%Y%m%d-%H%M%S)
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH:/usr/local/go/bin"

[ -f "$src/pset.db" ] || {
	echo "no library at $src (no pset.db)" >&2
	exit 1
}
[ -n "$check" ] || [ -f "$src/pset.db" ] || { echo "no library at $src (no pset.db)" >&2; exit 1; }

free() { # first free port in a range
	for p in $(seq "$1" "$2"); do
		ss -ltn "( sport = :$p )" | grep -q ":$p" || {
			echo "$p"
			return
		}
	done
	echo "no free port in $1-$2" >&2
	exit 1
}

pids=()
stop() {
	for p in ${pids[@]+"${pids[@]}"}; do
		kill -- "-$p" 2>/dev/null || kill "$p" 2>/dev/null || true
	done
}
trap stop EXIT

if [ -n "$check" ]; then
	# The fixture library: built from testdata/ by SQL, no model call.
	data=$run/fixture
	rm -rf "$run/data" "$data"
	mkdir -p "$run/$stamp"
	(cd "$root" && go run ./tools/fixturelib "$data" >/dev/null)
else
	data=$run/data
	# The copy: database consistently, files as they are (symlinks followed), no
	# logs or backups, no key.
	# A read-only source (the test library) gives a read-only copy: open it first.
	[ -e "$run/data" ] && chmod -R u+w "$run/data"
	rm -rf "$run/data"
	mkdir -p "$run/data" "$run/$stamp"
	# A WAL database opened read-only still creates its -shm and -wal when no PSet
	# has it open, so then it is opened immutable, which touches nothing. With a
	# PSet running, -wal exists and the open is a plain read-only one.
	before=$(ls -A "$src")
	uri=${src// /%20}/pset.db
	if [ -e "$src/pset.db-wal" ]; then
		sqlite3 "file:$uri?mode=ro" "VACUUM INTO '$run/data/pset.db'"
	else
		sqlite3 "file:$uri?immutable=1" "VACUUM INTO '$run/data/pset.db'"
	fi
	for d in "$src"/*; do
		case $(basename "$d") in pset.db*|logs|backups) continue ;; esac
		cp -rL "$d" "$run/data/"
	done
	[ "$before" = "$(ls -A "$src")" ] || { echo "the source library's files changed; stopping" >&2; exit 1; }
	chmod -R u+w "$run/data"
	sqlite3 "$run/data/pset.db" "DELETE FROM settings WHERE key IN ('chat', 'embeddings');"
fi
for d in "$src"/*; do
	case $(basename "$d") in pset.db* | logs | backups) continue ;; esac
	cp -rL "$d" "$run/data/"
done
[ "$before" = "$(ls -A "$src")" ] || {
	echo "the source library's files changed; stopping" >&2
	exit 1
}
chmod -R u+w "$run/data"
sqlite3 "$run/data/pset.db" "DELETE FROM settings WHERE key IN ('chat', 'embeddings');"

tree=$root
[ -n "${SRC:-}" ] && tree=$(cd "$SRC" && pwd)
(cd "$tree" && go build -o "$run/pset" ./cmd/pset)
if [ ! -d "$tree/web/node_modules" ]; then
	if [ -n "${SRC:-}" ]; then
		echo "run npm ci in $tree/web first" >&2
		exit 1
	fi
fi
[ -d "$root/web/node_modules" ] || (cd "$root/web" && npm ci --silent)

sp=$(free 8430 8499)
vp=$(free 5180 5197)
setsid "$run/pset" -addr "127.0.0.1:$sp" -data "$run/data" -open=false \
	</dev/null >"$run/server.log" 2>&1 &
pids+=($!)
setsid "$run/pset" -addr "127.0.0.1:$sp" -data "$data" -open=false \
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

(cd "$tree/web" && exec env PSET_API_TARGET="http://127.0.0.1:$sp" setsid npx vite --port "$vp" --strictPort) \
	</dev/null >"$run/vite.log" 2>&1 &
pids+=($!)
for _ in $(seq 75); do
	curl -sf "http://127.0.0.1:$vp/" >/dev/null && break
	</dev/null >"$run/vite.log" 2>&1 & pids+=($!)
up=
for _ in $(seq 300); do
	curl -sf "http://127.0.0.1:$vp/" >/dev/null && { up=1; break; }
	sleep 0.2
done
if [ -z "$up" ]; then
	echo "Vite did not answer on port $vp within 60s; its log:" >&2
	tail -n 30 "$run/vite.log" >&2
	exit 1
fi

args=${ARGS:-}
if [ -n "$check" ] && [ -z "$args" ]; then
	if [ -n "${FULL:-}" ]; then args="--runs 3"; else args="--runs 2 --no-discover"; fi
fi
# shellcheck disable=SC2086
(cd "$root/web" && node scripts/jumps/run.mjs --url "http://127.0.0.1:$vp" --out "$run/$stamp" $args)
echo "report: $run/$stamp/report.md"
if [ -n "$check" ]; then
	(cd "$root/web" && node scripts/jumps/check.mjs "$run/$stamp")
fi
