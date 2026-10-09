# Lint and format, repo-wide: grill

- status: awaiting OK
- date: 2026-10-09
- brief: one lint and format setup for Go, TS/React, shell, Markdown, YAML/JSON, so the code reads the same everywhere; judged from Jack reading the code and from agents writing it
- sources: Makefile, .github/workflows/ci.yml, web/.oxlintrc.json, web/tsconfig*.json, ideas/error-catalog-grill.md (branch error-catalog), measured runs of gofmt, goimports, go vet, oxlint, tsc --strict

## Gate 0: what is true today

- Go (185 files, 39k lines): gofmt and go vet clean. goimports would regroup imports in 7 files. No golangci-lint or staticcheck.
- TS/React (169 files, 24k lines): tsc clean, and clean under `--strict` too, though `strict` is not on in tsconfig. oxlint sets 2 rules: 23 warnings, 0 errors. No formatter.
- Shell (7 files), Markdown (120), YAML (3), JSON (21): nothing checks them.
- No .editorconfig, no line limit: 333 TS and 599 Go lines are over 120 characters.
- Style today: Go uses tabs and double quotes. TS uses 2 spaces, single quotes and semicolons. Go files are snake_case, TS files kebab-case.
- `make check` runs go test, tsc, vitest, oxlint, the tygo check and go test -race. CI runs `make check`.
- The error-catalog change (parked) adds a lint rule that handlers return only catalog errors, so the Go linter chosen here has to be able to host a custom rule (its D8, F6).

## Summary

### In one line

Every language in the repo follows its own documented standard, enforced by one `make fmt` and one `make lint` inside `make check`, with no warnings and zero findings on day one.

### Decisions

| # | Decision | Why | Beat |
|---|---|---|---|
| D1 | Each language follows its own documented standard, with the standard tool's defaults; TS does not imitate Go | Jack: code should look identical to the other code in its language | Go-like TS; tabs-only TS |
| D2 | Line limit is each standard's default (gofmt: none; the TS formatter's default) | Jack had no preference, and D1 says use each standard | 100 or 120 on both sides |
| D3 | Every rule is an error that fails make check, or off; no warnings | Warnings pile up unread (23 today) | warnings allowed |
| D4 | A Claude Code hook formats each file an agent writes | make check never fails on whitespace, and no tokens go to it | make fmt only |
| D5 | TS follows Google TS style: Prettier output with single quotes, semicolons, 2 spaces, 80 columns | Jack's pick; keeps today's quotes | Prettier defaults (double quotes) |
| D6 | oxfmt formats TS, JS, CSS, JSON, YAML and Markdown | Prettier's output (same 190 files changed), same Oxc toolchain as oxlint, fast enough for the edit hook | Prettier, Biome |
| D7 | Go linters: golangci-lint v2 default set (errcheck, govet, staticcheck with all checks, unused, ineffassign) plus revive, misspell, nolintlint; gofmt and goimports as its formatters | Go's documented standards (Effective Go, Code Review Comments); about 625 findings | plus gosec/noctx/bodyclose/unparam/gocritic; default only |
| D8 | wrapcheck and errorlint wait for the error-catalog change | It defines how errors wrap; avoids touching the same sites twice | turning them on now |
| D9 | Every existing finding is fixed in this change | Lands at zero, so every rule is an error from day one | baseline (new-from-rev) |
| D10 | Frontend lint: oxlint with typescript-eslint strict-type-checked rules, react, react-hooks, type-aware, all errors; `strict: true` in tsconfig | The documented rule sets on the fast tool; strict already passes | ESLint + typescript-eslint; oxlint as today |
| D11 | Shell (shellcheck + shfmt), Markdown, YAML and JSON (oxfmt, actionlint on workflows) and an .editorconfig are all in | Jack chose all four | leaving them unchecked |
| D12 | Jack's own commits: make fmt or his editor, and make check fails on anything unformatted; no git hook | Nothing new to install | a pre-commit hook (lefthook) |

### The artifact: what runs where

