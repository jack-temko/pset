#!/usr/bin/env bash
# The loading proof (ideas/skeleton-plan.md, layer B): starts Vite on a
# private port with no API behind it (the design page runs on sample data),
# measures every unit on the loading contract, loading against loaded, and
# stops Vite. Fails on any state whose loading form is not its loaded size.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/web"
port="${LOADING_PORT:-5199}"
log="$(mktemp)"

# A dead API target: nothing here may reach a real library.
PSET_API_TARGET=http://127.0.0.1:9 npx vite --port "$port" --strictPort >"$log" 2>&1 &
vite=$!
trap 'kill "$vite" 2>/dev/null || true; rm -f "$log"' EXIT

for _ in $(seq 1 120); do
	if curl -sf "http://127.0.0.1:$port/" >/dev/null; then break; fi
	if ! kill -0 "$vite" 2>/dev/null; then
		cat "$log"
		exit 1
	fi
	sleep 0.5
done

node scripts/loading/check.mjs "http://127.0.0.1:$port" "$@"
