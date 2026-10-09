# The test library keeps usage and a few Ask turns

## Status

Done (2026-10-09), branch `test-library-usage`.

## Information

**Why.** The usage dialogs (#26) read the `calls` table, which the test library
empties, so on a seeded copy every usage dialog says "No model calls were made" and
no usage line is drawn. The layout-jump audit then cannot see the usage dialog grow,
which is the jump Jack sees most. Ask answers have usage lines too, and the snapshot
keeps no tutor turns. Jack: "fold in whatever we need for tests" (2026-10-08).

**Decisions.**

- Keep the `calls` rows whose subject the snapshot keeps: `question` rows of kept
  questions, `set` rows of kept sets, `book` rows (imports) of every book, and `turn`
  rows of kept turns. Drop the rest (assignment reads, dropped sets and questions,
  dropped turns). `calls` holds model, timing, tokens, cost, stage, run, tools and
  error text, no prompts; the existing byte scan for secrets covers `error`.
- Keep the newest four `turns` per book (two exchanges), so an Ask answer with a
  usage line exists. `forgotten` stays empty.
- `calls` and `turns` move from the drop list to the keep list; Check asserts no
  `calls` row points at a subject the snapshot does not hold, and no book has more
  than four turns.

### Files

- `tools/testlib/strip.go`: the keep rules above, in the same transaction; Check's
  new assertions; the manifest gains calls and turns counts per book.
- `tools/testlib/strip_test.go`: the fixture gains calls for a kept question, a
  dropped question, a kept set, a book, a kept and a dropped turn, an assignment
  read, and six turns on one book; assert exactly the kept ones survive and that
  Check fails on an orphan call.
- `design/backend.md`: the test library paragraph says what it now keeps.
- `ideas/README.md`: this row.

### Steps

1. Strip and Check rules, with the test.
2. `make test-library` against Jack's library, with the same read-only open rule and
   before/after proof as before; report calls and turns kept per book.
3. Docs; this file's Status.

### Tests

- `go test ./tools/testlib`; `make check` green.

### Acceptance

- A seeded copy's Book actions > Usage dialog shows a table of calls, and a kept
  question and a kept Ask answer each show a usage line.
- No secret in the snapshot (the existing check passes); Jack's library unchanged.

### Out of scope

- Any change to the usage dialogs themselves.
