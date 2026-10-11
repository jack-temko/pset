# `make dev` is the whole loop: Go rebuilt on save, TS types regenerated,
# Vite with /api proxied. Go lives in /usr/local/go/bin, nvm's node first.
export PATH := $(HOME)/.nvm/versions/node/v24.18.0/bin:$(PATH):/usr/local/go/bin

.PHONY: dev test-library seed gen check-gen katex-check fmt fmt-check lint test check build release jumps

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

# Formatting. fmt rewrites every file to its language's standard: Go through
# golangci-lint (gofmt, goimports), the web and the rest through oxfmt (one
# config at the repo root), shell through shfmt. fmt-check does the same
# without writing and fails on any diff.
SH_FILES = $$(git ls-files '*.sh')

fmt:
	go tool golangci-lint fmt
	npm --prefix web exec -- oxfmt
	go tool shfmt -w $(SH_FILES)

fmt-check:
	go tool golangci-lint fmt --diff
	npm --prefix web exec -- oxfmt --check
	go tool shfmt -d $(SH_FILES)

# Linters, all errors, no warnings: Go through golangci-lint (.golangci.yml),
# the web through oxlint with type information (web/.oxlintrc.json), shell
# through shellcheck (a pinned release, fetched once), the workflows through
# actionlint.
lint:
	go tool golangci-lint run
	cd web && npx oxlint --type-aware
	tools/shellcheck.sh $(SH_FILES)
	go tool actionlint

# Every check that runs without a browser or a model: the Go tests, the
# web's types and unit tests. Tests that need poppler or tesseract
# skip without them, so install both (README) for the whole suite.
test:
	go test ./...
	cd web && npx tsc -b
	cd web && npx vitest run

# What CI runs: fmt-check, lint, test, the Go tests again under the race detector, and the
# generated TypeScript against Go's wire types.
check: fmt-check lint test check-gen
	go test -race ./...

build:
	cd web && npm run build
	go build -o pset ./cmd/pset

# The layout-jump audit: every screen and overlay, real and slow, on a copy of a
# library (DATA=<dir>, default ~/.local/share/pset-test-library), with its own
# server on private ports.
# Writes /tmp/pset-jumps-<topic>/<time>/report.md. ARGS passes options through:
# make jumps ARGS="--runs 3 --only memory,edit-book". SRC=<checkout> builds and
# serves that checkout instead (npm ci there first) while this worktree measures.
jumps:
	tools/jumps.sh

# Every release file in dist/ (Linux and macOS tarballs, install.sh, SHA256SUMS):
# make release VERSION=0.1.0
release:
	tools/release/build.sh $(VERSION)
