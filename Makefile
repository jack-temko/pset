# `make dev` is the whole loop: Go rebuilt on save, TS types regenerated,
# Vite with /api proxied. Go lives in /usr/local/go/bin, nvm's node first.
export PATH := $(HOME)/.nvm/versions/node/v24.18.0/bin:$(PATH):/usr/local/go/bin

.PHONY: dev gen check-gen test build

dev:
	go run ./tools/dev

gen:
	go tool tygo generate

# Fails when a wire.go changed and the generated TS wasn't committed.
check-gen: gen
	git diff --exit-code -- web/src/api/gen

test:
	go test ./...
	cd web && npx tsc -b

build:
	cd web && npm run build
	go build -o pset ./cmd/pset
