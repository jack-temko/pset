# Task system redesign

Status: spec, approved from the grill session of 2026-09-16.
Supersedes `jobs-pipeline-spec.md` and `jobs-pipeline-build.md` for
everything they say about vocabulary, states, surfaces, cancel/retry,
scheduling, and readiness. `homework-backend-spec.md` remains superseded
for its event/retry routes.

---

## Why

The task system grew a general-purpose job engine — six job statuses, six
step statuses, three exhaustion policies, parent/child step trees, per-step
attempt counters, submit-time retry overrides, a four-worker pool with
per-type caps and a per-book lock — for a single-user local study app whose
users initiate exactly **two** kinds of work: import a book, and generate a
homework.

That generality bought real bugs, not just noise:

- A book row can be created, fail before its pages are inserted, and become
  permanently unrecoverable: retry re-enters `examine`, matches the book by
  SHA, takes the duplicate branch, sets `dupImport`, and every later phase
  self-skips — the job reports **completed** with an empty book
  (`import.go:326-350`, `import.go:269-275`).
- `search_state` is set to `full` on embed success regardless of coverage
  (`embed.go:27`), so a book can claim semantic search with vectors for a
  fraction of its pages.
- `text_state` is written only after the whole OCR loop, so a stopped OCR
  leaves stored pages with `text_state='none'` — a book `SubmitIndex`
  refuses and `SubmitEmbed` accepts.
- A fresh ingest holds no book lock (its `book_id` is NULL at claim), so
  OCR and embed can run out of order on the same book.
- `ResetStuckJobs` is `UPDATE jobs SET status='queued' WHERE status='running'`
  with no process lease — a second `pset` on the same DB yanks the first's
  running jobs.
- Ask requires an embeddings *endpoint* but tolerates **zero stored
  embeddings**: `vectorSearch` returns an empty ranking, `rrfMerge` degrades
  to FTS-only, and nothing tells the user (`ask.go:307-315`).
- A crashed OCR page is `Warnf`'d and skipped with **no page row inserted**
  (`ocr.go:123-124`), making it indistinguishable from a page never reached.

The UI inherited all of it. A dropped SSE stream deliberately renders
nothing (`events.ts:86-91`), so a dead server leaves a spinner turning
forever. A failed retry disables its own button permanently
(`step-checklist.tsx:54-64`). A failed cancel is silent. `jobForBook`
searches only active jobs, so a failed import just loses its spinner and
looks normal. The library refetches when `active.length` *decreases*, so
one task finishing as another starts never refreshes. Per-question redo
dead-ends forever after `Clear finished`.

The redesign is not a cleanup pass. It replaces the model with one built
around what pset actually does.

---

## 1. Principles

1. **Two task kinds.** Preparing a book, and generating an assignment.
   Nothing else is a task.
2. **The task system owns work that is long, resumable, and
   object-building.** Everything else is a direct request that renders on
   the thing it affects. A walkthrough rewrite is one LLM call — queued
   behind a 40-minute OCR it would wait an hour, so it is never queued.
3. **Count, don't trust.** Readiness is derived from data, never from a
   stored flag. No flag can lie because no flag exists.
4. **Nothing half-built is usable, and nothing half-built is hidden.** A
   book is Ready, or it is Not ready with a reason and a button.
5. **Stopping and failing keep the work.** Only an explicit Remove deletes.
6. **Repair is scoped to the stage that was wrong.** Never re-do correct
   work to fix incorrect work.
7. **Corrections teach.** Every fix a student makes durably reduces the
   next fix.

---

## 2. The task model

### Two kinds

| Kind | Created by | Phases |
|---|---|---|
| `prepare` | importing a PDF | Examine → Read → Index → Search |
| `homework` | creating an assignment | Read the assignment → Write the walkthroughs |

