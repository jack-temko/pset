# Backend

The Go backend, built against the finished UI (grilled and decided
2026-09-21). This file owns the layering, the cross-cutting contracts
(ids, routes, errors, events, jobs, the document) and the choice of
models. Each package's own `README.md` owns its tables, its endpoints and
its edge cases.

The UI specs (`workspace.md`, `import.md`, `settings.md`) say *what* each
screen needs; this file says how the backend is shaped to give it.

## Layers and modules

Split **by feature**. A feature package owns its tables, its behaviour,
its HTTP handlers and its wire types, and nothing else touches its tables.

```
cmd/pset            wiring only: open the db, build features, start jobs, serve
internal/
  library           books, import, pages, scans, contents, search
  homework          sets, questions, locate, walkthroughs, due, worksheet PDF
  ask               turns, the tutor's turn as a job
  memory            what the tutor keeps about a book and the student
  settings          the key, health, reset, about
  activity          stretches of study, the week's stats
  agent             the tool loop Ask and homework guides both run: the tools,
                    the notes, the rounds
  doc               the document a model writes: block schemas, stream parser, runs, checks, repair, plot sampling
  jobs              the durable queue
  events            the in-process bus and the SSE endpoint
  db                SQLite open, migrations registry, tx helper
  httpx             router helpers, JSON in/out, the error type
  llm pdf ocr execx mathx pagenum probnum   leaves
```

**Dependency rule.** Features import shared packages (`jobs`, `events`,
`db`, `httpx`, `doc`, `agent`) and leaves, **never each other**. When a feature
needs another's data, it declares the smallest interface it needs, in its
own package, and `cmd/pset` passes the real one in:

```go
// package homework
type Pages interface {
    Search(ctx context.Context, book uuid.UUID, q string, k int) ([]Hit, error)
    Text(ctx context.Context, book uuid.UUID, from, to int) (string, error)
}
```

The interface's types are the consumer's own (`homework.Hit`, not
`library.Hit`), so `homework` compiles without `library`. Every
feature is then testable with a ten-line fake.

**Inside a feature**, one file per concern:

| File | Holds |
|---|---|
| `service.go` | Behaviour. Takes and returns domain types. No HTTP. |
| `store.go` | Its SQL, and its migrations. |
| `http.go` | Handlers: decode, call the service, encode. No logic. |
| `wire.go` | The JSON types the UI sees, and the event names. The only file the TS generator reads. |
| `README.md` | Contract, tables, edge cases. |

**Cross-feature deletes** are foreign keys with `ON DELETE CASCADE`: one
database, so removing a book takes its homework, questions, turns and
activity with it, atomically, without features calling each other.

## Identity and routes

**Everything is addressed by a UUID**, books included. A book's sha256 is
a unique column that catches duplicate imports; it is never an address.

**API routes are flat.** Each resource lives at its own id, and a path
never carries more than one id. Nesting appears only for "the children of
X", to list or create them:

```
GET    /api/books                        POST /api/books           (upload)
GET    /api/books/{id}                   PATCH, DELETE
POST   /api/books/{id}/stop              POST /api/books/{id}/retry
GET    /api/books/{id}/contents
GET    /api/books/{id}/pages/{n}/image?w=
GET    /api/books/{id}/homework          POST /api/books/{id}/homework
POST   /api/books/{id}/assignments/read  (a file, or {url} or {text}, maybe {setId}: starts a read, 202)
GET    /api/books/{id}/assignments/reads (reading, or read and waiting for review)
GET    /api/assignment-reads/{id}        DELETE (dismiss, stopping it)
POST   /api/assignment-reads/{id}/retry  (a failed read, again)
POST   /api/books/{id}/assignments       (the kept due dates: new sets, and updates to sets)
GET    /api/books/{id}/assignments/source (the course page last read)
POST   /api/books/{id}/references        (lines read in the book's numbering, as Add reads them)
GET    /api/homework/{id}                PATCH, DELETE
POST   /api/homework/{id}/questions      (batch of drafts)
POST   /api/homework/{id}/boxed          (one question from boxes drawn on the page)
GET    /api/homework/{id}/worksheet      (PDF)
PATCH  /api/questions/{id}               DELETE
POST   /api/questions/{id}/retry         {page} or {text}
POST   /api/questions/{id}/boxes         (point out a failed find on the page)
POST   /api/questions/{id}/guide         (write the guide for an unwritten question)
GET    /api/questions/{id}/figures/{n}   (a figure's crop, JPEG)
GET    /api/books/{id}/turns             POST /api/books/{id}/turns    DELETE (clear the conversation)
POST   /api/turns/{id}/stop
GET    /api/books/{id}/memories          POST /api/books/{id}/memories
DELETE /api/memories/{id}
GET    /api/due   GET /api/week?since=   POST /api/study
DELETE /api/study                       (clear activity history)
GET    /api/settings  PUT /api/settings  POST /api/settings/test
PUT    /api/settings/profile             (the name)
GET    /api/health    POST /api/health/{check}/fix
GET    /api/reset (dry run)  POST /api/reset
GET    /api/about     GET /api/events
```

