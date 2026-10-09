#!/usr/bin/env bash
# Start or stop a worktree's own PSet for Jack to try a change before it merges.
#
#   try.sh start <worktree>   build the branch's server, start it and Vite on free
#                             private ports, print the link
#   try.sh stop  <worktree>   stop both
#
# Never port 8420 (Jack's own PSet), never his library: data is the worktree's
# .dev/data (seeded from the test library when it has none), logs and PIDs go to /tmp/pset-try-<topic>. If the worktree has a key
# from the openrouter-keys mod (.dev/openrouter.key), it is saved into this server's
# settings without being printed.
set -euo pipefail

cmd=${1:?start or stop}
wt=$(cd "${2:?worktree path}" && pwd)
topic=$(basename "$wt"); topic=${topic#pset-}
run=/tmp/pset-try-$topic
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH:/usr/local/go/bin"

free() { # first free port in a range
	for p in $(seq "$1" "$2"); do
		ss -ltn "( sport = :$p )" | grep -q ":$p" || { echo "$p"; return; }
	done
	echo "no free port in $1-$2" >&2; exit 1
}

stop() {
	for f in "$run"/*.pid; do
		[ -e "$f" ] || continue
		kill -- "-$(cat "$f")" 2>/dev/null || kill "$(cat "$f")" 2>/dev/null || true
		rm -f "$f"
	done
}

case $cmd in
stop)
	stop
	echo "stopped $topic"
	;;
start)
	stop
	mkdir -p "$run" "$wt/.dev/data"
	(cd "$wt" && go build -o "$run/pset" ./cmd/pset)
	if [ ! -f "$wt/.dev/data/pset.db" ]; then
		if [ -f "$HOME/.local/share/pset-test-library/pset.db" ]; then
			(cd "$wt" && go run ./tools/testlib seed .dev/data) && echo "library: seeded from the test library"
		else
			echo "library: empty (no test library; Jack makes one with 'make test-library')"
		fi
	fi
	[ -d "$wt/web/node_modules" ] || (cd "$wt/web" && npm ci --silent)
	sp=$(free 8430 8499)
	vp=$(free 5180 5197)
	setsid "$run/pset" -addr "127.0.0.1:$sp" -data "$wt/.dev/data" -open=false \
		</dev/null >"$run/server.log" 2>&1 & echo $! >"$run/server.pid"
	for _ in $(seq 50); do
		curl -sf "http://127.0.0.1:$sp/api/settings" >/dev/null && break
		sleep 0.2
	done
	if [ -s "$wt/.dev/openrouter.key" ]; then
		key=$(tr -d '[:space:]' <"$wt/.dev/openrouter.key")
		printf '{"apiKey":"%s"}' "$key" | curl -sf -X PUT -H 'Content-Type: application/json' \
			--data-binary @- "http://127.0.0.1:$sp/api/settings" >/dev/null \
			&& echo "key: saved from .dev/openrouter.key" || echo "key: save failed (see the app's Settings)"
		unset key
	else
		echo "key: none (no model calls; ask the keys mod for one if the change needs them)"
	fi
	(cd "$wt/web" && exec env PSET_API_TARGET="http://127.0.0.1:$sp" setsid npx vite --port "$vp" --strictPort) \
		</dev/null >"$run/vite.log" 2>&1 & echo $! >"$run/vite.pid"
	for _ in $(seq 75); do
		curl -sf "http://127.0.0.1:$vp/" >/dev/null && break
		sleep 0.2
	done
	echo "open: http://localhost:$vp"
	echo "server: 127.0.0.1:$sp, data $wt/.dev/data, logs $run"
	;;
*)
	echo "start or stop" >&2; exit 2
	;;
esac
