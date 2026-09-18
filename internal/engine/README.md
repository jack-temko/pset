# engine

PSet's core layer: the ingest pipeline, the job runner, OCR, structure
extraction, doctor checks, structured reports, LLM settings, retrieval, and
the ask pipeline. It holds domain behaviour only — no transport, no
rendering. The API adapter drives an `Engine`.

## Homework pipeline (`homework.go`, `hwpdf.go`)

A homework assignment generates through a `homework` job: the **extract**
phase (one cheap text-only call lists the questions from the pasted source,
capped at 30, classifying each as `book` or `standalone`) declares one item
step per question (`question:<qid>`, `refType homework_question`), and each
item runs **locate** (FTS + vector candidates seeded by the section hint,
then one vision call pinning the page and normalized region rects) and
**guide** (a schema'd walkthrough JSON with the same repair-round machinery
ask uses), narrating on its step ("Locating question 3…" / "Writing the
walkthrough…"). Standalone questions — self-contained, not tied to the
book — skip locating; their guide runs from the statement plus a text-only
retrieval pass, so it can cite the pages that teach the material, and the
printed sheet shows the statement instead of a screenshot. Extraction is
idempotent: a resumed run sees the stored questions and never extracts
twice. Per-question failure is skip + warning (the outline row carries
`failed` + error); chat unconfigured parks the job `blocked` with the
reason; cancellation lands on a step checkpoint and keeps partials; every
terminal job state settles the homework `ready` (a shutdown pause or a
blocked park leaves it `generating` for the resume). Clients watch the
steps on `GET /api/events` and refetch the assignment when a
`homework_question` step changes.

- Tutor edits: `SendHomeworkCommand` plans ops over the outline with one
  call, validates them (ids exist, positions sane, caps hold), applies
  removals/reorders transactionally without the model, and runs adds
  through locate + guide, streaming its own SSE (`stage`, `question`,
  `question-removed`, `guide`, `done`, `error`). Direct
  `RemoveQuestion`/`AddQuestion`/`MoveQuestion` endpoints never touch the
  model; delete returns the row so the client's undo re-POSTs it verbatim.
- Deliverables: `HomeworkPDF` composes the Letter template deterministically
  with `internal/pdf`'s writer (header band + one question per sheet + JPEG
  region crops); `HomeworkQuestionImage` renders a single crop.

## Locate ladder (`locate.go`, `homework.go`)

Locating a question is a ladder, exact before fuzzy: the book's confirmed
label→page fact, then a deterministic scan for the question's own
section-and-item label as a line-start problem statement (references —
"Fig. 3.36", "(3.36)" — never hit), then the FTS + vector fusion seeded by
the printed-page offset and the section hint. One vision call per round
pins page + region rects, accepted as-is; the crop the student sees on the
card is the verification, and the locate prompt carries the rules that
keep chapter-end problems from being confused with same-numbered practice
problems. A round that produces no pin (the model refuses, goes off the
book, draws no usable region) widens the next one to deeper fused ranks.
When the text tiers run out,
a bounded chapter sweep reads the label's (or hint's) chapter as page
images — at most two batches of eight pages, walking batches from the end
of the section's span where chapter-end problem runs live — so a question
still pins when the text layer is noise. A student-pinned page never
sweeps, and a sweep whose chapter cannot be resolved fails honestly with
the pin-the-page suggestion. All locate paths (generation, adds, relocate)
share the ladder.

## Dependencies

- `internal/store` for all persistence and `internal/pdf` for poppler — the
  engine is the only layer that touches either
