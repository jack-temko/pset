# Backend

The Go rewrite, against the finished UI. Grilled and decided 2026-09-21.
This file owns the layering, the cross-cutting contracts (ids, routes,
errors, events, jobs, cards) and the build order. Each package's own
`README.md` owns its tables, its endpoints and its edge cases.

The UI specs (`workspace.md`, `import.md`, `settings.md`) say *what* each
screen needs; this file says how the engine is shaped to give it.

## Scope

- **Kept, tidied:** the leaf packages `pdf`, `ocr`, `mathx`, `llm`.
- **Rewritten from scratch:** everything that was `engine`, `store` and
  `api`. The old code stays in git as a reference to lift proven logic
  from (the locate ladder, OCR, structure extraction, embeddings, the
  worksheet writer, the repair loop), never as a shape to keep.
- **Fresh schema.** Migration 1 is the new schema; the old database is
  ignored. Books are re-imported (which also computes their page offset);
  old homework and conversations are gone.

## Layers and modules

Split **by feature**. A feature package owns its tables, its behaviour,
its HTTP handlers and its wire types, and nothing else touches its tables.

```
cmd/pset            wiring only: open the db, build features, start jobs, serve
internal/
  library           books, import, pages, scans, contents, search
  homework          sets, questions, locate, walkthroughs, due, worksheet PDF
  ask               turns, the agent loop, its tools
  settings          connections, health, reset, about
  activity          heartbeats, the week's stats
  cards             envelope kinds: schemas, stream parser, repair, plot sampling
  jobs              the durable queue
  events            the in-process bus and the SSE endpoint
  db                SQLite open, migrations registry, tx helper
  httpx             router helpers, JSON in/out, the error type
  llm pdf ocr mathx leaves
```

**Dependency rule.** Features import shared packages (`jobs`, `events`,
`db`, `httpx`, `cards`) and leaves, **never each other**. When a feature
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
| `wire.go` | The JSON types the UI sees. The only file the TS generator reads. |
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
GET    /api/homework/{id}                PATCH, DELETE
POST   /api/homework/{id}/questions      (batch of drafts)
GET    /api/homework/{id}/worksheet      (PDF)
PATCH  /api/questions/{id}               DELETE
POST   /api/questions/{id}/retry         {page} or {text}
GET    /api/books/{id}/turns             POST /api/books/{id}/turns
POST   /api/turns/{id}/stop
GET    /api/due   GET /api/week   POST /api/heartbeat
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
numbers with the book's offset, as it already does.

## The contract with the UI

**Go is the source of truth.** Each feature's `wire.go` is generated into
`web/src/api/gen/<feature>.ts` (tygo or similar), along with the event
union and the error codes. The generated files are committed; a check
fails when they are stale. `sample.ts` shrinks to
`web/src/components/fixtures.ts`, typed against the generated types, and
feeds only the components page: a contract change breaks the build, not
the screen.

**The client side.** `web/src/api/client.ts` is one fetch wrapper that
throws a typed `ApiError`. Each feature gets `web/src/api/<feature>.ts`
with its query keys and hooks (`useBooks`, `useHomework`, ...), mirroring
the Go packages one to one. TanStack Query owns fetching and caching.

**Optimistic** for local toggles and order: reveal, got it, turned in,
reorder, remove a question, title and offset edits. They apply at once
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
| `book.changed` | id, state (queued, preparing {phase, done?, total?}, ready, failed {reason}) | patch the book |
| `book.removed` | id | drop it |
| `homework.changed` | id | invalidate the set |
| `question.changed` | id, homeworkId, state | patch the question |
| `question.stage` | id, stage (hint, walkthrough), payload | fill that stage |
| `turn.step` | turnId, step (present tense), running | append or update the step |
| `turn.delta` | turnId, text | append prose |
| `turn.card.start` / `.repairing` | turnId, kind | shaped skeleton, label |
| `turn.card` / `.failed` | turnId, kind, payload or raw | replace the skeleton |
| `turn.done` / `.stopped` / `.failed` | turnId | settle |

Every event has a monotonic id. The server keeps a ring buffer, so a
reconnect with `Last-Event-ID` replays what was missed; if the gap is
older than the buffer, the client invalidates everything.

**An older copy never wins** (2026-09-24). A request's reply is a
snapshot, and it can land after a newer event has applied. Books and
turns carry `updatedAt` and the cache keeps the newer copy; questions
only move forward through their states. A new turn's first event goes
out before its job can start, so nothing streams into a turn the page
doesn't hold yet.

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
| `question` | 2 | Two homework steps at once, finds before guides (below). A constant, not a setting. |
| `turn` | 1 per book | One running conversation per book. |

