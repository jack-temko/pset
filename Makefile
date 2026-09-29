# `make dev` is the whole loop: Go rebuilt on save, TS types regenerated,
# Vite with /api proxied. Go lives in /usr/local/go/bin, nvm's node first.
export PATH := $(HOME)/.nvm/versions/node/v24.18.0/bin:$(PATH):/usr/local/go/bin

.PHONY: dev gen check-gen katex-check test build release

dev:
	go run ./tools/dev

gen:
	go tool tygo generate

# Fails when a wire.go changed and the generated TS wasn't committed.
check-gen: gen
	git diff --exit-code -- web/src/api/gen

# The web app's KaTeX, bundled for the server to check math with
# (internal/doc/katex-check.js, embedded). Run after changing the katex pin
# in web/package.json; a Go test fails until the bundle matches it.
katex-check:
	cd web && npm run build:check

test:
	go test ./...
	cd web && npx tsc -b

build:
	cd web && npm run build
	go build -o pset ./cmd/pset

# macOS release tarball in dist/: make release VERSION=0.1.0
release:
	tools/release/build.sh $(VERSION)