| File type | Formatter | Linter |
|---|---|---|
| Go | gofmt + goimports (via `golangci-lint fmt`) | golangci-lint v2 (D7) |
| TS, TSX, JS, CSS | oxfmt (D5) | oxlint (D10), tsc strict |
| JSON, YAML, Markdown | oxfmt | actionlint on `.github/workflows` |
| Shell | shfmt (defaults: tabs) | shellcheck |

`make fmt` rewrites, `make lint` checks formatting and runs every linter, `make check` runs `make lint` first. The Claude Code hook runs the right formatter on each file an agent writes.

### Assumed

- A1 Tools are pinned: golangci-lint, shfmt and actionlint as `tool` lines in go.mod (like tygo) or a pinned version in the Makefile if golangci-lint will not build as a tool; oxfmt and oxlint in web/package.json; shellcheck as a pinned release binary fetched into a cache by the Makefile (CI and local alike).
- A2 Generated and vendored files are skipped: `web/src/api/gen`, lockfiles, `web/dist`, `node_modules`, `.dev`.
- A3 No blanket excludes. A `//nolint` needs the linter name and a reason (nolintlint enforces it); errcheck's deferred Close calls are handled, not excluded.
- A4 Two pull requests, so formatting does not bury real fixes in blame: first formatting only (formatters, .editorconfig, hook, make fmt, the one reflow), then linting (linters, rules, fixes), which also adds the first one's commit to `.git-blame-ignore-revs`.
- A5 goimports groups the module's own imports (`github.com/jackt/pset`) last, as goimports does with `-local`.
- A6 The error-catalog rule is added later as a golangci-lint module plugin; its exact shape is that change's F6.

### Open

Nothing.

## Reversals

## Disagreements

## Frontier

Empty.

## Log

### Batch 1 (style, enforce)

- Q1 How far should the TypeScript look like Go? Go-like (Recommended) / Tabs only / TS conventions. Answer: "the frontend does not need to look like Go. What I mean was they both need to look identical to their coresponding code. So use the documented standards for each"
- Q2 What line limit, the same on both sides? 100 (Recommended) / 120 / No limit. Answer: [No preference]
- Q3 Can a rule be a warning, or does every rule block? Errors only (Recommended) / Warnings allowed. Answer: Errors only (Recommended)
- Q4 Should agents format each file as they edit it? Hook formats edits (Recommended) / make fmt only. Answer: Hook formats edits (Recommended)

### Measured before batch 2

golangci-lint v2.14 default: 450 (errcheck 424, staticcheck 24, ineffassign 1, unused 1). Strict set: 1,221 (wrapcheck 446, errcheck 424, revive 174, noctx 53, gosec 51, gofumpt 31, staticcheck 13, errorlint 9, bodyclose 7, unparam 6, gocritic 4, others 3). oxfmt and Prettier with Google-style options: 190 of 222 files in web/ change, the same set. shellcheck 0.10: 2 info (SC2016). tsc --strict: 0.

### Batch 2 (tools, scope)

- Which documented standard does the TypeScript follow? Prettier defaults (Recommended) / Google TS style. Answer: Google TS style
- Which formatter for TS, CSS, JSON, YAML and Markdown? oxfmt (Recommended) / Prettier / Biome. Answer: oxfmt (Recommended)
- Which Go linters? Go standard (Recommended) / Go standard + safety / Default only. Answer: Go standard (Recommended)
- What happens to the findings that are already there? Fix all now (Recommended) / Baseline. Answer: Fix all now (Recommended)

### Batch 3 (lint depth, scope)

- How deep does the frontend lint go? oxlint, standard sets (Recommended) / ESLint + typescript-eslint / oxlint as today. Answer: oxlint, standard sets (Recommended)
- Which other files get checked? (multi) Shell / Markdown / YAML and JSON / .editorconfig. Answer: Shell, Markdown, YAML and JSON, .editorconfig
- Your own commits: should anything format them before they reach CI? make fmt + CI (Recommended) / Pre-commit hook. Answer: make fmt + CI (Recommended)
