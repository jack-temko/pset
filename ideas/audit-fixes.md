# Audit fixes

## Status

**In progress** (2026-09-29), one branch per row, built in this order.
Each branch is cut from the tip of the line of work (`124fe88`, not the
`main` on the remote, which is behind), checked (Go tests, `-race` where
it matters, the web checks for anything under `web/`), and pushed on its
own. None waits on another.

| # | Branch | Does |
|---|---|---|
| 1 | `audit-plan` | This file. |
| 2 | `shared-llm-transport` | One `http.Transport` for every model call. |
| 3 | `events-reset-after-restart` | A reconnecting tab that missed a server restart is told to refetch. |
| 4 | `local-only-api` | The API answers only local Hosts and same-origin writes. |
| 5 | `listen-before-queue` | The port is bound before the queue starts. |
| 6 | `search-without-ollama` | Search falls back to text when embedding fails. |
| 7 | `typed-turn-failure` | One place turns a model failure into words; a turn says its failure kind. |
| 8 | `httpx-body-and-handlers` | A too-large body is said so; one generic handler adapter. |
| 9 | `atomic-homework-update` | PATCH of a set can't undo another PATCH. |
| 10 | `stop-queued-test-deflake` | `TestStopQueuedThenRetry` stops racing and stops hanging. |
| 11 | `fts-book-filter` | A search touches only its book's pages. |
| 12 | `ci-and-toolchain` | `make test` runs every check; CI runs it; Go moves to the latest patch. |
| 13 | `docs-*` | Docs true to the code (below). |
| 14 | `small-cleanups` | One exec helper for `pdf` and `ocr`, test-only exports, a lint nit. |

## Information

Found by the 2026-09-29 audit: Go build, vet, staticcheck, deadcode,
`-race`, govulncheck, the web type-check, lint and tests, and probes of a
scratch server. What each fix answers:

- **2. Leak.** `llm.New` builds a `Transport` per call and `library.Search`
  and every job call `llm.Open`; idle connections never close. 200
  searches took goroutines from 3 to 603.
- **3. Restart.** A fresh process numbers events from 1, so a client's old
  `Last-Event-ID` is never seen as too old, no `reset` is sent, and the
  cache (`staleTime: Infinity`) stays stale.
- **4. Local only.** No handler checks Host, Origin or Content-Type. A
  cross-origin `text/plain` POST to `/api/reset` returned 204, and a
  foreign Host got the settings, key included. Loopback names and the host
  of `-addr` are allowed.
- **5. Two instances.** `queue.Run` starts before `net.Listen`; a second
  instance resets the first's running jobs to queued and may start
  duplicates before it fails to bind.
- **6. Ollama down.** `library.Search` returns the embed error, though the
  design says no embeddings means text search alone.
- **7. Failure words.** `homework.modelDown` and `ask`'s loop map
  `llm.Classify` to copy twice, each with its own `failure` type and the
  no-key sentence; the web matches that sentence's text
  (`isSetupReason`). Questions already carry a typed `failure`; turns
  should.
- **8. Bodies.** `httpx.Decode` truncates at 1 MB with `LimitReader`, so
  the student sees "unexpected EOF". About 50 handlers repeat decode, call,
  reply.
- **9. PATCH.** `homework.Update` reads a set, changes fields, writes them
  all back, outside a transaction.
- **10. Flake.** The test asserts the second book is still queued while the
  lane runs a new book's `examine` ahead of a scan by design, and a
  failure skips `close(release)`, so cleanup waits for the queue for the
  whole test timeout. About one `-race -count=3` run in three failed.
  `loose-ends.md` names a different test; this may be the flake it means.
- **11. FTS.** `pages_fts` has `book_id UNINDEXED`, so `MATCH` runs over
  every book and filters after. 41 ms against 13 ms at 30 books.
- **12. Checks.** `make test` runs Go and `tsc` only: not vitest, oxlint or
  `check-gen`. There is no CI. `go 1.26.5` has 6 reachable stdlib
  vulnerabilities, fixed in 1.26.6 and later.
- **13. Docs.** `design/settings.md` describes `internal/engine` and a
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