`ocr`, `index`, and `embed` cease to exist as job types. They were both
phases inside ingest *and* standalone jobs with their own buttons — two
doors for the same work, in violation of `ui-rules.md`. The engine keeps
the phase implementations; it drops the job types, the submit routes, and
the `OcrAction` / `IndexAction` / `EmbedAction` components.

### Steps are flat

A task has an ordered list of phases. No parent/child step rows, no
`parent_id`, no item children. Embed's `batch:<n>` rows collapse into one
Search phase with page-level progress; homework questions stop being step
rows entirely and live on `homework_questions`, where the workspace already
needs them.

### States

Task status: `queued` · `running` · `paused` · `failed` · `done`.

Phase status: `waiting` · `running` · `done` · `failed`.

`blocked` is **deleted**. Its only producers were "no chat model" and "no
embeddings endpoint", and both are now refused at submit (§5), so nothing
can park. `cancelled` is **deleted** and replaced by `paused` — stopping
keeps the work, so there is nothing terminal about it. `skipped` is
**deleted**: a phase that has nothing to do (OCR on a digital book) is
`done` with a note, not a fourth outcome.

That is 5 task states and 4 phase states, down from 6 and 6, with every
remaining one corresponding to something a student can see and act on.

### Retry policy

Per-step `attempts` / `max_attempts` columns, submit-time `maxAttempts`
overrides (`SubmitOptions.MaxAttempts`, `engine.go:136-143`, the
`maxAttempts` request field), and the three-way `Exhaustion` enum all go
away. In their place:

- Transient failures inside a phase (LLM 429/5xx, transport, `SQLITE_BUSY`)
  retry in place with exponential backoff, invisibly, as an implementation
  detail of that phase. The existing `isRetryable` classifier
  (`steps.go:84-95`) is the right one; keep it.
- When a phase gives up, the **task** fails. One outcome, no policies.

### Failures are classified

Every task failure carries a kind:

- **`transient`** — LLM timeout, tesseract crash, disk full, network. Retry
  is the primary action.
- **`environment`** — poppler or tesseract not installed. Retry after you
  fix the machine; the message names the tool and points at `pset doctor`.
- **`permanent`** — the PDF is encrypted, corrupt, or has zero pages. Retry
  would fail identically, so **no Retry button is offered** — just the
  explanation and Remove book.

The engine classifies; the UI renders what it is told and never guesses
from error text (see `removals.md:27` — the `/settings/i` regex guess is
already a removal).

---

## 3. Readiness is derived

Drop `books.text_state`, `books.index_state`, `books.search_state`, and the
dead `jobs.stage` / `pages_done` / `pages_total` columns.

```
ready(book) :=
      count(pages where book_id = ?)  ==  book.page_count
  AND count(pages where ocr_status = 'failed')  ==  0
  AND count(sections where book_id = ?)  >  0
  AND count(embeddings where book_id = ? and model = <current>)  ==  book.page_count
```

One query, always true, self-healing across crashes and manual DB surgery.
A book that loses data is instantly not-ready and offers Retry. No write
site can drift because there is nothing to write.

Cache the computed result on the book row and recompute whenever a task
touches the book — but the cache is an optimization, never the source of
truth; any read path may recompute.

### Page outcomes

`pages` gains `ocr_status`: `text` · `blank` · `failed`, plus an `error`
column.

Blank is not failure. `ocr.Page` errors only when a *process* fails —
`pdftoppm` exits non-zero, produces no PNG, or `tesseract` exits non-zero
(`ocr/ocr.go:44,60,65`). A genuinely blank page (an image-only figure, a
chapter divider) exits 0 and returns `""`. Today the first case inserts no
row and the second inserts an empty one, which is why a crashed page is
invisible.

**Every page always gets a row.** Coverage is therefore always 100%, and
readiness can be strict about real failures without a blank page ever
blocking a book. Retry re-attempts only the `failed` rows — seconds, not
forty minutes.

```
Calculus, 8th ed.
  ⚠ Not ready — 2 pages couldn't be read
     p.87   tesseract crashed
     p.214  couldn't rasterize
     [Try those 2 again]
```

