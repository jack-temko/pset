#!/usr/bin/env bash
# The loading proof (ideas/skeleton-plan.md, layer B; ideas/skeleton-grill.md
# S6 and S9): starts Vite on a free private port with no API behind it (the
# design page runs on sample data), measures every unit on the loading
# contract, loading against loaded, and stops Vite. Fails on any state whose
# loading form is not its loaded size.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/web"
log="$(mktemp)"

free() { # the first free port in a range
	for p in $(seq "$1" "$2"); do
		ss -ltn "( sport = :$p )" | grep -q ":$p" || {
			echo "$p"
			return
		}
	done
	echo "no free port in $1-$2" >&2
	return 1
}
port="$(free 5190 5199)"

# Its own process group, so stopping it stops Vite and not only npx. A dead
# API target: nothing here may reach a real library.
PSET_API_TARGET=http://127.0.0.1:9 setsid node_modules/.bin/vite \
	--host 127.0.0.1 --port "$port" --strictPort >"$log" 2>&1 &
vite=$!
stop() {
	kill -- "-$vite" 2>/dev/null || kill "$vite" 2>/dev/null || true
	rm -f "$log"
}
trap stop EXIT

up=false
for _ in $(seq 1 120); do
	if ! kill -0 "$vite" 2>/dev/null; then break; fi
	if curl -sf -m 2 "http://127.0.0.1:$port/" >/dev/null; then
		up=true
		break
	fi
	sleep 0.5
done
if [ "$up" != true ]; then
	echo "Vite did not answer on port $port within 60s; its log:" >&2
	cat "$log" >&2
	exit 1
fi

if ! node scripts/loading/check.mjs "http://127.0.0.1:$port" "$@"; then
	echo "Vite's log:" >&2
	tail -n 40 "$log" >&2
	exit 1
fi
