# Lint and format, repo-wide

## Status

In progress. Part 1 (formatting) built on branch `lint-and-format`, awaiting merge; part 2 (linting) on a
branch from `dev` once part 1 has merged. Unblocks the error-catalog change, which adds
its rule on top of part 2.

## Information

**Why.** The repo has gofmt, go vet, tsc and two oxlint rules, and nothing else: no TS
formatter, no Go linter, nothing on shell, Markdown or YAML. The error-catalog change
needs a Go linter that can host a custom rule, and Jack wants every language to look
like its own documented standard.

**Decisions.** All in [the grill](lint-and-format-grill.md): D1 to D12 and assumed
A1 to A6. In short: each language follows its own standard; Google TS style formatted
by oxfmt; golangci-lint v2 with the Go standard set; oxlint with the
typescript-eslint strict-type-checked, react and react-hooks rules, type-aware;
shellcheck, shfmt, actionlint; every rule an error; every finding fixed now; a Claude
Code hook formats agent edits.

### Files

Part 1, formatting:

- `.editorconfig` (new): tabs for Go, Makefile and shell; 2 spaces elsewhere; LF; final newline.
- `.oxfmtrc.json` (new, repo root, one config for the whole repo): singleQuote, semi, printWidth 80, 2 spaces; ignores per A2.
- `web/package.json`, `web/package-lock.json`: oxfmt pinned as a devDependency.
- `go.mod`, `go.sum`: `tool` lines for golangci-lint (for `golangci-lint fmt`) and shfmt (A1).
- `.golangci.yml` (new): v2 config with only the `formatters` section (gofmt, goimports with the module as local prefix, A5). Part 2 adds the linters.
- `Makefile`: `fmt` (rewrites: `golangci-lint fmt`, oxfmt from `web/` over the repo, shfmt) and `fmt-check` (the same in check mode, failing on any diff); `check` runs `fmt-check` first.
- `tools/format-file.sh` (new): formats one path by its extension, for the hook.
- `.claude/settings.json` (new or edited): a PostToolUse hook on Write and Edit that runs `tools/format-file.sh` on the written file.
- Every Go, TS, JS, CSS, JSON, YAML, Markdown and shell file the formatters change.
- `AGENTS.md`: a short "Format and lint" section: `make fmt`, `make lint`, the hook, `//nolint` needs a reason.

Part 2, linting:

- `.golangci.yml`: the D7 linters (default set, staticcheck all checks, revive, misspell, nolintlint), no warnings.
- `web/.oxlintrc.json`: correctness plus the strict-type-checked, react and react-hooks rules, type-aware, every rule `error`.
- `web/tsconfig.app.json`, `web/tsconfig.node.json`: `"strict": true`.
- `go.mod`: `tool` line for actionlint.
- `Makefile`: `lint` (golangci-lint run, oxlint, shellcheck from a pinned cached binary, actionlint) run by `check`; the old bare `npx oxlint` in `test` moves into `lint`.
- `.git-blame-ignore-revs` (new): part 1's squash commit.
- Every file with a finding (about 625 in Go: errcheck 424, revive about 170, staticcheck 24 and a few others; the 23 oxlint warnings plus what the new rules find; 2 shellcheck infos).

### Steps

Part 1:

1. Pin the tools and add `.editorconfig`, `.oxfmtrc.json`, the formatter-only `.golangci.yml`.
2. `make fmt` and `make fmt-check`; `check` runs `fmt-check`.
3. Run `make fmt` once over the repo, committed alone ("Format the whole repo"), with nothing else in that commit.
4. `tools/format-file.sh` and the hook; prove it by writing a badly formatted scratch file in the repo with the Write tool, seeing it fixed, and deleting it.
5. Docs: `AGENTS.md` section; this file's Status.

Part 2:

1. Linter config on, in this order, each its own commit with its fixes: Go (golangci-lint), TS (oxlint rules and strict), shell and workflows.
2. errcheck fixes handle each error (A3): return it, log it, or join it into the returned error for deferred Close. No `_ =` without a comment saying why it is safe.
3. revive's `exported` fixes write real doc comments, one line, saying what the thing is for, not restating its name.
4. `.git-blame-ignore-revs` with part 1's commit.
5. Docs: `AGENTS.md` section updated; this file Done; a note in `ideas/error-catalog-grill.md` (on its own branch, by its own change) that F6 builds on golangci-lint module plugins.

### Tests

- `make check` passes, with `fmt-check` and `lint` in it, in the worktree and in CI.
- Part 1: `make fmt` twice in a row leaves no diff; `make fmt-check` fails on a deliberately misformatted Go, TS, Markdown and shell file (try and revert).
- Part 2: `make lint` fails on one deliberate finding per tool (try and revert). Existing Go and vitest tests still pass: part 2 changes behavior only where an error was ignored, and those paths keep their tests.
- No UI change is intended. Part 1 is whitespace and quotes only; part 2's frontend fixes get a look at the pages they touch in both themes.

### Acceptance

- `make fmt`, `make lint` and `make check` exist and pass on `dev` after each part.
- No warnings anywhere: every rule is an error or off.
- An agent's edit is formatted before make check sees it.
- `git blame` skips the reflow commit with `--ignore-revs-file .git-blame-ignore-revs`.

### Out of scope

- wrapcheck, errorlint and the error-catalog rule (that change).
- gosec, noctx, bodyclose, unparam, gocritic (Jack chose the standard set).
- A git pre-commit hook (D12).