31 blank pages in the same book: fine, never mentioned.

### Not-ready books everywhere

A not-ready book — preparing, paused, or failed — is **visible everywhere
and usable nowhere**.

| Surface | Behavior |
|---|---|
| Library | Shown, dimmed, with its state and actions on the card |
| Reader | Redirects to the book page, which shows preparation |
| Ask | Absent from the book picker |
| Homework | Absent from the source-book picker |

One rule, no exceptions, no partial-capability states to reason about.

---

## 4. One "not ready" state, three reasons

Stop and failure are the same state with different causes and different
sentences. Neither deletes.

```
Not ready · Paused
  You stopped this at page 340.
  [Resume]        [Remove book]

Not ready · Couldn't prepare          (transient / environment)
  tesseract isn't installed.
  [Try again]     [Remove book]

Not ready · Can't be prepared          (permanent)
  This PDF is encrypted and pset can't open it.
                  [Remove book]

Not ready · Needs you
  pset needs a model connection to finish.
  [Open Settings] [Remove book]
```

**Remove book** is the only action that deletes. It is confirmed, and it
removes the book row, its derived data, and its library PDF. It is
available in every state including Ready.

Rationale: the great majority of failures are recoverable — LLM 429s,
`SQLITE_BUSY`, a crash mid-OCR, a missing tool, an unset key — and resume
is already designed in (`ocr.go:114` skips stored pages, `embed.go:198`
skips vectored pages). Deleting on failure would throw away hours of OCR to
recover from a rate limit.

### Retry resumes

Retry picks up where it stopped. Completed phases are not re-run;
already-read pages and already-built vectors are kept. This is the single
most important property of the system — a server crash at page 380 of 412
must not cost forty minutes.

Hardening required for resume to be trustworthy:

1. **`examine` commits atomically.** Book row, pages, and page count in one
   transaction. This kills the permanently-empty-book bug outright.
2. **The duplicate branch never self-skips a not-ready book.** Re-entering
   `examine` and finding the book by SHA means *resume*, not *skip*.
3. **Search completion is verified by count**, not assumed from a
   successful call.
4. **`ResetStuckJobs` takes a process lease.** A running task is owned by a
   PID + boot token; only a task whose owner is provably gone is requeued.
5. **`saveStep` / `SaveJob` failures are not swallowed** (`steps.go:419`,
   `runner.go:420`). A task that cannot persist its own state fails loudly.

---

## 5. Preflight, not blocking

Preparation requires an embeddings endpoint, and generation requires a chat
model. Today both discover this mid-run: a fresh install does all 40
minutes of OCR and then fails on the last phase (`embed.go:117`).

**Both are refused at the door.**

```
┌────────────────────────────┐
│ ⚠ pset needs a model       │
│   connection before it can │
│   prepare books.           │
│   [Open Settings]          │
└────────────────────────────┘
```

Nothing is queued, no work is wasted, and no task can ever park waiting on
configuration — which is what lets `blocked` leave the system.

A key revoked mid-run is a `transient` failure like any other: the task
fails, and Retry resumes once the key is valid.

---

## 6. Scheduling: strictly serial

One worker. One task at a time.

