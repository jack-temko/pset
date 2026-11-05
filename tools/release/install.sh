#!/bin/sh
# Installs PSet: downloads the latest release for this machine, checks it
# against the release's checksums, installs the tools it needs, puts `pset` in
# ~/.local/bin and starts it.
#
#   curl -fsSL https://github.com/jack-temko/pset/releases/latest/download/install.sh | sh
#
# Run it again to update. Your library is never touched.
# Variables: PSET_REPO (owner/name), PSET_BASE_URL (where the files are),
# PSET_SKIP_DEPS=1 (don't install poppler, tesseract and Ollama),
# PSET_NO_START=1 (install, don't start).
set -eu

repo=${PSET_REPO:-jack-temko/pset}
base=${PSET_BASE_URL:-https://github.com/$repo/releases/latest/download}

say() { printf '\n==> %s\n' "$1"; }
die() {
	printf 'PSet install: %s\n' "$1" >&2
	exit 1
}

# Which release file is for this machine.
case "$(uname -m)" in
x86_64 | amd64) arch=amd64 ;;
aarch64 | arm64) arch=arm64 ;;
*) die "this machine's processor ($(uname -m)) isn't supported" ;;
esac
case "$(uname -s)" in
Darwin) want='-macos\.tar\.gz' ;;
Linux) want="-linux-$arch\\.tar\\.gz" ;;
*) die "$(uname -s) isn't supported (macOS, Linux and WSL are)" ;;
esac

command -v curl >/dev/null || die "curl is needed"
if command -v sha256sum >/dev/null; then
	sum() { sha256sum "$1" | cut -d' ' -f1; }
elif command -v shasum >/dev/null; then
	sum() { shasum -a 256 "$1" | cut -d' ' -f1; }
else
	die "sha256sum or shasum is needed to check the download"
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

say "Finding the latest release"
curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS" || die "couldn't fetch the release's checksums from $base"
line=$(grep -E "pset-.*$want\$" "$tmp/SHA256SUMS" | head -n 1) || true
[ -n "$line" ] || die "no download for this machine in that release"
expect=${line%% *}
file=${line##* }
file=${file#\*}

say "Downloading $file"
curl -fSL --progress-bar "$base/$file" -o "$tmp/$file" || die "download failed"
got=$(sum "$tmp/$file")
[ "$got" = "$expect" ] || die "the download doesn't match its checksum (expected $expect, got $got). Nothing was installed."

say "Unpacking"
tar -xzf "$tmp/$file" -C "$tmp"
dir=$tmp/${file%.tar.gz}
[ -f "$dir/setup.sh" ] || die "the download has no setup script"

say "Setting up"
(cd "$dir" && sh ./setup.sh)

if [ -z "${PSET_NO_START:-}" ]; then
	say "Starting PSet"
	PATH="$HOME/.local/bin:$PATH" exec pset
fi
