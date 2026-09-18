# api

The HTTP adapter: serves the JSON API under `/api/*` and the embedded SPA
(from `web/embed.go`) everywhere else. No domain behaviour lives here —
handlers parse, call the engine, and map results/errors to JSON.

## Dependencies

- `internal/engine` for all behaviour. This package must not import
  `internal/store`; wire shapes are built from engine results. (Message
  segment lists arrive inside engine results as `store.Message` values —
  the `store` import names those fields but never touches persistence.)
- `web` (repo root, `web/embed.go`) for the embedded `dist`
- stdlib `net/http` otherwise

## Contracts

- `api.New(version, engine).Handler()` returns the full handler; `cmd/pset`
  owns engine construction, migrations, and the job runner.
- `/api/*` always answers JSON (`Content-Type: application/json`), including
  404s (`{"error":"…"}`) — the API namespace never leaks HTML. Method
  mismatches on known paths also fall through to the JSON 404.
- Everything else is the SPA: exact static files (hashed `assets/*` are
  `immutable`), `index.html` fallback with `no-cache` for client-side
  routes, 404 for missing assets. Before the first frontend build, `/` serves
  a 503 notice with build instructions; `/api/health` keeps working.

## Homework routes

- `POST /api/homework` `{bookSha256, title?, dueDate?, sourceText}` → 202
  `{homework, task}`; caps enforced (20 KB source). Refused with 400 when no
  chat model is configured, and 400 when the source book is not ready —
  locating a question needs its pages, its sections and its search index.
  Generation progress flows on the shared `GET /api/events` stream; the
  workspace refetches as the walkthroughs phase advances. Questions are
  **not** task phases: a question is something the student opens and repairs
  on its own card, so its state lives on its own row.
- `GET /api/homework` → `{homeworks: [...]}` (refs with book identity and
  question counts); `GET /api/homework/{id}` → `{homework, questions}`;
  `PATCH` `{title?, dueDate?, turnedIn?}` (empty dueDate clears it);
  `DELETE`.
- `POST /api/homework/{id}/commands` `{text}` — SSE tutor edit (`stage`,
  `question`, `question-removed`, `guide`, `done`, `error`); failures after
  the stream opens surface as `error` events and change nothing.