This deletes `workerPoolSize`, `typeCaps`, `bookRuns`, `slotFree`,
`typeRuns`, `bookHolder`, `waitReason`, `queuePosition`, `ordinal`, and
every server-authored wait string ("waiting for a free OCR slot", "2nd in
queue"). Queued tasks show `Waiting`, and the card says how many.

It also deletes the entire class of ordering bugs: nothing can run out of
order on a book, because nothing runs concurrently at all. For a
single-user local app importing a handful of books, throughput was never
the constraint; correctness and comprehensibility were.

Graceful shutdown pauses the running task (status `paused`, reason
"interrupted"), and it auto-resumes on next boot.

---

## 7. Surfaces

Exactly three, down from six. The navbar pill and the task popover are
**removed**.

### The Tasks card — bottom of the sidebar

Pinned at the bottom of the sidebar, above a full `Settings` nav item. It
is the command center: only what a student needs.

```
idle:
  Tasks

working:
┌─ Tasks ─────────────────┐
│ Reading Calculus, 8e    │
│ ████████░░░░   340/412  │
│ ● ● ○ ○   about 2 min   │
│                 [Stop]  │
│ 1 more waiting          │
└─────────────────────────┘

attention:
┌─ Tasks ─────────────────┐
│ ⚠ Calculus, 8th ed.     │
│   Couldn't prepare      │
│           [Try again]   │
└─────────────────────────┘

connection lost:
┌─ Tasks ─────────────────┐
│ ⚠ Lost touch with pset. │
│   Reconnecting…         │
│                         │
│ Reading Calculus, 8e    │
│ ████████░░░░   340/412  │
│ (as of 2 min ago)       │
└─────────────────────────┘
```

**Contents while working**: what's happening in plain words (the book title
and a human phase name — never `ingest`, never `OCR the pages`), a progress
bar with its count, time remaining, a Stop button, and a count of what's
waiting.

**Progress is the current phase, plus a pip strip.** The four phases are
wildly unequal — Examine takes seconds, Read up to forty minutes, Index
seconds, Search minutes — so a single 0–100% bar would lie. The bar is
always "this phase, 340/412"; four pips beneath show position in the
sequence.

**Attention state** is destructive and persists until resolved. It is
earned by: a book that failed to prepare, homework questions that need
attention, and a lost connection. It is **not** earned by a book you
paused — that was your own choice, the library card already says so, and
alarming on it cries wolf.

**Idle collapses** to a single quiet `Tasks` row.

### The `/tasks` page

Where you go to fix things, not to watch them. Holds history.

```
⚠ Import   Calculus, 8th ed.
   tesseract isn't installed
   ✓ Examined   ✗ Read the pages   · Index   · Search
   [Try again]   [Remove book]

▶ Homework  Problem Set 4 · Calculus, 8e
   ✓ Read the assignment   ▶ Walkthroughs 12/18
   [Stop]
```

Phases are listed inline and always visible — no expanding, no chevrons.
History is capped at the newest ~25 finished tasks and pruned
automatically; the `Clear finished` button is removed along with the
unbounded history it existed to manage. (`removals.md:26` had removed the
retention sweep in favor of `Clear finished`; this reverses that decision
and that line needs updating.)

### In place, on the object

The library card, the book page, and the homework workspace each show their
own state and their own actions, as specified in §3–§4.

### Connection honesty

The server heartbeats every 15s as a real `ping` **event** — an SSE comment
would keep proxies happy but is invisible to `EventSource`, so a client could
not use it to tell an idle stream from a dead one. Two missed
pings and the card stops pretending: it dims, says it lost touch, stamps
the frozen numbers with "as of N ago", and retries with backoff. Progress
freezes *visibly* instead of silently.

This also fixes the surrounding client bugs: step events for unknown tasks
must trigger a resync rather than being dropped (`events.ts:45-47`); a
failed retry must re-enable its button (`step-checklist.tsx:54-64`); a
failed stop must say so; and library refresh must key on task identity, not
on `active.length` decreasing (`library/index.tsx:88-93`).

### ETA survives

Today the ETA window is in-memory on the Runner, keyed by job, and dropped
on release (`eta.go`, `runner.go:226`) — so it resets on every restart and
every pause. Persist the rolling rate on the phase row so "about 2 min
left" survives a resume.

---

## 8. Homework

### Readiness is by stage, not all-or-nothing

Unlike a book, an assignment with 17 of 18 walkthroughs is genuinely
useful. It opens; the one broken question shows its own state.

```
Problem Set 4   Calculus, 8e
  12 of 18 walkthroughs

Problem Set 3   Calculus, 8e
  ⚠ 2 questions need attention

Problem Set 2   Calculus, 8e
  Ready · 18 questions
```

