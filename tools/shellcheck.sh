#!/usr/bin/env bash
# Runs the pinned shellcheck on the shell files it is given. The release binary
# is fetched once into the user cache and checked against its checksum, so CI
# and every worktree lint with the same version.
set -euo pipefail

version=0.10.0
cache="${XDG_CACHE_HOME:-$HOME/.cache}/pset/shellcheck-$version"

if [ ! -x "$cache/shellcheck" ]; then
	case "$(uname -s)-$(uname -m)" in
	Linux-x86_64) target=linux.x86_64 sum=6c881ab0698e4e6ea235245f22832860544f17ba386442fe7e9d629f8cbedf87 ;;
	Linux-aarch64) target=linux.aarch64 sum=324a7e89de8fa2aed0d0c28f3dab59cf84c6d74264022c00c22af665ed1a09bb ;;
	Darwin-arm64) target=darwin.aarch64 sum=bbd2f14826328eee7679da7221f2bc3afb011f6a928b848c80c321f6046ddf81 ;;
	Darwin-x86_64) target=darwin.x86_64 sum=ef27684f23279d112d8ad84e0823642e43f838993bbb8c0963db9b58a90464c2 ;;
	*)
		echo "shellcheck.sh: no pinned shellcheck for $(uname -s) $(uname -m)" >&2
		exit 1
		;;
	esac
	tmp="$(mktemp -d)"
	trap 'rm -rf "$tmp"' EXIT
	curl -fsSL -o "$tmp/sc.tar.xz" "https://github.com/koalaman/shellcheck/releases/download/v$version/shellcheck-v$version.$target.tar.xz"
	if command -v sha256sum >/dev/null; then
		echo "$sum  $tmp/sc.tar.xz" | sha256sum -c - >/dev/null
	else
		echo "$sum  $tmp/sc.tar.xz" | shasum -a 256 -c - >/dev/null
	fi
	tar -xJf "$tmp/sc.tar.xz" -C "$tmp"
	mkdir -p "$cache"
	mv "$tmp/shellcheck-v$version/shellcheck" "$cache/shellcheck"
fi

exec "$cache/shellcheck" "$@"
