# Audit fixes

## Status

**Done** (2026-09-30): every row below is merged into `main`, one merge
commit each. `model-usage` landed on `main` meanwhile; the one branch that
conflicted with it (`typed-turn-failure`, in the ask wire types) had `main`
brought in and resolved there. The merged result passed gofmt, vet,
staticcheck, govulncheck, the generated types, the web's types, tests and
lint, and `go test -race` over every package.

| # | Branch | Does |
|---|---|---|
| 1 | `audit-plan` | This file. |
| 2 | `shared-llm-transport` | One `http.Transport` for every model call. |
| 3 | `events-reset-after-restart` | A reconnecting tab that missed a server restart is told to refetch. |
| 4 | `local-only-api` | The API answers only local Hosts and same-origin writes. |
| 5 | `listen-before-queue` | The port is bound before the queue starts. |
| 6 | `search-without-ollama` | Search falls back to text when embedding fails. |
| 7 | `typed-turn-failure` | A turn says its failure kind; the no-key sentence is written once. |
| 8 | `httpx-body-and-handlers` | A too-large body is said so; four handler adapters replace the closures. |
| 9 | `atomic-homework-update` | PATCH of a set can't undo another PATCH. |
| 10 | `stop-queued-test-deflake` | Two flaky tests stop racing, and one stops hanging. |
| 11 | `fts-book-filter` | The search index is found by book: removing a book was 17 s. |
| 12 | `ci-and-toolchain` | `make test` runs every check; CI runs `make check`; Go 1.26.8. |
| 13 | `small-cleanups` | One way to run poppler and tesseract (`execx`); `ocr` gets tests. |
| 14 | `docs-settings` | `design/settings.md` and the settings README say what the code does. |
| 15 | `docs-backend` | `design/backend.md`: layers, routes, events and lanes match the code. |
| 16 | `package-readmes` | READMEs for homework, ask, doc, activity, pagenum, probnum. Cut from the same base as `docs-backend`, and merges it (the one conflict is resolved there). |
| 17 | `tools-readme` | `tools/README.md`. |

Not built, and why:

- **Deleting the Done idea files.** Their open items moved to
  `loose-ends.md` (2026-09-30) and each says so; they stay for their
  decisions and evaluations. `finder-tests.md` was the only place that said
  how to run the two test runners (now `tools/README.md`).
- Lazy-loading routes or KaTeX (localhost; about 66 KB and 270 KB),
  dropping the KaTeX `.ttf`/`.woff` fonts (876 KB of binary), caching page
  vectors, a circular event ring (10 µs a publish).
- Test-only exports (`pagenum.Single`, `Value.IsExact`, ...): other
  packages' tests use them, so they can't move into `_test.go` files.
- Whether an import should need an OpenRouter key and Ollama
  (`library.Upload` refuses both; reading, OCR and text search need
  neither).

## Information

Found by the 2026-09-29 audit: Go build, vet, staticcheck, deadcode,
`-race`, govulncheck, the web type-check, lint and tests, and probes of a
scratch server. What each fix answers:

- **shared-llm-transport.** `llm.New` builds a `Transport` per call and `library.Search`
  and every job call `llm.Open`; idle connections never close. 200
  searches took goroutines from 3 to 603.
- **events-reset-after-restart.** A fresh process numbers events from 1, so a client's old
  `Last-Event-ID` is never seen as too old, no `reset` is sent, and the
  cache (`staleTime: Infinity`) stays stale.
- **local-only-api.** No handler checks Host, Origin or Content-Type. A
  cross-origin `text/plain` POST to `/api/reset` returned 204, and a
  foreign Host got the settings, key included. Loopback names and the host
  of `-addr` are allowed.
- **listen-before-queue.** `queue.Run` starts before `net.Listen`; a second
  instance resets the first's running jobs to queued and may start
  duplicates before it fails to bind.
- **search-without-ollama.** `library.Search` returns the embed error, though the
  design says no embeddings means text search alone.
- **typed-turn-failure.** `homework.modelDown` and `ask`'s loop map
  `llm.Classify` to copy twice, each with its own `failure` type and the
  no-key sentence; the web matches that sentence's text
  (`isSetupReason`). Questions already carry a typed `failure`; turns
  should.
- **httpx-body-and-handlers.** `httpx.Decode` truncates at 1 MB with `LimitReader`, so
  the student sees "unexpected EOF". About 50 handlers repeat decode, call,
  reply.
- **atomic-homework-update.** `homework.Update` reads a set, changes fields, writes them
  all back, outside a transaction.
- **stop-queued-test-deflake.** The test asserts the second book is still queued while the
  lane runs a new book's `examine` ahead of a scan by design, and a
  failure skips `close(release)`, so cleanup waits for the queue for the
  whole test timeout. About one `-race -count=3` run in three failed. A
  second test (`TestReadingAnAssignmentFromAWebPage`) assumed a retry's
  reply still said "reading". `loose-ends.md` named a different test.
- **fts-book-filter.** `pages_fts` had `book_id` and `number` unindexed, so a
  `MATCH` ran over every book and filtered after (41 ms against 13 ms at 30
  books), and each page's delete trigger read the whole index: removing an
  800-page book from ten took 17 s under the write lock, 0.8 s now.
- **ci-and-toolchain.** `make test` runs Go and `tsc` only: not vitest, oxlint or
  `check-gen`. There is no CI. `go 1.26.5` has 6 reachable stdlib
  vulnerabilities, fixed in 1.26.6 and later.
- **docs-\*.** `design/settings.md` describes `internal/engine` and a
  `config.json` that are gone; `internal/settings/README.md` describes two
  sides and endpoints; `design/backend.md`'s event table, lane table, route
  list and layer table have drifted and its "Scope" and "Build order" are
  history; six packages (`homework`, `ask`, `doc`, `activity`, `pagenum`,
  `probnum`) have no README; the Done files here duplicate `design/`.
  Branches: `docs-settings`, `docs-backend`, `package-readmes`,
  `retire-done-ideas`.

Not doing, because measured small or a decision that isn't mine:
lazy-loading routes or KaTeX (localhost, about 66 KB and 270 KB), dropping
the KaTeX `.ttf`/`.woff` fonts (876 KB of binary), caching vectors, a
circular event ring (10 µs a publish), and whether an import should need
an OpenRouter key and Ollama (`library.Upload` refuses both now; text
search and OCR need neither).
