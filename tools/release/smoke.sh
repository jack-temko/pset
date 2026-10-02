#!/bin/sh
# Starts a built PSet on a scratch data folder and checks that it is alive:
# it reports the version it was built as, serves the web app and answers the
# API. Usage: smoke.sh <pset binary> <expected version>. Used by the release
# runner on Linux and on a Mac, and by hand.
set -eu

bin=${1:?usage: smoke.sh <pset binary> <expected version>}
want=${2:?usage: smoke.sh <pset binary> <expected version>}
want=${want#v}
port=${SMOKE_PORT:-18420}

got=$("$bin" -version)
[ "$got" = "pset $want" ] || { echo "smoke: the binary says \"$got\", expected \"pset $want\"" >&2; exit 1; }

data=$(mktemp -d)
"$bin" -addr "127.0.0.1:$port" -data "$data" -open=false >"$data/log" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true; rm -rf "$data"' EXIT

up=
for _ in $(seq 1 30); do
	if curl -fs "http://127.0.0.1:$port/api/books" >/dev/null 2>&1; then up=1; break; fi
	kill -0 "$pid" 2>/dev/null || { echo "smoke: it exited:" >&2; cat "$data/log" >&2; exit 1; }
	sleep 1
done
[ -n "$up" ] || { echo "smoke: it never answered:" >&2; cat "$data/log" >&2; exit 1; }

page=$(curl -fs "http://127.0.0.1:$port/")
case "$page" in
*"<div id=\"root\""* | *"<div id='root'"*) ;;
*) echo "smoke: the page isn't the web app (is the bundle embedded?)" >&2; exit 1 ;;
esac
echo "smoke: $got is up, serves the web app and answers the API"
