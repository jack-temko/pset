# Jobs pipeline v2 — generic steps, retry, concurrency (spec v1)

Grilled and decided 2026-09-15. Replaces the single-stage plumbing in
`internal/engine/runner.go` + `internal/store/jobs.go` and the task-center UI.
One milestone: all five job types (ingest, ocr, index, embed, homework) cut
over together; no period of two coexisting job systems.

## Principles

- A **step** is the single unit of execution, resume, retry, and progress.
  Jobs are typed Go handlers on a generic engine; the engine knows nothing
  about books, OCR, or homework — only jobs and steps.
- Step plans are a **static skeleton declared at claim time plus dynamic
  item children** discovered while running. Conditional phases are declared
  and self-skip (stable plan in the UI), never popped in/out of existence.
- Item state is **unified**: homework questions and embed batches are step
  rows, not a second progress system. Domain tables keep content only.
- **Cancel + retry doubles as pause/resume.** No separate pause feature.
  Completed steps are never re-run by a retry.

## Contract

Job statuses: `queued`, `running`, `completed`, `failed`, `cancelled`,
`blocked` (new — waiting on user action, reason in `error`).

Step statuses: `pending`, `running`, `completed`, `failed`, `skipped`
(exhausted retries with skip semantics, or not-needed), `cancelled`.

Actions and their semantics:

- **Cancel** (any non-terminal job): running step stops at its next
  checkpoint, incomplete steps → `cancelled`, job → `cancelled`. Terminal.
- **Retry** (from `failed`, `cancelled`, `blocked`, or `completed`-with-skips):
  job → `queued`; steps `failed`/`cancelled` → `pending` with attempts reset;
  `skipped` steps stay skipped unless individually retried; `completed` steps
  never re-run. **Step retry** is the same operation scoped to one step key
  (and its children). The homework per-question retry route is replaced by
  this.
- **Blocked**: raised by a handler (e.g. LLM unconfigured). Job parks in
  `blocked` with the reason; Retry re-enqueues, Cancel allowed.
- Submit payloads accept optional `maxAttempts` overrides keyed by step key;
  the effective policy is persisted on each step row at creation.

Idempotency: skeletons are (re)built at claim via upsert on
`(job_id, parent_id, key)`; item discovery must be idempotent by key
(re-running extract after a crash must not duplicate questions).

## Behavior

### Scheduler

- Worker pool of W goroutines (default 4) replaces the single serial runner.
- Per-type caps (code constants, not user config): ocr 1, ingest 2, index 2,
  embed 3, homework 2. Per-book mutex keyed by `book_id`; jobs without a
  book take no lock.
- Selection: oldest queued job whose type slot and book lock are free. No
  head-of-line blocking — a job waiting on its book does not stall other
  books.
- Wait reasons are computed at read time for queued jobs: `nth in queue` /
  `type cap reached` / `waiting on <job> for this book`.
