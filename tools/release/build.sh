#!/usr/bin/env bash
# Builds every release file into dist/ from the commit it is run on:
#   pset-<version>-linux-amd64.tar.gz, pset-<version>-linux-arm64.tar.gz,
#   pset-<version>-macos.tar.gz (Apple Silicon and Intel together),
#   install.sh and SHA256SUMS.
# Pure Go (no CGO), so one machine builds them all. The runner calls this on a
# tag; `make release VERSION=0.1.0` runs it by hand. Usage: tools/release/build.sh 0.1.0
set -euo pipefail

version=${1:?usage: build.sh <version>}
version=${version#v}
root=$(cd "$(dirname "$0")/../.." && pwd)
dist=$root/dist
ldflags="-s -w -X main.Version=$version"

cd "$root/web" && npm run build
cd "$root"
rm -rf "$dist"
mkdir -p "$dist"

build() { # goos goarch out
	CGO_ENABLED=0 GOOS=$1 GOARCH=$2 go build -trimpath -ldflags "$ldflags" -o "$3" ./cmd/pset
}

for arch in amd64 arm64; do
	name=pset-$version-linux-$arch
	mkdir -p "$dist/$name"
	build linux "$arch" "$dist/$name/pset"
	cp tools/release/setup-linux.sh "$dist/$name/setup.sh"
	cp tools/release/README-linux.txt "$dist/$name/README.txt"
	chmod +x "$dist/$name/setup.sh" "$dist/$name/pset"
	tar -C "$dist" -czf "$dist/$name.tar.gz" "$name"
	rm -rf "${dist:?}/$name"
done

name=pset-$version-macos
mkdir -p "$dist/$name/bin"
build darwin arm64 "$dist/$name/bin/pset-arm64"
build darwin amd64 "$dist/$name/bin/pset-amd64"
cp tools/release/setup-macos.sh "$dist/$name/setup.sh"
cp tools/release/PSet.command "$dist/$name/"
cp tools/release/README-macos.txt "$dist/$name/README.txt"
chmod +x "$dist/$name/setup.sh" "$dist/$name/PSet.command" "$dist/$name"/bin/*
tar -C "$dist" -czf "$dist/$name.tar.gz" "$name"
rm -rf "${dist:?}/$name"

cp tools/release/install.sh "$dist/install.sh"
cd "$dist"
if command -v sha256sum >/dev/null; then sha256sum -- *.tar.gz install.sh >SHA256SUMS; else shasum -a 256 -- *.tar.gz install.sh >SHA256SUMS; fi
ls -1 "$dist"
