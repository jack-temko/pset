#!/usr/bin/env bash
# Formats one file by its extension, the way make fmt would: tools/format-file.sh <path>.
# The Claude Code hook in .claude/settings.json runs it after every Write and
# Edit, passing the hook's JSON on stdin instead of a path.
#
# It uses the formatters of the git tree the file is in, not of the tree the
# script lives in, so a worktree's own pinned versions format its own files. It
# never fails: a file outside a git tree, an ignored file, a tree without its
# tools installed (no web/node_modules yet) or a formatter error is skipped
# quietly and the exit status is 0. make fmt-check is what enforces formatting.
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH:/usr/local/go/bin"

if [ $# -ge 1 ]; then
	file="$1"
else
	file="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).tool_input?.file_path??""))' 2>/dev/null)"
fi
[ -n "$file" ] && [ -f "$file" ] || exit 0
file="$(realpath "$file" 2>/dev/null)" || exit 0
# oxfmt reads its argument as a glob
case "$file" in *[][*?{}]*) exit 0 ;; esac
root="$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null)" || exit 0
[ -n "$root" ] || exit 0

cd "$root" || exit 0
[ -f .oxfmtrc.json ] && [ -f tools/format-file.sh ] || exit 0
oxfmt=web/node_modules/.bin/oxfmt
case "$file" in
*.go) [ -f go.mod ] && go tool golangci-lint fmt "$file" ;;
*.sh) [ -f go.mod ] && go tool shfmt -w "$file" ;;
*.ts | *.tsx | *.js | *.mjs | *.css | *.json | *.yml | *.yaml | *.md)
	[ -x "$oxfmt" ] && "$oxfmt" "$file"
	;;
esac >/dev/null 2>&1
exit 0