- Per-question repair is scoped and synchronous — `…/questions/{qid}/adjust`,
  `…/relocate`, `…/rewrite`. See [Question repair](#question-repair) below.
- `POST …/questions` (full row — the undo target, 201), `DELETE
  …/questions/{qid}` (200 with the removed row), `PATCH
  …/questions/{qid}` `{position}`.
- `GET …/questions/{qid}/image?variant=question|diagram&n=` → JPEG;
  `GET /api/homework/{id}/pdf` → `application/pdf` attachment.

## Routes

All field names are camelCase. `{sha}` accepts anything the engine resolver
matches: a sha256 prefix (4+ chars), an exact stored path, or a title
substring.

| Route | Body | Response |
|---|---|---|
| `GET /api/health` | — | `{"status":"ok","version":"…"}` |
| `GET /api/books` | — | `{"books":[BookJSON…]}` (`[]` when empty) |
| `GET /api/books/{sha}` | — | `BookJSON`; 404 no match, 409 ambiguous |
| `GET /api/books/{sha}/pages/{n}` | — | `{"sha256","page","text"}`; 404 `page not stored`, 400 bad page number |
| `GET /api/books/{sha}/pages/{n}/image` | — | PNG bytes (`Content-Type: image/png`, `Cache-Control: private, max-age=3600`); same page 404/400 mapping as the text endpoint |
| `GET /api/books/{sha}/sections` | — | bare array of `{sortOrder,level,title,source,startPage,endPage}` (`[]` when unindexed); 404 no match, 409 ambiguous |
| `POST /api/import` | multipart `file` part, or JSON `{"path":"…"}` (file on the server host) | `202 {"book":null,"task":TaskJSON,"duplicated":false}`; duplicate content → `200 {"book":BookJSON,"task":null,"duplicated":true}`, nothing enqueued; **400 when no embeddings endpoint is configured** — preparation ends in search, so it is refused at the door rather than after the OCR |
| `POST /api/books/{sha}/ask` | `{"question":"…","conversationId":string\|null}` | SSE stream (see below); pre-stream failures are JSON errors (404/409/400) |
| `GET /api/books/{sha}/conversations` | — | `{"conversations":[ConversationJSON…]}` (`[]` when none) |
| `GET /api/books/{sha}/conversations/{id}` | — | `{"conversation":ConversationJSON,"messages":[{id,role,content,citations,createdAt}…]}`; 404 unknown id or another book's thread |
| `DELETE /api/books/{sha}/conversations/{id}` | — | `200 {}`; 404 unknown id or another book's thread |
| `GET /api/conversations` | — | `{"conversations":[ConversationJSON…]}` — every thread across books, book identity filled |
| `GET /api/conversations/{id}` | — | `{"conversation":ConversationJSON,"messages":[…]}` with book identity; 404 unknown id |
| `PATCH /api/conversations/{id}` | `{"title"?:string,"pinned"?:bool}` (at least one; unknown fields → 400) | `200 {"conversation":ConversationJSON}` with book identity; 400 empty or >120-rune title; 404 unknown id |
| `GET /api/config` | — | `{"apiBaseURL","hasAPIKey":bool,"embedBaseURL","embedModel"}` — the key never leaves the server |
| `PUT /api/config` | `{"apiBaseURL"?,"apiKey"?,"embedBaseURL"?,"embedModel"?}` (unknown fields → 400) | same shape as GET; the key is only replaced when a non-empty `apiKey` arrives |
| `POST /api/config/test` | optional config body overriding the saved settings for this probe | `{"ok":bool,"chat":{"ok","detail"},"embed":{"ok","detail"}}` — a 1-token chat request plus a probe embedding |
| `GET /api/events` | — | SSE, every task on one connection: `snapshot` once per connect, then `task` (full row with phases) / `phase` (single row) deltas and `task_removed`; a `ping` event every 15s. The heartbeat is a real event, not an SSE comment: a comment keeps proxies from timing the socket out but is invisible to `EventSource`, so a client cannot use it to tell an idle stream from a dead one |
| `GET /api/tasks` | — | `{"tasks":[TaskJSON…]}` — active FIFO, then the ones needing a decision, then finished newest-first (newest 25; history prunes itself) |
| `GET /api/tasks/{id}` | — | `{"task":TaskJSON}`; 404 unknown id |
| `POST /api/tasks/{id}/stop` | — | `202 {"task":TaskJSON}` — queued rests at once, running stops at its next checkpoint. **Finished phases are kept**; 404 unknown, 409 already resting |
| `POST /api/tasks/{id}/retry` | — | `202 {"task":TaskJSON}` — resumes a paused or failed task; finished phases are never re-run; 404 unknown, 409 still queued/running |
| `DELETE /api/books/{sha}` | — | `200 {"removed":sha,"title":…}` — the only door that deletes: the book, its derived data, its tasks and its library copy |
| `GET /api/doctor` | — | `{"ok","checks":[{"name","status","findings":[{"severity","message"}]}]}` — check-only |
| `POST /api/doctor` | — | same shape, run with fix |
| `POST /api/reset` | `{"apply":bool}` (empty body = preview) | `{"books","pages","libraryFiles"}`; 409 while any job is queued/running |

<a id="question-repair"></a>
Question repair — direct requests, not tasks, each touching only the stage
that was wrong. All three answer `200 {"question":HomeworkQuestionJSON}`:

| method + path | body | notes |
|---|---|---|
| `POST /api/homework/{id}/questions/{qid}/adjust` | `{"page"?,"questionRect"?,"diagrams"?,"standalone"?}` | Hand corrections from the Adjust panel — no model call. Moving the page marks the walkthrough `stale`. |
| `POST /api/homework/{id}/questions/{qid}/relocate` | `{"page"?,"note"?,"text"?}` | Finds the question in the book again, then rewrites. A `page` reduces searching the whole book to finding a region on one page. |
| `POST /api/homework/{id}/questions/{qid}/rewrite` | `{"note"?}` | Writes the walkthrough again from the location it already has. |

Removed: `POST /api/ocr`, `POST /api/index` (S4 — these became jobs);
`GET /api/homework/{id}/events` and
`POST /api/homework/{id}/questions/{qid}/retry` (step-model cutover); and in
the tasks redesign `POST /api/books/{sha}/ocr|index|embed` (phases of
preparation, never jobs of their own), `POST /api/jobs/{id}/steps/{key}/retry`
(there are no steps to address), and `POST /api/jobs/clear-finished`
(history prunes itself).

### Ask SSE protocol

`POST /api/books/{sha}/ask` answers `Content-Type: text/event-stream` with
`Cache-Control: no-cache`, one JSON object per event, each written as a
`data: ` line followed by a blank line, flushed immediately:

| event | shape |
|---|---|
| `meta` | `{"type":"meta","conversationId":"…","pages":[3,7,…]}` — sent the moment the context pages are retrieved and streaming begins; carries `"warnings":[…]` only when retrieval degraded (e.g. the embeddings endpoint is down, the ask continues from text search alone) |
| `delta` | `{"type":"delta","text":"…"}` — one per prose fragment |
| `envelope-start` | `{"type":"envelope-start","kind":"equation"}` — a known-kind fence opened; the skeleton moment |
| `envelope-repairing` | `{"type":"envelope-repairing","kind":"…"}` — the payload failed validation and the single repair round started |
| `envelope` | `{"type":"envelope","kind":"…","payload":{…}}` — a schema-validated envelope; `payload` is the JSON object |
| `envelope-failed` | `{"type":"envelope-failed","kind":"…","raw":"…"}` — the degrade path: the raw arrived payload (or an unrepairable/aborted envelope) as text |
| `done` | `{"type":"done","messageId":"…"}` — the assistant message is stored (segments + citations) |
| `error` | `{"type":"error","error":"…"}` — a failure after the stream started; the stream then ends (no `done`) |

Failures before the stream starts (unknown book, no stored pages,
unconfigured chat connection, empty question) are answered as ordinary
JSON errors in the shared error shape.

`BookJSON`: `id` (the book's UUID — also accepted wherever a `{sha}` is),
`sha256` (the canonical content address), `title`, `author`, `subject`,
`pageCount`, `kind` (`digital`|`scanned`), `pdfVersion`,
`pageWidth`/`pageHeight` (floats), `fileSize` (bytes), `originPath`,
`libraryPath`, `importedAt` (RFC3339), plus the preparation state:

- `ready` (bool) — **derived on every read**, never a stored claim. A book
  is ready or it isn't; there is no partial capability.
- `readiness` — the counts behind it, so a client can say what is missing
  without a second request: `pagesStored`, `pagesFailed`, `pagesWithText`
  (blanks excluded — there is nothing on them to index), `sections`,
  `vectors`, and `missing` (`""` | `examine` | `read` | `index` | `search`).
- `failedPages` — `[{"page","error"}]`, the pages a tool failed to read.
  A blank page never appears here: a blank page is a finished page.
- `task` — the `TaskJSON` preparing this book or still waiting on a
  decision about it, else null.

Section `source` is `outline` or `inferred`; pages are 1-based inclusive
ranges.

`TaskJSON`: `id` (UUID string), `kind` (`prepare`|`homework` — the only two
kinds of work a student starts), `status` (`queued`|`running`|`paused`|
`failed`|`done`; stopping keeps the work, so a stopped task rests at
`paused`), `bookId`/`homeworkId` (nullable), `title` (what it is working on,
in the words a student uses), `phases` (a **flat ordered list** — no child
rows, so what runs is exactly what the student sees), `failKind`
(`transient`|`environment`|`permanent`, null unless failed), `retryable`
(bool — false for a permanent failure, because a Try again would fail
identically and offering it would be a lie), `error` (nullable),
`createdAt`, `startedAt`, `finishedAt` (RFC3339, nullable).

`PhaseJSON`: `id`, `taskId`, `key` (stable across resumes), `name` and
`note` (server-authored display strings; a phase with nothing to do is
`done` with a note explaining why), `status` (`waiting`|`running`|`done`|
`failed`), `done`, `total` (`0` means uncounted, so render no bar),
`etaSeconds` (null unless running and counted; computed from a rate stored
on the row, so it survives a pause and a restart), `error` (nullable),
`createdAt`, `startedAt`, `finishedAt`.

`ConversationJSON`: `id`, `title`, `pinned` (bool), `messageCount`,
`createdAt`, `lastActivityAt` (RFC3339 — the thread's last appended
message; rename and pin never move it), plus `bookId`, `bookSha256`,
`bookTitle` on the book-less routes (`GET/PATCH /api/conversations…`).

`messageJSON`: `id`, `role` (`user`|`assistant`), `citations` (int array,
`[]` when none), `createdAt`, and per role: user messages carry `content`
(plain question text, `segments: []`); assistant messages carry the ordered
`segments` — `{"type":"prose","text"}`, `{"type":"envelope","kind",
"payload":{…}}` (the validated JSON object), or the degraded
`{"type":"code","text"}` — with `content: ""`. The web renders segments
only; it never parses fences.

## Error mapping

Every failure answers `{"error": "<message>", "detail": ["…"]}`. `error` is
the user-facing message; `detail` lists the unwrapped error chain and is
omitted when empty. Statuses:

- typed resolver/guard outcomes — `NoMatchError` → 404;
  `AmbiguousError`, `TextLayerError`, `TaskSettledError` (stop of a resting
  task), `TaskActiveError` (retry of a queued/running task),
  `ResetBlockedError` → 409; `ErrNoPage` → 404
- `*engine.UserError`, `LLMUnconfiguredError` and `EmbedUnconfiguredError`
  (importing with no model connection) → 400
- anything else — 500 `{"error":"internal error","detail":[…]}`

## Async behaviour

Every task-creating endpoint answers 202 immediately; progress flows on
`GET /api/events` (a `snapshot` resets the client's store, then `task` and
`phase` deltas fold last-write-wins by id; phase progress/note churn is
coalesced to at most one emission per 250ms per phase). `GET /api/tasks` is
the polling fallback. Tasks survive restarts: a crashed run auto-resumes on
the next boot with its finished phases intact, and the phase that was
mid-flight goes back to `waiting`.

A configuration that a task would need is checked **before** the task is
created, not discovered mid-run: importing without an embeddings endpoint is
a 400, not forty minutes of wasted OCR followed by a failure.

## Tests

`api_test.go` covers health, JSON 404s, static serving + immutable cache,
shell fallback, missing-asset 404, the not-built case, and every route above
against a real engine + runner in `t.TempDir()` — imports seeded through
`SubmitImport` and executed with `Runner.Drain`. Tool-dependent tests skip
via `exec.LookPath` guards (poppler, tesseract). `ask_test.go` covers the
settings endpoints (including key redaction), the SSE ask against fake
model servers, conversations, embed submission, and page images.
