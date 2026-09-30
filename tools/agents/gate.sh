#!/usr/bin/env bash
# The Stop hook (.claude/settings.json): an implementing agent can't finish
# while `make test` fails. Only sessions with PSET_GATE set are gated (the
# agents loop sets it for implementers, and so does the `glm` shell
# function in tools/agents/README.md); anyone else stops as usual.
#
# It sends the failure back at most three times per session, then lets the
# agent stop, so a model that can't fix it hands back to the loop, whose
# own `make check` catches it and escalates.
[ -n "$PSET_GATE" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

session=$(sed -n 's/.*"session_id" *: *"\([^"]*\)".*/\1/p' | head -n1)
count="$(git rev-parse --path-format=absolute --git-common-dir)/agents/gate-${session:-unknown}"
mkdir -p "$(dirname "$count")"
n=$(cat "$count" 2>/dev/null || echo 0)
[ "$n" -lt 3 ] || exit 0

# gen first: a changed wire.go must regenerate the TS types it checks.
if out=$(make gen test 2>&1); then
	rm -f "$count"
	exit 0
fi
echo $((n + 1)) >"$count"
{
	echo "make test fails. Fix it before you finish; the end of its output:"
	echo
	tail -n 60 <<<"$out"
} >&2
exit 2