**Browser routes stay as built:** `/books/{id}` and
`/books/{id}/homework/{id}`. The URL reads as where you are, and the book
id opens the workspace without waiting on the homework.

Page numbers on the wire are **PDF indexes**. The UI converts to printed
numbers with the book's page runs (`internal/pagenum`, `lib/pages.ts`).

## The contract with the UI

**Go is the source of truth.** Each feature's `wire.go` is generated into
`web/src/api/gen/<feature>.ts` by tygo (`make gen`), along with the error
codes. Event names are declared beside the wire types and registered by
string in the web's `api/` modules. The generated files are committed;
`make check-gen` fails when they are stale.
`web/src/components/fixtures.ts` is typed against the generated types and
feeds only the components page: a contract change breaks the build, not
the screen.

**The client side.** `web/src/api/client.ts` is one fetch wrapper that
throws a typed `ApiError`. Each feature gets `web/src/api/<feature>.ts`
with its query keys and hooks (`useBooks`, `useHomework`, ...), mirroring
the Go packages one to one. TanStack Query owns fetching and caching.

**Optimistic** for local toggles and order: reveal, got it, turned in,
reorder, remove a question, title and page-number edits. They apply at once
and roll back on failure. Anything that **starts work** (import, add
questions, retry, ask) waits for the server, then shows its real state.

**Every query draws a skeleton first**, per the design system's "nothing
jumps" rule: the Home tiles, bar, due list and shelf; the workspace rail,
transcript and homework list; the Settings fields. Scan images hold their
aspect box.

## Errors

One shape, everywhere: `{code, message, field?}`.

- `code` is a stable enum the UI switches on (`not_found`, `invalid`,
  `not_configured`, `duplicate_book`, `unreachable`, `bad_key`,
  `bad_model`, `busy`, ...). Generated into TS.
- `message` is display-ready copy, written to the design system's
  writing rules (no em dashes).
- `field` names the input at fault, so Settings can mark it.

`duplicate_book` carries the existing book's id; the UI navigates to it.

## Live updates

One stream: `GET /api/events` (SSE). Events are small and typed, and
each names what changed so the client can patch or invalidate exactly
those queries:

| Event | Carries | Client does |
|---|---|---|
| `book.changed` | the book (state: queued, preparing {phase, done?, total?}, ready, failed {reason}) | patch the book |
| `book.removed` | id | drop it |
| `homework.changed` | the set's summary | patch the set |
| `homework.removed` | id, bookId | drop it |
| `question.changed` | the question, with its `rev` | patch the question |
| `question.removed` | id, homeworkId | drop it |
| `assignment.changed` | the assignment read (reading, ready to review, failed) | patch the read |
| `assignment.removed` | id, bookId | drop it |
| `turn.changed` | the turn, with the blocks saved so far | patch the turn |
| `turn.block.start` | turnId, type | that block's skeleton |
| `turn.block.text` | turnId, runs | append to the open text block |
| `turn.block.repairing` | turnId, type | "Tidying" |
| `turn.block` / `.failed` | turnId, block | replace the skeleton (`.failed`: a raw block) |
| `turns.cleared` | bookId | empty the conversation |
| `memory.saved` / `.removed` | the memory / id | patch the menu |
| `reset` | nothing | refetch everything |

`reset` is the bus's own: it is sent to a client that reconnects with an
id the ring no longer holds, or one this run of the server never issued.

