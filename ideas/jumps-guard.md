# Loading standard, part 3: the jump guard in CI

## Status

In progress, branch `jumps-guard` (change 2c of the loading standard). Its CI step
lands after part 2 (`loading-screens`), so it turns on green.

## Information

**Why.** `make jumps` measures but never fails: it exits 0 on any jump, with no
threshold and no allow-list. Jack wants no jump to come back (grill
`ideas/loading-standard-grill.md`, D4 and D6). CI cannot use the test library, which
is Jack's own books and the repo is public, and a real import needs a key and Ollama.

**Decisions.**

- D4, D6 of the grill: CI fails a PR on any overlay that changes size by more than
  2px after opening, or any layout shift above 0.001, in either mode; deliberate
  exceptions go in a named allow-list with a reason.
- A permanent skeleton (a scenario that times out on a skeleton or spinner) also
  fails: a failed query must show its error line, not shimmer forever.
- The CI run uses a public fixture library built by SQL from `testdata/` (the way
  `tools/seedusage` already does), with no model call.
- The step runs inside the existing required `check` job, only when the PR touches
  `web/` or `tools/jumps.sh` or `web/scripts/jumps/`, so no ruleset change is needed.

### Files

- `tools/fixturelib/main.go` (new) and `main_test.go`: builds a library into a given
  data dir (refuses one that holds `pset.db`, and refuses Jack's library and the test
  library, like `tools/testlib`). Runs the real migrations, then by SQL and the
  packages' own store functions where they need no model:
  - two books from `testdata/sample-digital.pdf` and `testdata/sample-flat.pdf`,
    state ready, pages with text from `pdf.Text`, sections from
    `testdata/manifest.json`, the PDFs copied to `books/<id>.pdf`;
  - per book two homework sets (one due, one turned in) with four questions each,
    at least one question with a written guide and answers (the guide JSON shape
    copied from an existing Go test fixture) and one unwritten;
  - two answered Ask turns on one book;
  - usage `calls` for those questions, turns, sets and each book's import, with
    stages and runs, so every usage dialog and usage line has data;
  - settings with no key; deterministic ids and dates (relative to a fixed clock or
    now, whichever the UI needs for "due" to show).
  The test builds one into a temp dir, starts nothing, and checks with the stores
  that every scenario's target exists (the audit's usage scenarios need a usage call
  and an answered turn).
- `web/scripts/jumps/check.mjs` (new) and `web/scripts/jumps/allow.json` (new, empty
  list, each entry `{ scenario, mode?, reason }`): reads `report.json`, fails on the
  thresholds above and on timeouts, ignores allow-listed rows, prints each offender
  with its numbers and the elements that moved, exits 1. Tests in
  `check.test.mjs`: thresholds at the edges, allow-list match, timeout as failure,
  a skipped scenario is not a failure but is listed.
- `tools/jumps.sh`, `Makefile`: `make jumps-check` builds the fixture library into
  `/tmp/pset-jumps-<topic>/fixture`, runs the audit on it with `--runs 3` (both
  modes, hand-written scenarios plus discovery), then `check.mjs`. `make jumps`
  keeps its behaviour.
- `.github/workflows/ci.yml`: in the `check` job, after `make check`: a step that
  decides from `git diff --name-only origin/${{ github.base_ref }}...HEAD` (or the
  push range) whether `web/`, `tools/jumps.sh`, `tools/fixturelib/` or
  `web/scripts/jumps/` changed; if so, restore `~/.cache/ms-playwright` (cache keyed
  by the Playwright version in `web/package-lock.json`), `npx playwright install
  --with-deps chromium`, install `sqlite3` if missing, and run `make jumps-check`.
  On failure upload the report folder as an artifact. Measure the added time and
  keep it under about 5 minutes.
- `design/design-system.md` ("Nothing jumps"): the check, its thresholds, the
  allow-list, `make jumps-check` locally. `AGENTS.md`: one line that a UI change must
  pass `make jumps-check` before its PR.

### Steps

1. `tools/fixturelib` and its test.
2. `check.mjs`, `allow.json`, tests; `make jumps-check`.
3. Run `make jumps-check` locally on dev: record what fails today (the screens part 2
   fixes), but do not allow-list them.
4. CI step on this branch, proven on a draft PR run (the step must run, install
   Chromium from cache on the second run, and report).
5. Docs; this file's Status.

### Tests

- `go test ./tools/fixturelib`, `check.test.mjs`, `make check` green.
- A CI run on the PR that shows the step running and its time.

### Acceptance

- `make jumps-check` builds the fixture library, runs, and exits 1 with a readable
  list when anything jumps; exits 0 when nothing does.
- In CI the step runs only for UI changes, uses no secret and no model, and adds
  under about 5 minutes.
- Merged after part 2, with an empty allow-list, and green.

### Out of scope

- Fixing any jump (part 2).
- Changing the rulesets.