- `internal/ocr` for the tesseract backend
- `internal/llm` for the OpenAI-compatible model client (streaming chat +
  embeddings; dependency-free `net/http`, see that package's README)
- `github.com/santhosh-tekuri/jsonschema/v6` for envelope schema validation —
  pure Go, no cgo; chosen over a hand-rolled validator because the schemas
  (draft 2020-12, embedded verbatim) also get quoted into repair prompts, so
  the validating implementation should be a real one. It only decodes JSON
  and checks values; the wire and storage stay hand-rolled
- stdlib otherwise

## Configuration

`engine.New(engine.Config{DBPath, Logger, Progress})`. The database path
resolves in precedence order:

1. explicit `Config.DBPath`
2. `$PSET_DB`
3. `~/.pset/pset.db` (`DefaultDBPath`)

`~` is expanded and the result is made absolute; `Engine.DBPath()` returns
the resolved path. `Engine.Migrate(ctx)` brings the schema current — the
server calls it before listening. The data directory is the database's
parent; everything derived (library, spool, `config.json`) lives beside it,
so pointing `DBPath` at a temp dir relocates the whole engine for tests.

### LLM settings (`config.json`)

`Engine.Config(ctx)` loads `<data dir>/config.json` at call time (never
cached across writes); `Engine.SaveConfig` writes it with mode 0600. A
missing file yields the defaults:

| field | default |
|---|---|
| `apiBaseURL` | `https://api.z.ai/api/paas/v4` |
| `apiKey` | `""` |
| `embedBaseURL` | `http://localhost:11434/v1` (ollama) |
| `embedModel` | `nomic-embed-text` |

The chat model is not configurable: `llm.ChatModel` is one hardcoded
vision-capable constant. Asking is refused with `LLMUnconfiguredError`
(mapped to 400) while `apiBaseURL` or `apiKey` is empty; embedding runs
refuse with a Settings hint while `embedBaseURL` is empty.
`Engine.TestConnection(ctx, override)` dials both endpoints — a 1-token
non-streaming chat request and a probe embedding — and reports per-endpoint
`{ok, detail}`; a nil override tests the saved settings.

### Logging and events

- `Config.Logger` (`log/slog`) — the developer trace. Stage detail is
  `Debug`, anomalies `Warn`; `nil` discards. The server enables it on
  stderr under `--verbose`.
- `Config.Progress` — `Event{Kind, Message}` for state transitions
  (`started`/`step`/`warning`); `nil` discards. Job progress itself is
  persisted in the `jobs` table, not events — the API reads it from there.

Results are returned as data and rendered by adapters; the engine never
formats for a specific output.

## Tasks

All long-running work is a task: a `store.Task` row plus an ordered list of
`store.Phase` rows, executed by a [runner](#runner-runnergo).

There are exactly **two kinds** (`kinds.go`), because there are exactly two
things a student starts:

| Kind | Started by | Phases |
|---|---|---|
| `prepare` | importing a PDF | Examine → Read → Index → Build search |
| `homework` | creating an assignment | Read the assignment → Write the walkthroughs |

Everything else is a direct request that renders on the thing it affects —
see [Repairs](#repairs-repairgo). With a serial runner, queueing a
five-second walkthrough rewrite behind a forty-minute book would make it
wait an hour, so nothing short-lived goes through the queue.

### Phases are flat

`runPhases` (`pipeline.go`) declares the **whole plan up front**, so the
shape a student sees is stable from the first frame, then runs each phase
in order and skips the ones an earlier run finished. There are no child
rows: embed batches are an implementation detail of the search phase, and a
homework question's state lives on its own `homework_questions` row, where
the doors that repair it are.

A phase with nothing to do (reading a book that already has a text layer)
returns `&notNeeded{reason}` and finishes **done with a note**. That is a
finished phase, not a fourth outcome.

### Transient failures are invisible

`runPhase` retries a retryable failure in place — LLM 429s and 5xxs,
transport errors — up to `phaseAttempts`, with exponential backoff. A rate
limit is not something to show a student. When a phase gives up, the task
fails. One outcome, no policies, no attempt counters on the wire.

### Failure kinds

`failureKind` (`errors.go`) classifies every task failure, and adapters
render what they are told rather than parsing error text:

- **`permanent`** (`*PermanentError`) — an encrypted or corrupt PDF, a
  staged file that is gone. A retry would fail identically, so
  `TaskView.Retryable()` is false and no Try again is offered.
- **`environment`** (`*EnvironmentError`) — poppler or tesseract missing,
  disk full. Retryable once the machine is fixed.
- **`transient`** — everything else.

### Actions (`task.go`)

- `StopTask` rests a task where it stands. A queued one rests immediately; a
  running one stops at its next checkpoint. **Every finished phase is
  kept**, and the interrupted one returns to `waiting` so a retry resumes
  it. A task that is already resting refuses with `TaskSettledError`.
- `RetryTask` requeues a paused or failed task. Finished phases are never
  re-run — losing forty minutes of reading to a rate limit is the failure
  this rules out. A queued or running task refuses with `TaskActiveError`.
- `RemoveBook` (`books.go`) is the only door that deletes: it stops
  whatever is running, drops the book, its derived data, its tasks and its
  library copy.

### Preflight, not parking

Preparation ends in semantic search, and generation needs a chat model, so
both are **refused at submit** when the connection is missing
(`EmbedUnconfiguredError`, `LLMUnconfiguredError`). Nothing is queued, no
work is wasted, and no task can sit waiting on configuration — which is
what lets the `blocked` status leave the system entirely.

### Runner (`runner.go`)

One worker, one task at a time. That deletes the whole class of ordering
bugs — nothing can run out of order on a book because nothing runs
concurrently — along with type caps, the per-book lock, and every
server-authored wait string. A queued task is simply waiting its turn.

Each runner holds a **process lease** (`newOwner()`): `ReclaimOrphanedTasks`
requeues only tasks owned by a process that is gone, so a second `pset` on
the same database cannot yank the first one's running work.

`Drain(ctx)` runs the whole queue and returns — for tests and one-shot work.

### Resume

Every phase checkpoints against its own stored data, so a resume is free and
a restart costs nothing already done:

| Phase | Resume marker |
|---|---|
| `examine` | the book row; re-entering adopts it by SHA rather than skipping the rest |
| `read` | stored pages. A page whose tools **errored** stores as `failed` and is deliberately *not* a resume marker, so a retry re-attempts only those |
| `index` | none — it replaces the sections wholesale, and it is fast |
| `search` | stored vectors, page by page |
| `extract` | stored questions |
| `walkthroughs` | questions already `ready` |

`SavePhase` failures **fail the task** rather than being swallowed: a task
that cannot record its own state must not run on with the database
disagreeing about what happened.

### Lifecycle

`queued → running → done | failed | paused`. A student's stop rests the task
at `paused`; process shutdown returns it to `queued` so the next boot
resumes it. History prunes itself to the newest 25 finished tasks as they
settle, so nothing has to be cleared by hand.

### Progress and time left

Each phase carries `done`/`total` (`total: 0` means uncounted) and a `rate`
in units per second, **persisted on the row** so "about 2 min left" survives
a pause, a resume and a restart. There is no job-level percentage: the four
phases of a preparation are wildly unequal, so one overall bar would lie.
Clients show the running phase's bar plus its position in the plan.

## Readiness is derived (`store/ready.go`)

A book is **Ready, or Not ready with a reason**. There is no partial
capability and no stored flag — `text_state`, `index_state` and
`search_state` are gone, because every bug they caused was a flag that
outlived its data.

```
ready(book) :=
      pages stored     == page_count
  AND pages failed     == 0
  AND sections          > 0
  AND vectors          >= pages with text
```

One query, always true, self-healing across crashes. The result is cached on
`books.ready` for cheap reads, but the cache is an optimization — any read
path may recompute, and `RefreshReady` runs whenever a task touches a book.

**A blank page is not a failure.** `ocr.Page` errors only when a *process*
fails; a genuinely blank page (an image-only figure, a chapter divider)
exits 0 and returns nothing. Both now get a `pages` row carrying
`ocr_status` — `text`, `blank` or `failed` — so coverage is always complete,
a blank page never blocks a book, and a crashed page is visible, countable
and precisely re-attemptable.

## Repairs (`repair.go`)

Repairing one homework question is a direct request, not a task. Each one
touches exactly the stage that was wrong and nothing else in the assignment:

| Door | Re-runs | Invalidates |
|---|---|---|
| `EditQuestionText` | nothing | the walkthrough only — correcting a transcription does not change which problem it is |
| `AdjustQuestion` | nothing (hand corrections: page, crop, standalone) | the walkthrough, only when the page moves |
| `RelocateQuestion` | locate, then guide | the walkthrough, always |
| `RewriteQuestion` | guide | nothing else |

An invalidated walkthrough is marked `stale` rather than silently
regenerated: the card says it is out of date and offers a rewrite.

### The failure that does not fail

Locating the wrong problem — `Practice 3.4` instead of `Problem 3.4` —
never errors. It returns confidently, the question goes `ready`, and the
student gets a polished walkthrough for the wrong problem. Three things
answer it:

1. **The book remembers** (`facts.go`, `store/facts.go`). A per-book fact
   store feeds every locate call and seeds candidate pages directly. The
   highest-value fact is nearly free: the **page offset** is learned by
   *arithmetic* from a corrected location (`pdfPage − printedPage`), with no
   model call, and a question citing a printed page then needs no retrieval
   at all.
2. **The self-check pass** (`checkLocation`). After locating, a cheap second
   call reads the chosen region and says whether it really is the problem
   that was asked for. A rejection is carried into one retry, so the model
   cannot make the same mistake twice. The check is a safety net, not a
   gate: if it cannot run, the pin is accepted.
3. **The crop** is shown on the question card, so a wrong match is obvious
   at a glance rather than discoverable only by reading a walkthrough.

There is no confirm button. Silence is acceptance; only an explicit
correction writes a fact, so the fact store learns from real signal only.

## Ocr

Local tesseract backend (`internal/ocr`): rasterize each page at 300 DPI
with `pdftoppm`, OCR it, store it. A stored page row (even empty text from
a blank page) is the done-marker, so runs are resumable by construction;
when every page is stored, `text_state` becomes `ocr`. Guard: a `full`
book refuses with `TextLayerError` ("OCR is only for scanned books"); an
`ocr` book is a completed no-op.

## Structure

Extracts a book's sections and stores them with page ranges. Three sources,
first match wins:

1. **outline** — `pdftohtml -xml` on the library copy; ≥1 bookmark entry
   becomes the section list (levels from nesting, stored 1-based). When an
   outline exists, inference never runs.
2. **font inference** — `full` books without an outline: lines whose font
   size clears 1.25x the coverage-weighted body median and stay within 80
   characters, flat at level 1, `source: inferred`.
3. **pattern pass** — `ocr` books (image-only PDF, so poppler sees
   nothing): structural lines over the stored page text — `Chapter N …`,
   `1.2 Something`, short ALL-CAPS lines — flat at level 1, `source:
   inferred`. The classifier (`pattern.go`) is a pure function over text.

Guard: a `none` book (no text layer, no OCR text) refuses with
`TextLayerError`. End pages: each section runs to one page before the next
section at the same or shallower level (clamped to its own start); the last
section of each branch runs to the book's page count. One store transaction
replaces the book's sections, then `index_state` becomes `full` — or stays
`none` when nothing was found (a warning, not an error). Re-running
replaces — no duplicates.

The derivation helpers (`outlineSections`, `inferSections`, `assignEndPages`
in `structure.go`, the pattern classifier in `pattern.go`) are pure and
unit-test on canned data without poppler.

## Retrieval and Ask (`search.go` + `ask.go` + `envelope.go`)

`Engine.Ask(ctx, target, conversationID, question, page, onStart, emit)` answers a
question about one book and streams the reply through `emit` as typed
`AskEvent`s. A positive `page` anchors the ask: it leads the context pages
and is named to the model as the primary one (the reader's "ask about this
page"), while the stored question stays exactly as asked. The conversation
is loaded (it must exist and belong to the
book) or created with the question — truncated to ~60 characters — as its
title; the user
message is stored before streaming. `onStart` fires once retrieval is done
and the model request is about to stream, carrying the conversation id, the
context pages, and any degradation warnings — the moment for the API to
start its SSE response. Failures before that point return as ordinary
errors; after it they surface the same way and the adapter reports them
mid-stream.

Retrieval fuses two lists per ask:

1. **FTS** — `store.SearchFTS` over `pages_fts` (bm25 ranked), depth 20.
2. **Vectors** — the question embedded with the configured model, cosine
   similarity against the book's stored page vectors, depth 20.

`rrfMerge` combines them by reciprocal rank (score = Σ 1/(60 + rank) over
the lists containing a page; ties break by page number, so the result is
deterministic) and keeps the top 6 pages (`topKPages`). A failing
embeddings endpoint degrades the ask to text search with a warning — it
never fails the ask. A book with no stored pages at all is refused with
`TextLayerError` advising an import/OCR first.

The model request is a single multimodal call (`buildAskMessages`, pure):
the system prompt carries the honesty contract (transcribe formulas exactly,
pages arrive both as garbled text and images, cite `[p. N]` for a single
page or `[pp. N-M]` for a run of pages, admit insufficient context and cite
the best page anyway) plus the
JSON envelope contract: a fenced block tagged with the kind whose contents
are exactly one JSON object of that kind's shape — `equation`, `steps`,
`theorem`, `definition`, or `note`, one worked example each, no nesting,
unknown tags fall back to code blocks, `[p. N]` only in text fields,
`equations[]` entries are bare TeX (no `$$` anywhere). The last 6
conversation turns follow as history (rendered back to model text by
`messageText` — answers re-fence their envelopes),
and one user message carries the
question, the book's sections as "Title — pages a–b" lines, and each
retrieved page as a labelled text block plus a PNG image block (150 DPI via
`pdf.PageImage`; a page that fails to render is skipped with a warning).

### Envelope pipeline (`envelope.go`)

The model's streamed text is consumed by `envelopeSplitter`, which re-emits
typed events and collects the answer's ordered segments — no layer after
the engine ever parses a fence:

- prose passes through as `delta`s (line-buffered, so a chunk that ends
  mid-line settles first);
- a fence with a known kind tag opens → `envelope-start`;
- the closing fence extracts the payload, JSON-decodes and schema-validates
  it (embedded draft 2020-12 schemas in `schemas/*.schema.json`,
  `additionalProperties: false`, caps documented in the files);
- failure runs exactly one non-streaming repair call (`ChatOnce`, same
  model and connection settings as the ask) carrying the kind, the invalid
  payload, the validator's error list, and the schema verbatim; the reply
  may be fence-wrapped; a re-validated repair emits `envelope`;
- a still-invalid payload, an erroring/timed-out repair call, or the stream
  ending mid-envelope degrade to `envelope-failed {kind, raw}` — nothing is
  ever dropped.

After streaming, citations are `parseCitations` over the segments' text:
prose, degraded payloads, and the text fields of validated envelopes
(title/statement/steps/body/note) — never `equations[]`, which are bare
TeX. `parseCitations` matches every `[p. 12]` / `[p12]` / `[p 12]` /
`[page 3]` marker plus range forms like `[pp. 58-61]` / `[p. 58–61]`
(hyphen or en dash; a range contributes both endpoints), sorted and unique
(pure, unit-tested). The answer is stored as the segment list
(`store.Segment`: prose, envelope with the validated payload, code with the
raw arrived text), so what is stored is exactly what the user saw, repairs
included.

Read helpers: `Conversations(ctx, target)` lists a book's threads with
message counts, `Conversation(ctx, target, id)` returns one thread with its
messages (a thread of another book is not found), and
`DeleteConversation(ctx, target, id)` removes it.
`ConversationByRef(ctx, id)` / `AllConversations(ctx)` are the book-less
forms for the global history list and `?c=` links, and
`UpdateConversation(ctx, id, title, pinned)` renames and/or pins by id
alone (nil fields keep their column; last activity is not touched).
`PageImage(ctx, target,
n)` renders a stored page as PNG, mirroring `PageText`'s `ErrNoPage`.

Model-call failures wrap in `UserError` with a clean message; the typed
`llm.LLMError{Status, Body}` stays reachable through the chain for verbose
output.

## Reads

- `BookStatuses(ctx)` — every book with its **derived** readiness, the
  pages a tool failed to read, and the task that explains a book which is
  not ready; `BookStatus(ctx, target)` is the resolved single-book form.
- `RemoveBook(ctx, target)` — the only door that deletes.
- `BookSections(ctx, target)` — a book's stored sections in sort order.
- `PageText(ctx, target, n)` — one stored page (`ErrNoPage` when absent).
- `TaskView(ctx, id)` / `TaskViews(ctx)` — task rows enriched with what
  they are working on and their phases in plan order, each phase carrying a
  live eta while it runs; `TaskViews` lists active FIFO, then the ones
  waiting on a decision, then finished newest-first.
- `SubscribeEvents()` — the task/phase change stream (`task` with the full
  row, `phase` single rows, `task_removed`); progress/note churn coalesces
  to one emission per 250ms per phase while status transitions emit
  immediately. The `EventStarted/EventPhase/EventWarning` notify machinery
  stays for CLI adapters.

### Identity

Every entity (books, pages, sections, jobs) carries a UUIDv7 string id
generated by the store; foreign keys reference those UUIDs. Books are
additionally addressed by their sha256. `resolveBook` matches a target in
order: exact book UUID, exact stored path, sha256 prefix (4+ chars),
case-insensitive title substring.

### Errors

User-facing failures wrap in `UserError`: `Message` is a clean sentence for
the user; the chain stays reachable via `Unwrap` and `errors.Is`-checkable.
Adapters render `Message` and dump the chain only in verbose mode. Typed
outcomes let adapters map without string matching: `NoMatchError`,
`AmbiguousError` (lists matching titles), `TextLayerError` (refusals that
hinge on the PDF's text layer, with a `Problem` describing which side),
`JobFinishedError` (cancel of a finished job), `ResetBlockedError` (reset
while jobs are active), `LLMUnconfiguredError` (an ask without a chat
connection — mapped to 400 by the API), and the `ErrNoPage` sentinel.

## Reset

`Engine.Reset(ctx, ResetOptions{Apply}) (*ResetResult, error)` reverts the
database and library to base state (no books/pages/sections, empty library,
schema current); without `Apply` it only counts
(`ResetResult{Books, Pages, LibraryFiles}`). Refuses with
`ResetBlockedError` while any job is queued or running.

## Doctor

`Engine.Doctor(ctx, DoctorOptions{Fix, LookPath}) *Report` never fails for a
broken setup — everything found is in the `Report`. Check-only by default;
`Fix` repairs what it can (directories mode 0700, migrations). Checks:
`data dir`, `database` (quick_check + version/migrate), `poppler`
(`pdfinfo`/`pdftotext`), `tesseract`. `LookPath` defaults to
`exec.LookPath`; tests inject a stub.

`Report` carries per-check `Status` (`ok`/`fixed`/`warn`/`failed`) and
findings with severities; `Report.OK()` is false only on a `failed` check.
Adapters render reports however they like.