- Shutdown (ctx done): running jobs return to `queued`, the interrupted step
  returns to `pending`, completed steps persist. Boot: requeue stuck
  `running` jobs (today's `ResetStuckJobs`) and reset `running` steps.

### Step execution

Each step runs a retry loop:

1. Persist `attempts` (1-based), run the executor.
2. Success → `completed`. Stop requests (cancel/shutdown checkpoint) →
   runner handles; no attempt consumed.
3. Failure: if the error is not retryable or attempts are exhausted → the
   step's declared exhaustion action: **fail** (step `failed`, job `failed`),
   **skip** (step `skipped` + warning, job continues), or **block** (job
   `blocked` with reason, step back to `pending` with the reason as note).
4. Otherwise sleep `backoff × 2^(attempt-1) + jitter` (checkpoint-aware),
   holding the worker slot; loop.

Retryability defaults to errors explicitly marked retryable (LLM transport
failures, 429/5xx); user-facing errors and bad-input errors are not. Backoff
base default 2s. Executors get a `StepHandle`: `Progress(done, total)`,
`Note(text)`, `Warnf(...)`, `Checkpoint()`, `AddChild(key, name, ref)`.

### Mappings (all five types)

- **ingest**: skeleton `store → text → ocr → toc`. The OCR phase always
  exists and self-skips with "PDF has a text layer" when not needed. Text/OCR
  keep page counters with idempotent re-scan (no per-page rows).
- **ocr / index / embed**: single-phase jobs. Embed fans out batch item steps
  (key `batch:<n>`, ref none); each batch is the retry unit.
- **homework**: skeleton `extract → questions`. Extract is one phase step;
  each question is an item step (key `question:<qid>`,
  ref `homework_question:<qid>`) that runs locate then guide internally with
  live notes. Per-question isolation matches today: one failed question skips
  with a warning; the run continues. Question execution status/error derive
  from item steps; `homework_questions` keeps content only.

### ETA

`etaWindow` generalizes to per-running-step rolling rates. Job ETA appears
only while remaining work is countable (sum of remaining units over step
rates).

## Data model

New table `job_steps` (SQLite migration, additive; `jobs.status` is TEXT so
`blocked` needs no column change):

```
id            TEXT PRIMARY KEY
job_id        TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE
parent_id     TEXT NULL REFERENCES job_steps(id)   -- null = phase step
seq           INTEGER NOT NULL                      -- order within parent
key           TEXT NOT NULL                         -- 'ocr', 'question:<qid>'
name          TEXT NOT NULL                         -- display label
status        TEXT NOT NULL DEFAULT 'pending'
done          INTEGER NOT NULL DEFAULT 0
total         INTEGER NOT NULL DEFAULT 0            -- 0 = uncounted
note          TEXT NOT NULL DEFAULT ''              -- live, last-write-wins
attempts      INTEGER NOT NULL DEFAULT 0
max_attempts  INTEGER NOT NULL DEFAULT 1
error         TEXT NOT NULL DEFAULT ''
ref_type      TEXT NULL                             -- 'homework_question' | 'book'
ref_id        TEXT NULL
created_at / started_at / finished_at TEXT NULL
UNIQUE (job_id, parent_id, key)
```

No append-only event log. Retention: keep the last 20 finished jobs with
their steps; older jobs (cascade) swept after each settle. In-flight jobs at
upgrade are requeued; old finished jobs render without steps.

## Transport

- `GET /api/jobs` — snapshot: jobs with nested steps, `etaSeconds`,
  `waitReason`. `GET /api/jobs/{id}` — one job, same shape.
- `GET /api/events` — SSE channel multiplexing `job` and `step` state
  events (full row per event, UI folds by id). The engine emits on
  transitions and throttles progress/note churn to ~250ms per step. Replaces
  the 500ms polling loop; the homework event channel and `publishHomework`
  are deleted. The homework workspace refetches a question's content when a
  step with `ref_type=homework_question` ticks.
- `POST /api/jobs/{id}/cancel` (existing), `POST /api/jobs/{id}/retry` (new),
  `POST /api/jobs/{id}/steps/{key}/retry` (new),
  `POST /api/jobs/clear-finished` (new).

## Command center UI

### Task center popover (header)

- Trigger pill: spinner + "N running", "· M waiting" secondary, a blocked
  indicator when present, plain "Tasks" when idle.
- Width grows to `w-[28rem]`; under 768px it renders as a full-screen sheet.
- Sections: **Running** / **Waiting** / **Blocked** / **Recent** (6).
- Running row: job header (label + target title + Cancel) then an indented
  step checklist —
  - phase row: status icon (◦ pending, spinner, ✓, ✗, ⊘ skipped, ⚠ when
    warnings exist), name, dim live note (truncated), inline bar + x/y when
    `total > 0`, attempts badge when `attempts > 1`;
  - item children collapsed to "8/12 · 1 failed" with expand chevron;
    expanded rows show per-item status and Retry on failed items;
  - job ETA line when countable.
- Waiting row: label + target + dim wait reason; Cancel.
- Blocked row: reason text, Retry + Cancel, and a deep link to fix when the
  reason is actionable (chat unconfigured → settings).
- Recent row: status icon, label, target, relative time; Retry on
  failed/cancelled.
- Clicking a target title navigates to its page (book detail / homework
  workspace); homework jobs always deep-link to the workspace.
- Footer "View all tasks →" opens `/tasks`.

### /tasks page

- Route `/tasks` in the sidebar (System group).
- Filter chips: All / Running / Waiting / Blocked / Done / Failed. All steps
  expanded in detail, warnings and errors inline, full timestamps.
- Actions: Retry / Cancel as above, per-item retry, **Clear finished**.
- Everything within retention (active + last 20 finished).

### Homework workspace

`GenerationProgress` stops simulating: it renders the real job's steps from
`/api/events` (extract phase → question items with live notes). The
simulation, fixtures, and `simulateGeneration` in `web/src/lib/homework.ts`
are deleted. Per-question Retry hits the generic step-retry endpoint.

Toasts keep today's settled-transition behavior; blocked jobs also toast.

## Testing (one-layer rule)

- **store**: `job_steps` CRUD and unique-key upsert; retry/reset queries
  (failed+cancelled → pending, attempts reset); retention cascade; resume
  query (first non-terminal step per job).
- **engine**: scheduler (type caps, book lock, FIFO skip-over, wait reasons);
  retry loop with a fake clock (attempts, backoff shape, classification, all
  three exhaustion actions); checkpoint/resume (cancel mid-step, shutdown
  mid-step, completed steps preserved); blocked round-trip; skeleton rebuild
  idempotency; ingest OCR self-skip; homework per-question isolation parity
  with existing tests.
- **api**: wire contract only — snapshot shape (nested steps, `waitReason`,
  `etaSeconds`), SSE envelope, the three new routes' status codes.

## Explicitly deferred

- Append-only event log / job transcripts (notes are last-write-wins).
- Job priorities, recurring/scheduled jobs.
- User-facing UI for concurrency caps and retry overrides (API accepts
  overrides now; knobs later).
- DAG dependencies between steps (ordered lists only).
- Page-granularity step rows (pages stay counters).
- Multi-process runners (locks are in-process).
- Token-level streaming through job events (Ask keeps its own channel).
