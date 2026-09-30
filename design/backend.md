# Backend

The Go rewrite, against the finished UI. Grilled and decided 2026-09-21.
This file owns the layering, the cross-cutting contracts (ids, routes,
errors, events, jobs, the document) and the build order. Each package's own
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
  ignored. Books are re-imported (which also works out their page numbering);
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
  doc               the document a model writes: block schemas, stream parser, runs, checks, repair, plot sampling
  jobs              the durable queue
  events            the in-process bus and the SSE endpoint
  db                SQLite open, migrations registry, tx helper
  httpx             router helpers, JSON in/out, the error type
  llm pdf ocr mathx leaves
```

**Dependency rule.** Features import shared packages (`jobs`, `events`,
`db`, `httpx`, `doc`) and leaves, **never each other**. When a feature
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
POST   /api/books/{id}/assignments/read  (a file, or {url} or {text}, maybe {setId}: starts a read, 202)
GET    /api/books/{id}/assignments/reads (reading, or read and waiting for review)
GET    /api/assignment-reads/{id}        DELETE (dismiss, stopping it)
POST   /api/assignment-reads/{id}/retry  (a failed read, again)
POST   /api/books/{id}/assignments       (the kept due dates: new sets, and updates to sets)
GET    /api/books/{id}/assignments/source (the course page last read)
GET    /api/homework/{id}                PATCH, DELETE
POST   /api/homework/{id}/questions      (batch of drafts)
POST   /api/books/{id}/references        (lines read in the book's numbering, as Add reads them)
GET    /api/homework/{id}/worksheet      (PDF)
PATCH  /api/questions/{id}               DELETE
POST   /api/questions/{id}/retry         {page} or {text}
GET    /api/books/{id}/turns             POST /api/books/{id}/turns
POST   /api/turns/{id}/stop
GET    /api/due   GET /api/week   POST /api/heartbeat
DELETE /api/heartbeats                   (clear activity history)
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
| `book.changed` | id, state (queued, preparing {phase, done?, total?}, ready, failed {reason}) | patch the book |
| `book.removed` | id | drop it |
| `homework.changed` | id | invalidate the set |
| `question.changed` | id, homeworkId, state | patch the question |
| `turn.step` | turnId, step (present tense), running | append or update the step |
| `turn.block.start` | turnId, type | that block's skeleton |
| `turn.block.text` | turnId, runs | the open text block's new runs |
| `turn.block.repairing` | turnId, type | "Tidying" |
| `turn.block` / `.failed` | turnId, block | replace the skeleton (`.failed`: a raw block) |
| `turn.done` / `.stopped` / `.failed` | turnId | settle |

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
| `turn` | 1 per book | One running conversation per book. |

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

Decided 2026-09-28, built 2026-09-29 (ideas/structured-guides.md has the
grill and the evaluation). One format for Ask answers and homework
guides: **a document of typed blocks that the server checks, repairs and
stores, and the UI draws without parsing anything.** Package
`internal/doc`.

**The blocks.** `hint`, `part`, `step`, `para`, `note`, `math`,
`derivation`, `callout`, `statement`, `table`, `plot`, `code`, `answer`,
and `raw` (what could not be made valid). `part` and `step` are flat
markers like headings: everything after one belongs to it until the
next, and the renderer builds the tree. Each type has a JSON Schema
(`schemas/`, `additionalProperties: false`); the Go wire types
(`wire.go`) are generated into `web/src/api/gen/doc.ts` by tygo.

**Text is written as strings and stored as runs.** The model writes
inline math as `\(...\)` and a `$` is only ever money. `Split` turns a
string into runs (`{t}` with `b`, `i`, `code`; `{m}` math, `d` for
display; `{cite}` a PDF page, moved from the printed one). A `$...$` the
model wrote anyway is converted by the strict pandoc rule: an opening
`$` has a non-space after it, a closing one a non-space before it and no
digit after it, `\$` inside math is a dollar, and a bare `$` that can't
close holds no math ("costs $20 ... $M$" is money, then math). Math that
is only money (`$\$20$`) becomes the text "$20", `\$` outside math is a
dollar, `\textit` and `\textbf` are marks. Statements, professor's notes
and figure readings are runs too, split when written (`doc.Text`: math
KaTeX can't parse is marked `raw`, never repaired, since it isn't the
model's writing) and shown to the model, or to the student to edit, as
the string form again (`doc.Source`).

**Streaming.** The model's reply is JSON lines in plain content, after
its tool calls (a final "write" tool call arrives all at once, and
Z.ai's `tool_choice` only takes `auto`). The parser reads leniently
first: a backslash that starts no JSON escape is doubled (`\(`), a
control character before letters in a `tex` field or a math run is the
backslash a JSON escape ate (`\frac` read as a form feed), a raw newline
in a string is escaped, and an object may run over lines.
`block.start {type}` fires as soon as the type has arrived; a text
block's open field streams, words as they come, a math run or a bold
phrase whole once it has closed. **Only the final round is the
document**: text a guide writes in a round that ends in tool calls is
narration and is dropped (`agent.Loop.Aside`), and so is text before the
first block ("Here is the guide."). Ask's blocks may come between tool
calls; its step feed records how many blocks were written when each call
ran. A guide is `Complete` once a hint and an answer have arrived, so a
guide that writes itself and then calls `remember` is finished.

**Checks, in order, for each block:** its schema; the split; TeX or a
math delimiter left in plain text; every math run, `tex` field and
derivation line through **KaTeX in goja** (`web/src/lib/katex-check.ts`
bundled by `npm run build:check` into `internal/doc/katex-check.js`,
embedded, loaded lazily, run under a lock with a 3 second cap, with the
options the renderer uses, `web/src/lib/math.ts`; a test ties the
bundle's version to the pin in `web/package.json`); and citations (every
page is in the book). A plot's numbers written as constants in strings
("11/12") are read, and an expression in the axis's own variable
(`b^2 - b`, x-axis `b`) is sampled as written.

**Repair is targeted**, at most two tries per failure and six calls per
document, at `reasoning_effort: "low"` (`llm.Client.Mechanical`). A bad
math run sends only that span and KaTeX's message and is spliced back; a
text field with TeX in it sends the field; a bad block sends the block,
its schema and the problems; a line that isn't JSON (after the lenient
parse) is rewritten as blocks. The UI's label is "Tidying". When the
document ends, the whole-document checks: a guide with no hint gets one
call ("write the hint"), and a part with no answer one call each ("write
the answer for (b)"); both go through the block checks. Still bad: a
math run is kept with `raw: true` and shown as its source in muted mono,
a block becomes a `raw` block, muted. **Nothing renders red and nothing
is dropped.**

**Plots are expressions, sampled by `mathx`.** A series is `{label,
expr, domain}` (or `{label, points}`); the wire payload is always
points. Optional `marks` are labeled points `{x, y, label}` and
vertical guides `{x, label}`. At most two series; one y-axis.

**Storage.** A turn stores its blocks. A question's `hint` and
`walkthrough` are blocks: the first `hint` is the hint, any other
becomes a note, and the Answers veil is derived from the walkthrough's
`answer` blocks. **Guides use the same machinery, stage by stage:** the
hint is published (as `question.changed`) as soon as the block after it
arrives, so a student can open it while the rest is written; the
walkthrough is saved once its parts all have answers. A guide that comes
back without a hint or an answer is asked for once more.

**The prompt.** The guide prompt is the one tested against the real
model, verbatim: homework's "How to work" rules, then `doc.GuideWriting`
(the format, the blocks, the marks in text fields, how it should read,
and a worked example from a subject no book on the shelf covers). Ask
shares the block lines and the text rules (`doc.AskWriting`: no hint, no
answer). The static part comes first and the problem and the book last,
so the endpoint's implicit cache holds the long prefix.

**The wipe** (migrations `homework/12` and `ask/2`, 2026-09-29): every
Ask turn deleted; every question's `hint`, `walkthrough`, `revealed`,
saved rounds and the memory lines its guide made cleared, and a question
that had a guide set to `unwritten`; statements, notes and readings
re-split into runs. Books, sets, questions, due dates and Complete marks
stay. An `unwritten` question offers **Write the guide**
(`POST /api/questions/{id}/guide`); nothing writes one unasked.

**Finding a problem starts from its reference** (2026-09-25). A
question is read as the book problems it names, in the book's own
numbering (`reference.go`; the numbering is `internal/probnum`, detected
at import). When the numbering and the contents can place it, it is
looked for there and only there (`scope.go`): a section's pages from its
Problems heading to its end, a chapter's problems, or a cited page and
its neighbours. The page whose text has the problem's own line ("7."
after the section's heading, "4.25 ...", "2.1.4 ...") comes first, then
the pages memory points to, then the rest of the span, a few at a time.
Each page shown to the model carries its printed page and section, and
the model is told how the book prints the number, since a problems page
rarely prints its section. A pick outside the span is another problem
with the same number and doesn't count; a reference that can't be found
there fails as "Looked through Section 3.1 (p. 106 to p. 112)...", rather
than landing on a wrong page. References that name no numbers, and
books without contents, keep the older ladder: exact tiers, search,
memory, then a sweep of the chapter.

**Figures are read out before the guide** (2026-09-24). A misread
figure was the likeliest way for a guide to be wrong: the 4.25 guide had
its 2 A source backwards. Three things fixed it:

- **The model's crops are cut from a 2400px render**, not the 1800 the
  walkthrough and the worksheet use. At 1800 that source's arrow read as
  pointing left eleven times in eleven; at 2400, right every time.
- **Reading is its own step.** Three quick readings (low effort, at
  once), each listing every node, then every part between two nodes with
  its value and direction, are settled into one by a careful call that
  keeps what they agree on and looks at the figure where they differ.
  One reading alone got a node or an arrow wrong about one time in four;
  a single reading "checked" against the figure had its wrong nodes
  fixed but its right arrows talked out of. Settled, the set's hardest
  five figures came out right ten times in ten.
- **The guide works from the reading**, which opens its brief under the
  figures: "where your own look at the figures disagrees, the reading
  is right". The student sees the reading and can correct it
  (design/workspace.md); a corrected reading writes the guide again and
  is the student's word, over the figure.

A reading that fails leaves none, and the guide reads the figures itself.

**The writer sees the problem's figures, not its page.** A problem with
figures opens with them cut from the page (as the walkthrough shows
them, from the wider render); one without gets the page. The pages memory names that a search
for the problem also finds open the guide too, so the writer doesn't
spend a round reading them. Each tool round is saved on the question as
it finishes, so a restart, or a retry of the same problem, carries on
from the last round instead of starting over. A model's reasoning goes
back with its turn through OpenRouter, so it carries on from its own
thinking rather than redoing it after every tool call; only hosts
serving full-precision weights are used, and a guide's calls share one
OpenRouter session (internal/llm/README.md, "Providers").
The writer's brief is a short rule list, how to work before what to
write: set the problem up as equations and let `compute` and
`solve_linear` do every number in the guide, checks included.

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

**Time stats come from heartbeats.** While the workspace tab is visible
and there was input in the last two minutes, the client sends
`{book, kind}` every 30 seconds: whichever of `reading` (the scan or
rail), `asking` (the Ask tab) or `homework` (the Homework tab) was last
touched. Each heartbeat counts 30 seconds (a second tab in the same
half-minute counts once), and `/api/week?since=` sums them from the
start of the student's week, which the client sends because it knows
the local calendar. `DELETE /api/heartbeats` forgets them all
(Settings' Clear history); questions worked come from homework and
stay.

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

## Build order

Each step is live end to end before the next starts.

1. **Foundation:** `db`, `jobs`, `events`, `httpx`, the generator, the
   client, the query client, `make dev`.
2. **Settings:** the smallest feature, proving the whole path.
3. **Library:** upload, the import queue, scans, contents, offset, book
   edits and removal. Home's shelf and the workspace scan go live.
4. **Homework:** sets, questions, locate, walkthroughs, due, worksheet.
5. **Ask:** turns, the agent loop, the document.
6. **Activity:** heartbeats and the week.

## What the UI still needs for this

- Ask: the **pending block** state (a shaped skeleton per type, a text
  block's words streaming into it, with the "Writing" and "Tidying"
  labels) and the **raw block** (muted).
- Walkthrough: each stage fills **independently** as its event arrives.
- Routes switch from book sha to book id.
- Skeletons on every query listed above, and the SSE reconnect.