Every event has a monotonic id. The server keeps a ring buffer, so a
reconnect with `Last-Event-ID` replays what was missed; if the gap is
older than the buffer, the client invalidates everything.

**An older copy never wins** (2026-09-24). A request's reply is a
snapshot, and it can land after a newer event has applied. Books and
turns carry `updatedAt` and the cache keeps the newer copy. Questions
carry a **`rev`** that every change bumps, a database trigger rather
than each write, so none can forget; the cache keeps the higher rev,
which holds within a state too (a reveal drawn at once survives a
stale event from before it). A question's `updatedAt` stays when its
state began, for the waiting lines. A new turn's first event goes
out before its job can start, so nothing streams into a turn the page
doesn't hold yet; new questions are said the same way, before the queue
is woken, and the reply to adding them is the questions as added.

**Ask turns are jobs.** Leaving the workspace or reloading does not stop
an answer: coming back fetches the turn mid-flight and the stream carries
on. Stop is an explicit call.

## Jobs

A small durable queue, with no notion of UI "tasks". A job has a kind, a
lane, a subject id, a state (`queued`, `running`, `done`, `failed`,
`cancelled`), a payload and an error. Features register a handler per
kind and publish their own domain events; the queue publishes nothing to
the UI.

| Lane | Concurrency | Why |
|---|---|---|
| `import` | 1 | One at a time: every book examined first, then digital books ahead of scans (below). The UI shows "Queued" for the rest. |
| `question` | 2 | Two homework steps at once, finds and readings before guides (below). A constant, not a setting. |
| `turn` | 8, one per book | Many books may be answering at once; each book answers one question at a time (the job's key is the book). |

**Finds go first** (2026-09-24). A question is up to three jobs in the
`question` lane: `locate`, which finds it and queues its next step in
the same write; `read`, for a question with figures, which reads them
into words and queues the guide; then `guide`. A job carries a
priority, and a lane starts its highest first, oldest first among
equals; finds and readings run at 1. So a free slot always takes a
question still to be found or read before a guide: a set is found, and
its worksheet whole, first, its readings are there to check while its
guides wait, and a question added later is found in the next free
slot, ahead of guides already queued. A running
guide is never interrupted (its kind isn't resumable), so one may start
beside the last find once no find is waiting.

**A scan steps aside** (2026-09-24). An import is two jobs in the
`import` lane: `examine` at priority 2, which learns the title, the page
count and whether the book is digital or scanned, and queues `prepare`
in the same write: at 1 for a digital book, 0 for a scan. `prepare`
(reading a scan's pages, the contents, search) is **resumable**: it
saves every page and batch as it goes, so when a higher job waits, the
queue interrupts it (its context cancelled, as a shutdown does) and it
goes back to `queued` with its age, losing at most the page it was on.
A digital book added while a scan is being read is ready in minutes;
the scan carries on after it. Homework and Ask jobs are not resumable.

Cancel cancels the handler's context. On restart, `running` goes back to
`queued`. Retry re-enqueues with the same payload. Import's Stop leaves
the book `failed` with "Stopped", per the import spec; Dismiss deletes it.

## The document (structured guides)

Ask answers and homework guides are one format: a document of typed
blocks that the server checks, repairs and stores, and the UI draws
without parsing anything. Package `internal/doc`, whose README owns the
block types, how text is split into runs, streaming, the checks, repair,
plots, storage and the prompt. Two rules cross features: **nothing renders
red and nothing is dropped** (a block or math that can't be made valid is
kept and shown muted, as its source), and the guide prompt is the one
tested against the real model, static part first so the endpoint's cache
holds the long prefix.

## Finding and reading a problem

Package `internal/homework`, whose README owns it: a question is read as
the book problems it names, in the book's own numbering, and looked for
only where it can be; its figures are read out three times and settled
before the guide is written, and the guide works from that reading.
The evidence for the choices is in "Models" below.

## Models

PSet picks its models; the student saves an OpenRouter key and Settings
says which model does which job (2026-09-29). Each job went to the model
that did it best when they were run side by side, on the circuits book
and the probability book, through the eval key:

- **Finder**, `perceptron/perceptron-mk1.5`, with GLM-5.3-Flash behind it.
  On three pages of 23 problems, graded against the ink of each figure
  and statement: every figure boxed right, and 17 statements of 23, in
  2 s for $0.0005 a page. DeepSeek, the model before, got 7 figures and
  3 statements right as PSet used it; GLM 22 and 22 once snapped, in 7 s. Its boxes fit to the page's blocks
  (`pdf.SnapToBlocks`), which is most of any model's accuracy. Asked to
  think, it did far worse, so it's asked plain. Its words are less clean
  (the problem's number left in, math not always in `$`), so it writes
  none: it finds, and the Reader writes.

  **Its figures are checked** (2026-09-29), after the Reader has written
  the problem out. On the differential equations book the Finder boxed a
  figure on the problem's page for a problem whose figure is on another
  (7.1 #16's is three pages back), gave a problem its neighbour's figure,
  and once boxed the words "Figure 7.1.4" in the text. So a box too small
  to be a figure goes, the Reader reads each boxed figure's own caption,
  and one the problem doesn't name as "Figure N" goes (a run's "Figures
  1.1.5 through 1.1.10" doesn't count). A figure the problem names that
  wasn't boxed is looked for by the Finder on the problem's page, the
  pages whose text mentions it and the three either side, and kept when
  its caption says it's the one: it's stored with its own page. A problem
  that names no figure keeps what was boxed. A Finder reply that doesn't
  parse is tried once more with its brackets balanced, and a find whose
  number isn't the one asked for (a page that only said "See Problem
  14") isn't taken.

  **Snapping by rows** (2026-09-29): a block the box only partly holds is
  taken row band by row band. On the dense pages one block held the end
  of one problem and the start of the next, or a problem's last lines and
  the top of its figure. Problem text boxes went from 13 to 16 of 30 for
  the Finder there, and 6 to 14 of 15 for GLM; the circuits book's stayed
  as they were.

  **A problem's words are boxed from where it starts** (2026-09-29). The
  Finder's JSON box for them was its weak spot: 16 of 30 on the
  differential equations book's dense pages, where it boxed another
  problem or the first two lines of a long one. Asked in its own boxing
  mode (`<hint>BOX</hint>`) for every problem on the page, it finds where
  each starts far more surely; `pdf.TextExtent` then follows the ink down
  the problem's column (split at the page's gutter) until the next
  problem's start, one of its figures, or a gap wider than any inside a
  problem. Offline that boxed 24 of 30 there and 132 of 138 on the
  circuits book (17 of 23 before); in the app, 10 of 13 across both.
  Only "Problem N" labels count, on a box or its collection: it also
  boxes equations ("Equation (19)"), and on one page it put one label on
  many boxes. When it doesn't box the problem's start, the find's own
  box stands. It's one more call, $0.001 to $0.002 and 3 to 7 s. OCR was
  tried first as the anchor, and Tesseract read the direction fields of
  a scanned page as text and lost the problem numbers around them.
- **Reader**, `openai/gpt-6-luna`, with GLM-5.3-Flash behind it. Thirteen
  circuits read into netlists and graded by solving them: 13 right of 13,
  then 16 of 16, at $0.0004 a reading; DeepSeek got 11 and 36 of 39, at
  nine times the price. It writes out each found problem, and reads the
  figures, three times and then settled.

  **Writing a problem out** (2026-09-29) keeps what the tutor needs and
  nothing else. The book's part letters as printed: a part a. that is
  only a lead-in is still a. A problem in a run ("In each of Problems 11
  through 16, identify the equation…") opens with the run's shared text
  and what's printed with it, the a to j list to choose from included.
  A heading and its paragraph, figure and equation numbers as printed.
  Its own number, and a mark by it (the asterisk of a hard one), left
  out; the figures never described, since they're read on their own.
  Twelve problems from both books, the differential equations book's
  shared lists, a lead-in part and a run's intro among them, came out
  right; before, two in six lost what they needed.
- **Writer**, `deepseek/deepseek-v4.1-flash`. Six guides each: DeepSeek 5
  right, 5 s to 2.5 min, $0.14; Luna 5 right, 20 s to 2 min, $0.04; GLM 6
  right but 4 to 13 minutes, $0.13. DeepSeek's teach best: the book's
  theorems cited, notes where a student trips, checks. Luna's are plainer,
  and OpenRouter held a new account to 20 calls a minute of it (not
  published; its 429 said so), which six guides at once went over.

A self-reported confidence was tried on the readings and doesn't tell:
wrong readings claimed 88 to 96 out of 100, right ones 78 to 100. Three
readings that agree do: every circuit whose readings agreed was right,
and every one whose readings differed had a wrong one. So the settling
says where they differed (2026-09-29), and the student sees those points
to check (design/workspace.md, "The figure, as read"). Asked of three
Luna readings of 14 circuits, it named a point on 2: 4.72, where one
reading had the 2 A arrow backwards and another the 20 V's + on the wrong
end, both settled right, and 4.70, whose crossing has no dot. With one
reading changed on purpose, it named the change 6 times in 7, the
seventh a change that contradicted itself.

Three readings, not one, are why (2026-09-24, and still true with the
Reader): in PSet's prose, two of Luna's three single readings of 4.72
had a mistake. They add about $0.0012 and 7 s to a question with a
figure, $0.0015 for all four calls.

## Ask's agent loop

The Writer must take images (it looks at pages). Four tools, as few as
cover what a student needs:

| Tool | Does |
|---|---|
| `search_pages` | Hybrid full-text and vector search; returns pages and snippets. |
| `read_page` | The text of a page range, capped. |
| `view_page` | Puts a page image into the model's context: figures, tables, garbled text. |
| `compute` | `mathx` evaluate or solve, so worked arithmetic is checked, not guessed. |

Each tool call is a step on the feed, in the present tense while it runs
and the past tense with its count when done. The "About" chip sends the
question's context with the turn.

## Settings and data

Settings live **in SQLite**, with everything else. Reset stops the
queue, closes the database, empties the data directory, and reopens a
fresh one: a fresh install. The API key is stored as plain text, as the
Settings screen already shows it.

**Page scans render on demand**, per width bucket, cached under the data
directory and served `immutable`. Zoom asks for a bigger bucket.

**Time spent is stretches of study** (2026-09-29, replacing heartbeats,
which counted only with input in the last two minutes: homework is
worked on paper, and the week came out short). While the workspace tab
is visible, the client keeps one stretch open for what the student last
touched, `reading` (the scan or rail), `asking` (the Ask tab) or
`homework` (the Homework tab), and a new one when that changes. It ends
when the tab hides or closes, or when there's been no click, key, wheel
or scroll for 20 minutes on homework, or 5 otherwise. The client names
each stretch with an id and saves it, `POST /api/study {id, bookId,
kind, started, ended}`, every half-minute and once more as it ends (a
keepalive request, so it outlives a closing tab); saving the same id
again only moves its end on. Every save puts the end no later than a
minute after the last input, so time with no input counts once the
student is back, and a stretch that ends for want of input ends a
minute after the last. The server clamps an end to its own clock and a
stretch to six hours. `/api/week?since=` sums them from the start of the
student's week, which the client sends because it knows the local
calendar; overlapping stretches (two tabs) count once. `DELETE
/api/study` forgets them all (Settings' Clear history); questions worked
come from homework and stay. The heartbeats already recorded became
stretches, back-to-back beats run together, the same minutes.

**Time per question** (2026-09-30, the homework redesign): a `homework`
stretch names the question that was open, `questionId`, when the
Homework tab is showing one (not the list, not the finish page), and
moving to another question starts a new stretch. A question's `seconds`
is the union of its stretches, an overlap once, sent on the question as
of the snapshot (a stretch being worked is saved every half-minute, so
it runs a little behind). Only `homework` time is for a question; the
week's totals are unchanged.

## Logging

`slog` to stderr. Every LLM request and response, with the model's
reasoning, is also appended to a rotating JSONL log in the data
directory, so a bad or slow walkthrough traces back to its exact prompt
and thinking. Reset wipes it.

## Tests

Light, independent, aimed at edge cases.

- **Unit, per package:** table-driven tests on pure logic. Page offset
  detection, roman labels, the locate ladder's rungs, reorder and caps,
  queue transitions, the block parser, schema validation, plot sampling.
- **HTTP integration, per feature:** `httptest` against the real router,
  a temp SQLite, the fake LLM and a tiny fixture PDF. One happy path and
  the key failure path per endpoint group, decoding into the wire types.

No real model in any test.

## Dev loop

`make dev` runs the Go server with reload on save, Vite with `/api`
proxied to it, and the TS generator on Go changes, so a wire change shows
in the editor at once.
