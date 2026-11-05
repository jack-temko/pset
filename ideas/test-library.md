# A test library for agents

## Status

Done. The spec is in `design/backend.md` (Settings and data, "The test library").

## Information

**Why.** Agents testing PSet (`try.sh`, `make jumps`, `make dev` in a worktree) start
on an empty `.dev/data` or reach for a copy of Jack's own library. Jack wants one
snapshot of his real books and textbooks, with a small sample of homework for the
tests that need a set, that every agent uses when it needs a library (2026-10-08).

**Decisions.**

- The snapshot lives outside the repo at `~/.local/share/pset-test-library/`: the
  PDFs are Jack's textbooks and the repo is public. It is read-only (`chmod -R a-w`);
  agents never use it directly, only a copy seeded from it.
- What it keeps: `books` and everything derived from a book at import (`pages`,
  `pages_fts`, `sections`, `embeddings`), the `books/` PDFs and `cache/pages/` (page
  renders, derived from books only), and a sample of homework: per book, the three
  most recently created sets with all their questions (guides, readings, boxes and
  notes included), so a set, its walkthrough and every homework dialog can be
  opened. What it drops: every other set, `assignment_reads` (in-flight reads with
  uploaded files), tutor turns (`turns`), memories, activity
  (`study`, `heartbeats`), usage (`calls`, `forgotten`), the job queue (`jobs`),
  `logs/` and `backups/`. Settings keep the model choices but never the API key:
  `apiKey` is removed from the `chat` row. GET /api/settings returns the key in full,
  so a copy with the key in it would leak it to any agent that calls it.
- Made by a Go tool, `go run ./tools/testlib`, using the app's own SQLite driver.
  The source is only ever read: the database is copied with `VACUUM INTO` from a
  read-only connection (safe while Jack's PSet runs, WAL included), into a temp
  folder; it is stripped there, checked, and only then moved into place, replacing
  the old snapshot atomically. Nothing about the key is printed or logged.
- Seeding a worktree hardlinks the PDFs and page renders (`books/`, `cache/`) where
  the filesystem allows, falling back to a copy, and copies the database. PSet writes
  PDFs by rename and never edits one in place, so a hardlink can't change the
  snapshot.

### Files

- `tools/testlib/main.go`: two commands.
  - `snapshot [-from ~/.local/share/pset] [-to ~/.local/share/pset-test-library]`:
    `VACUUM INTO` a temp dir, delete the dropped tables' rows and every homework set
    outside the sample in one transaction,
    `json_remove` the `apiKey` from `settings` row `chat`, `VACUUM`, copy `books/`
    (dereferencing symlinks) and `cache/pages/`, check (below), write
    `MANIFEST.json` (made-at, source, schema version from `schema_migrations`, book
    count and titles, and per book the sets kept with their question counts), swap
    into place, `chmod -R a-w`. Refuses `-to` equal to
    `-from` or inside it.
  - `seed <data-dir> [-from ~/.local/share/pset-test-library] [-force]`: refuses a
    data dir that already has `pset.db` unless `-force`; copies the db, hardlinks or
    copies `books/` and `cache/`, makes the result writable.
  - The check, run after stripping and again after seeding: no `apiKey` in any
    `settings` row, zero rows in every dropped table, no book with more than three
    sets, no question without its set, every `books` row has its PDF.
    Any failure deletes the temp folder and exits non-zero.
- `tools/testlib/strip.go`, `tools/testlib/strip_test.go`: the strip and the check as
  functions. The test builds a library in a temp dir with the real migrations,
  inserts a book with pages, five homework sets with questions, an assignment read, a
  tutor turn, a memory, study rows, calls, a job and a settings `chat` row with an
  `apiKey` and a model, then strips it and asserts: the book and its pages remain,
  the three newest sets and their questions remain and the two oldest are gone,
  everything dropped is empty, the model choice is kept, the key is gone, the check
  passes; and that the check fails on a db still holding a key.
- `Makefile`: `test-library` (runs `snapshot`) and `seed` (`seed .dev/data`).
- `.agents/skills/change/references/try.sh`: on `start`, when the worktree's
  `.dev/data` has no `pset.db`, seed it from the snapshot (print one line saying so);
  if the snapshot is missing, say how to make it and go on with an empty library.
- `AGENTS.md`: a short "Test library" section: what it is, where, that agents seed a
  copy (`make seed`) and never use Jack's library or the snapshot itself, that
  `make test-library` refreshes it (Jack runs it, or an agent with his OK), and that
  it holds up to three homework sets per book.
- `design/backend.md`: a few lines on the test library next to the data dir layout.

### Steps

1. `strip.go` and its test.
2. `main.go` with `snapshot` and `seed`; Makefile targets.
3. Run `make test-library` once against `~/.local/share/pset` and report the
   manifest (book count, titles, sizes), the check's result, and that GET
   /api/settings on a seeded copy reports no key (`ready.key` false; read only that
   field, never print the response).
4. `try.sh` seeding; `AGENTS.md`; `design/backend.md`; this file's Status.

### Tests

- `tools/testlib/strip_test.go` (new); `make check` green.
- Step 3's run, and a `try.sh start` on this worktree showing the seeded books in the
  app.

### Acceptance

- `~/.local/share/pset-test-library` holds every book of Jack's library with its PDF,
  up to three homework sets per book with their questions, no tutor turns, memories, activity, usage or jobs, and no API key.
- `make seed` in a fresh worktree gives a library the app opens, with all books and
  their pages readable, in seconds and without a model call.
- Jack's library is unchanged (its `pset.db` mtime and size, and `books/`).

### Out of scope

- Making new homework or any data that needs a model call: the sample is copied.
- Refreshing the snapshot automatically.
- Changing `make dev`'s default data dir.
