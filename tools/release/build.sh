#!/usr/bin/env bash
# Builds the macOS release: dist/pset-<version>-macos.tar.gz, holding both
# Apple Silicon and Intel binaries, setup.sh and a double-click launcher.
# Usage: tools/release/build.sh 0.1.0
set -euo pipefail

version=${1:?usage: build.sh <version>}
root=$(cd "$(dirname "$0")/../.." && pwd)
name=pset-$version-macos
out=$root/dist/$name

cd "$root/web" && npm run build
cd "$root"
rm -rf "$out" "$out.tar.gz"
mkdir -p "$out/bin"
for arch in arm64 amd64; do
	CGO_ENABLED=0 GOOS=darwin GOARCH=$arch \
		go build -trimpath -ldflags "-s -w -X main.Version=$version" \
		-o "$out/bin/pset-$arch" ./cmd/pset
done
cp tools/release/setup.sh tools/release/PSet.command tools/release/README.txt "$out/"
chmod +x "$out/setup.sh" "$out/PSet.command" "$out"/bin/*
tar -C "$root/dist" -czf "$out.tar.gz" "$name"
echo "$out.tar.gz"