**Finds go first** (2026-09-24). A question is two jobs in the
`question` lane: `locate`, which finds it and queues its guide in the same
write, then `guide`. A job carries a priority, and a lane starts its
highest first, oldest first among equals; finds run at 1. So a free
slot always takes a question still to be found before a guide: a set is
found, and its worksheet whole, first, and a question added later is
found in the next free slot, ahead of guides already queued. A running
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

## Cards (envelopes)

Kept from the old envelope spec, retargeted to the new card set:
**statement, steps, plot, table, code**. The UI never parses a fence.

1. The model writes a card as a fenced block whose tag names the kind:
   ```` ```plot {json} ``` ````. This works with small local models, and
   the skeleton can show the moment the fence opens.
2. The engine parses it out of the stream. On open it emits
   `card.start {kind}`: the UI draws that card's skeleton in its real
   shape, labelled "Writing a plot".
3. On close it validates against the kind's JSON Schema (embedded,
   `additionalProperties: false`). On failure, one repair call with the
   schema and the errors; the UI's label becomes "Tidying the plot".
4. Valid: `card {kind, payload}` replaces the skeleton in place. Still
   invalid: `card.failed {kind, raw}`, shown as a muted code block.
   Nothing is ever dropped.

**Plots are expressions, sampled by `mathx`.** A series is
`{label, expr, domain}` (or `{label, points}` for tabular data); the
server samples it and the wire payload is always points, so the UI's
`Plot` is unchanged. A bad expression fails validation and goes to
repair. At most two series; one y-axis.

A turn is stored as its ordered segments (prose and cards), exactly what
the student saw.

**Walkthroughs use the same machinery, stage by stage.** The hint and
the walkthrough are each validated and pushed as `question.stage` as soon
as they are done, so a student can open the hint while the walkthrough
is still being written.

**The writer sees the problem's figures, not its page.** A problem with
figures opens with them cut from the page (the crops the walkthrough
shows); one without gets the page. The pages memory names that a search
for the problem also finds open the guide too, so the writer doesn't
spend a round reading them. Each tool round is saved on the question as
it finishes, so a restart, or a retry of the same problem, carries on
from the last round instead of starting over. A model's reasoning goes
back with its turn to endpoints that keep it (Z.ai), so it carries on
from its own thinking rather than redoing it after every tool call.
The writer's brief is a short rule list, how to work before what to
write: set the problem up as equations and let `compute` and
`solve_linear` do every number in the guide, checks included.

## Ask's agent loop

The chat model is required to be a vision model. Four tools, as few as
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

**Time stats come from heartbeats.** While the workspace tab is visible
and there was input in the last two minutes, the client sends
`{book, kind}` every 30 seconds: whichever of `reading` (the scan or
rail), `asking` (the Ask tab) or `homework` (the Homework tab) was last
touched. Each heartbeat counts 30 seconds (a second tab in the same
half-minute counts once), and `/api/week?since=` sums them from the
start of the student's week, which the client sends because it knows
the local calendar.

## Logging

`slog` to stderr. Every LLM request and response, with the model's
reasoning, is also appended to a rotating JSONL log in the data
directory, so a bad or slow walkthrough traces back to its exact prompt
and thinking. Reset wipes it.

## Tests

Light, independent, aimed at edge cases.

- **Unit, per package:** table-driven tests on pure logic. Page offset
  detection, roman labels, the locate ladder's rungs, reorder and caps,
  queue transitions, the fence parser, schema validation, plot sampling.
- **HTTP integration, per feature:** `httptest` against the real router,
  a temp SQLite, the fake LLM and a tiny fixture PDF. One happy path and
  the key failure path per endpoint group, decoding into the wire types.

No real model in any test.

## Dev loop

`make dev` runs the Go server with reload on save, Vite with `/api`
proxied to it, and the TS generator on Go changes, so a wire change shows
in the editor at once.

## Build order

Each step is live end to end before the next starts.

1. **Foundation:** `db`, `jobs`, `events`, `httpx`, the generator, the
   client, the query client, `make dev`.
2. **Settings:** the smallest feature, proving the whole path.
3. **Library:** upload, the import queue, scans, contents, offset, book
   edits and removal. Home's shelf and the workspace scan go live.
4. **Homework:** sets, questions, locate, walkthroughs, due, worksheet.
5. **Ask:** turns, the agent loop, cards.
6. **Activity:** heartbeats and the week.

## What the UI still needs for this

- Ask: the **pending card** state (a shaped skeleton per kind, with the
  "Writing" and "Tidying" labels) and the **failed card** (muted raw
  block).
- Walkthrough: each stage fills **independently** as its event arrives.
- Routes switch from book sha to book id.
- Skeletons on every query listed above, and the SSE reconnect.
