#!/usr/bin/env bash
# Formats one file by its extension, the way make fmt would: tools/format-file.sh <path>.
# The Claude Code hook in .claude/settings.json runs it after every Write and
# Edit, passing the hook's JSON on stdin instead of a path. A file outside the
# repo, ignored by the formatter or of a kind it doesn't know is left alone.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH:/usr/local/go/bin"

if [ $# -ge 1 ]; then
	file="$1"
else
	file="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).tool_input?.file_path??""))')"
fi
[ -n "$file" ] && [ -f "$file" ] || exit 0
file="$(realpath "$file")"
case "$file" in "$root"/*) ;; *) exit 0 ;; esac

cd "$root"
case "$file" in
*.go) go tool golangci-lint fmt "$file" ;;
*.sh) go tool shfmt -w "$file" ;;
*.ts | *.tsx | *.js | *.mjs | *.css | *.json | *.yml | *.yaml | *.md)
	npm --prefix web exec -- oxfmt "$file"
	;;
esac
