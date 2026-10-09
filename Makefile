# `make dev` is the whole loop: Go rebuilt on save, TS types regenerated,
# Vite with /api proxied. Go lives in /usr/local/go/bin, nvm's node first.
export PATH := $(HOME)/.nvm/versions/node/v24.18.0/bin:$(PATH):/usr/local/go/bin

.PHONY: dev test-library seed gen check-gen katex-check test check build release

dev:
	go run ./tools/dev

gen:
	go tool tygo generate

# The test library: a read-only snapshot of Jack's books and a sample of his
# homework at ~/.local/share/pset-test-library, with no key. `make test-library`
# refreshes it (Jack runs it, or an agent with his OK); `make seed` copies it
# into this worktree's .dev/data, which must not have a library yet.
test-library:
	go run ./tools/testlib snapshot

seed:
	go run ./tools/testlib seed .dev/data

# Fails when a wire.go changed and the generated TS wasn't committed.
check-gen: gen
	git diff --exit-code -- web/src/api/gen

# The web app's KaTeX, bundled for the server to check math with
# (internal/doc/katex-check.js, embedded). Run after changing the katex pin
# in web/package.json; a Go test fails until the bundle matches it.
katex-check:
	cd web && npm run build:check

# Every check that runs without a browser or a model: the Go tests, the
# web's types, unit tests and lint. Tests that need poppler or tesseract
# skip without them, so install both (README) for the whole suite.
test:
	go test ./...
	cd web && npx tsc -b
	cd web && npx vitest run
	cd web && npx oxlint

# What CI runs: test, the Go tests again under the race detector, and the
# generated TypeScript against Go's wire types.
check: test check-gen
	go test -race ./...

build:
	cd web && npm run build
	go build -o pset ./cmd/pset

# Every release file in dist/ (Linux and macOS tarballs, install.sh, SHA256SUMS):
# make release VERSION=0.1.0
release:
	tools/release/build.sh $(VERSION)