Partiality is only worth having if it is repairable without a full re-run,
which is what the rest of this section is for.

### The dangerous failure is the one that doesn't fail

Each question has two stages with separately-inspectable outputs. `locate`
produces `page` + `question_rect` + `diagrams` — a page number and a crop.
`guide` writes the walkthrough *from* that location.

When locate grabs **Practice 3.4** instead of **Problem 3.4**, it does not
error. It returns confidently, the question goes `ready`, and the student
gets a polished walkthrough for the wrong problem. No task state will ever
flag this, because nothing failed.

So the design has three answers, in order of how much they ask of the
student:

#### a. The book remembers

A per-book facts store, fed into every locate call and used to seed
candidate pages directly:

```
Calculus, 8th ed. · what pset knows
  Page offset      +14   (confirmed ×3)
  Problem sets     end of each section
  Practice items   inline, skip these
  Confirmed        3.4 → p228   5.1 → p301
```

The highest-value fact is nearly free: **the page offset**. Printed page
214 is PDF page 228. It is learned by *arithmetic* from any confirmed
location — `pdfPage − printedPage`, mode over confirmations — with no model
call at all. Once known, "problem 3.4" doesn't need retrieval; the section
map from the Index phase (already built, currently barely used by locate)
gives the section, and the offset gives the page.

This is **not** a long-lived conversation context. A durable distilled fact
table is crash-safe, inspectable, cheap, and doesn't degrade as it fills.

#### b. The self-check pass

After locating, a cheap second call verifies the found region actually
matches the question number before the result is accepted.

```
locate → p.214 "3.4 Practice…"
  ↓ self-check
  ✗ numbering mismatch: wanted Problem 3.4, found Practice 3.4
  ↓ retry, now knowing that
  ✓ p.228 "3.4 Evaluate the integral…"
```

This catches the wrong-problem case automatically, before the student ever
sees it, and what it learns goes into the facts table.

#### c. Visual verification

The question card shows the crop of what was found, so a wrong match is
obvious at a glance rather than discoverable only by reading a whole
walkthrough.

```
Q7  Problem 3.4
┌─ found on p.228 ──────────┐
│ [crop of the page region] │
│ 3.4 Evaluate the integral │
└───────────────────────────┘
  Not the right one?  [Adjust]

Walkthrough…                [Redo]
```

There is **no confirm button**. Silence is acceptance; only an explicit
correction writes a fact, so the facts table learns from real signal only.

### Two repair channels

**The tutor chat** handles everything conversational. It exists today
(`SendHomeworkCommand`, `homework.go:1012`) but only plans three ops —
`remove`, `move`, `add` (`homework.go:993-999`). It gains three more:

| Op | Effect |
|---|---|
| `edit` | change a question's transcription |
| `relocate` | re-run locate with a note and/or an explicit page |
| `rewrite` | re-run guide with an instruction |

> "q7 grabbed the practice one, I need the end-of-section problem"
> → `relocate(q7, note)`

**The Adjust panel** is hand work only — no text input, hidden until
opened:

```
Adjust · Q7
  Page   [228]
  ⬚ drag to reframe the question
  ⬚ drag to reframe each figure
  ☐ Not from the book          (standalone)
```

Crop handles save immediately with no model call. The `standalone` flag
already exists on `homework_questions`.

### Repair is stage-scoped

| You change | Invalidates | Cost |
|---|---|---|
| Question text | the walkthrough only — the location is still the right problem | one call |
| Location | the walkthrough, automatically | two calls |
| Walkthrough (`Redo`) | nothing else | one call |
| Re-read the assignment | everything — destructive, confirmed | full re-run |

An edited question marks its walkthrough stale rather than silently
regenerating:

```
Q7  [edit]
  Evalute the intergal…
       ↓ edited
  Evaluate the integral of…

  ⚠ Walkthrough is out of date   [Rewrite]
```

Nothing else in the assignment is ever touched by a scoped repair.

### Repairs are not tasks

Every repair above is a direct request that renders on the question card —
never a queued task, never in the sidebar or on `/tasks`. With a serial
runner, a five-second rewrite queued behind a forty-minute OCR would wait
an hour.

The server completes the write even if the student navigates away, so
coming back shows the new walkthrough. No extra machinery is needed for
that.

---

## 9. Ask

Ask must stop silently lying. Today it requires an embeddings *endpoint*
but tolerates zero stored embeddings, degrading to FTS-only with no signal
(`ask.go:307-315`). Under derived readiness this is impossible by
construction — a book without full vector coverage is not ready and is not
in the picker — but the check must be explicit rather than incidental, and
`internal/engine/README.md:281-282` (which documents the opposite of what
the code does) must be corrected.

---

## 10. What is deleted

**Backend**

- Job types `ocr`, `index`, `embed`; routes `POST /api/books/{sha}/ocr`,
  `/index`, `/embed`
- Statuses `blocked`, `cancelled`, `skipped`
- `job_steps.parent_id` and all item-child machinery
  (`runChildren`, `embedBatches`, `questionSpecs` as steps)
- `attempts` / `max_attempts` columns, `SubmitOptions.MaxAttempts`, the
  `maxAttempts` request field, `recordSubmitOverrides`,
  `dropSubmitOverrides`
- The `Exhaustion` enum and `OnExhausted` / `OnSkipped`
- `workerPoolSize`, `typeCaps`, `bookRuns`, `slotFree`, `waitReason`,
  `queuePosition`, `ordinal`
- `books.text_state`, `index_state`, `search_state`;
  `jobs.stage`, `pages_done`, `pages_total`
- `PruneFinishedJobs` (already prod-dead), `ClearFinishedJobs`, and
  `POST /api/jobs/clear-finished`
- `StepByKey`'s parent-blind lookup (`job_steps.go:169-180`)

**Frontend**

- `components/task-center.tsx` (pill + popover), `job-row.tsx`'s variants,
  `step-checklist.tsx`'s `AttemptsBadge`, `ItemGroup`, `ItemRow`,
  `WarningsChip`, per-child `RetryButton`
- `ocr-action.tsx`, `index-action.tsx`, `embed-action.tsx`
- `text-state-badge.tsx` (the word "indexed" currently means two different
  things on `book-detail.tsx` simultaneously)
- The `/tasks` filter chips and `Clear finished`
- Dead API surface: `JobsApi.connected`, `jobById`, `useJob`, `api.jobs()`,
  `api.job()`
- `import-dialog.tsx`'s hardcoded `NEXT_STEPS` restatement of the pipeline

`design/removals.md` gains a line for each of these at implementation time,
and its line 26 (retention sweep removed in favor of `Clear finished`) is
reversed by §7.

---

## 11. Migration

**Clean break.** The schema is reset again, as it was once before
(`removals.md:21`, v1–v7 → a single v1). No migration code, no legacy
shapes, one schema to reason about.

```
pset's storage changed.
Your PDFs are safe in ~/.pset/library/
  [Start fresh and re-import]
```

---

## 12. Docs to update with the implementation

- `web/src/pages/tasks/README.md` — the page spec; rewrite before the HTML,
  per `web/README.md`
- `web/src/pages/library/README.md`, `homework/README.md`,
  `book-detail`'s section of the library doc
- `internal/engine/README.md` — the jobs section, the retention claim at
  `:135-136`, the Ask claim at `:281-282`
- `internal/api/README.md` — the route table and the "last 20 finished"
  claim at `:78`
- `internal/store/README.md` — the `jobs` / `job_steps` tables
- `design/removals.md` — one line per removal in §10
- `README.md` — the status paragraph still says "serial job queue" (true
  again after §6) and describes the task center as a navbar pill

Per `AGENTS.md`, `web/e2e/states.ts` is updated **first**, before any UI
work, and the visual suite is the acceptance gate.
