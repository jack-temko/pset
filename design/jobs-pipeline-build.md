# Jobs pipeline v2 — build plan: shared contract + two halves

Decided 2026-09-15. Rationale and decision history live in
`jobs-pipeline-spec.md`; this doc is what gets built. The **shared contract**
below is the single source of truth for the seam between backend and
frontend. Each half can be built and verified against the contract alone;
the two halves land together in one cutover.

Subagent briefs: **Backend = Part A only + contract. Frontend = Part B only +
contract.** Do not read the other half as a dependency.

## Repo conventions (both halves)

- Minimal comments in code — state only what code can't show. Layer purpose,
  dependencies, and contracts go in the layer folder's README.
- One-layer testing: store owns data tests, engine owns pipeline tests, api
  owns the wire contract only. Target ~0.6 test-to-source ratio.
- UI copy: plain, warm, no em-dash separators, no AI-tell phrases. All
  display strings for steps/wait reasons are server-authored (see contract);
  frontend renders them verbatim.
- Kill any server/process you start when done (by PID or port).

---

# Part 0 — Shared contract

## Routes

| Method + path | Request | Response | Errors |
|---|---|---|---|
| `GET /api/jobs` | — | `{"jobs":[Job]}` | — |
| `GET /api/jobs/{id}` | — | `{"job":Job}` | 404 |
| `POST /api/jobs/{id}/cancel` | — | `{"job":Job}` | 404; 409 if terminal |
| `POST /api/jobs/{id}/retry` | — | `{"job":Job}` | 404; 409 if queued/running |
| `POST /api/jobs/{id}/steps/{key}/retry` | — | `{"job":Job}` | 404 job or key; 409 if queued/running |
| `POST /api/jobs/clear-finished` | — | `{"cleared":N}` | — |
| `GET /api/events` | — | SSE stream (below) | — |

Job-creating endpoints (`POST /api/books/{sha}/ocr|index|embed`,
`POST /api/import`, `POST /api/homework`) accept an optional JSON body
`{"maxAttempts":{"<stepKey>":N}}` overriding that step's persisted policy.
Empty/absent body behaves exactly as today (homework create already takes a
body; merge the field).

Errors use the existing envelope: `{"error":"message"}` with 404 / 409.

**Deleted routes**: `GET /api/homework/{id}/events`,
`POST /api/homework/{id}/questions/{qid}/retry`. The generic step-retry with
key `question:<qid>` replaces the latter.

## Job (wire)

```json
{
  "id": "j_01H…",
  "type": "ingest | ocr | index | embed | homework",
  "status": "queued | running | completed | failed | cancelled | blocked",
  "bookId": "b_… | null",
  "homeworkId": "hw_… | null",
  "bookTitle": "… | null",
  "steps": [Step],
  "etaSeconds": 412.5,
  "waitReason": "2nd in queue",
  "warnings": ["…"],
  "error": "… | null",
  "createdAt": "RFC3339",
  "startedAt": "RFC3339 | null",
  "finishedAt": "RFC3339 | null"
}
```

- **Breaking**: `stage`, `pagesDone`, `pagesTotal` are gone. The active step
  in `steps` carries progress; clients derive summaries.
- `steps` is a flat array in **pre-order**: phases by `seq`, each immediately
  followed by its item children by `seq`. Clients nest via `parentId`.
- `etaSeconds`: present only while `running` and remaining work is countable;
  else `null`.
- `waitReason`: present only while `queued`; else `null`. Server-authored,
  display-ready, one of:
  - `"next up"`
  - `"2nd in queue"`, `"3rd in queue"`, … (position 1 renders as "next up")
  - `"waiting for a free OCR slot"` (any type label)
  - `"waiting on Import for this book"` (type label of the holding job)
- `warnings`: capped at 20, as today.
- Terminal statuses: `completed`, `failed`, `cancelled`. `blocked` is **not**
  terminal — retry and cancel both allowed.

## Step (wire)

```json
{
  "id": "s_01H…",
  "jobId": "j_…",
  "parentId": "s_… | null",
  "key": "ocr | question:q_… | batch:3",
  "name": "OCR | Question 3 | Batch 3",
  "status": "pending | running | completed | failed | skipped | cancelled",
  "done": 412,
  "total": 640,
  "note": "recognizing page 413…",
  "attempts": 2,
  "maxAttempts": 3,
  "error": "… | null",
  "refType": "homework_question | book | null",
  "refId": "q_… | null",
  "createdAt": "RFC3339",
  "startedAt": "RFC3339 | null",
  "finishedAt": "RFC3339 | null"
}
```

- `key` is unique within `(jobId, parentId)` and stable across resumes; URLs
  address steps by `key`, not `id`.
- `total: 0` means uncounted (render no bar). `note` is last-write-wins live
  text, `""` when none. `skipped` means exhausted-with-skip or not-needed;
  its `note` says why ("PDF has a text layer").
- Step `name` and notes are server-authored display strings.

## SSE stream — `GET /api/events`

`text/event-stream`, default event name (no `event:` lines — same parsing
pattern as the ask stream), `data:` payloads are JSON discriminated by
`type`:

```
data: {"type":"snapshot","jobs":[Job,…]}        ← once per connection, and again on every (re)connect
data: {"type":"job","job":Job}                  ← any job-row change (status, warnings, error, eta)
data: {"type":"step","step":Step}               ← any step-row change
data: {"type":"job_removed","id":"j_…"}         ← retention sweep or clear-finished
: ping                                          ← keep-alive every 15s
```

- One connection carries all jobs. Events on a connection are ordered;
  clients reset their store whenever a `snapshot` arrives.
- Every `job` event embeds the full job **including `steps`**; `step` events
  are single rows. Folding is last-write-wins by id.
- Backend coalesces `step` progress/note churn to at most one emission per
  250ms per step (status transitions emit immediately, trailing flush on
  completion).

## Semantics both sides must agree on

- **Retry** (job or step scoped): failed/cancelled steps → `pending`,
  attempts reset to 0; completed steps never re-run; skipped steps stay
  skipped unless they are the explicit target of a step retry (step retry
  resets its target and its children only). Allowed from `failed`,
  `cancelled`, `blocked`, and `completed` (recovers skipped work).
- **Cancel**: running step stops at its next checkpoint; incomplete steps →
  `cancelled`.
- **Blocked**: reason lives in job `error`; `waitReason` stays null.
- **Homework content**: when a step with `refType:"homework_question"`
  changes, clients refetch `GET /api/homework/{homeworkId}` for content.
  Content routes are unchanged by this project.
- **Ordering of `GET /api/jobs`**: active jobs first in FIFO order, then
  finished newest-first (retention: 20 finished).
- **Concurrency reality the UI should assume**: up to N jobs `running`
  simultaneously (different books), same-book jobs serialize, one job may
  hold another queued behind a book lock.

---

# Part A — Backend half

Build order: migration + store → engine (executor, then scheduler, then
handlers) → api + SSE → delete old paths. Write the api wire tests first from
Part 0; they are the acceptance bar.

## A1. Store (`internal/store`)

- New `job_steps` table (migration in `migrate.go`; additive — `jobs.status`
  is TEXT so `blocked` needs no column change):

```sql
CREATE TABLE job_steps (
  id          TEXT PRIMARY KEY,
  job_id      TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  parent_id   TEXT NULL REFERENCES job_steps(id),
  seq         INTEGER NOT NULL,
  key         TEXT NOT NULL,
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  done        INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL DEFAULT 0,
  note        TEXT NOT NULL DEFAULT '',
  attempts    INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  error       TEXT NOT NULL DEFAULT '',
  ref_type    TEXT NULL,
  ref_id      TEXT NULL,
  created_at  TEXT NOT NULL,
  started_at  TEXT NULL,
  finished_at TEXT NULL,
  UNIQUE (job_id, parent_id, key)
);
CREATE INDEX idx_job_steps_job ON job_steps(job_id);
```

- New `job_steps.go`: insert, upsert-skeleton (idempotent by
  `(job_id, parent_id, key)` — the skeleton rebuild path), list by job in
  pre-order, save (mutable fields), reset-for-retry (job-wide and
  step-scoped, per contract semantics), running→pending reset for stuck
  recovery.
- `jobs.go`: add `JobBlocked` const. Snapshot query joins steps (pre-order).
- Retention: after each settle, delete finished jobs beyond the newest 20
  (steps cascade).
- Stuck recovery at boot (`ResetStuckJobs` successor): requeue `running`
  jobs **and** reset their `running` steps to `pending`.

## A2. Engine (`internal/engine`)

**Executor** (new `steps.go`): the generic core.

```go
type StepSpec struct {
    Key, Name   string
    Total       int              // 0 = uncounted
    MaxAttempts int              // default 1; submit overrides persist here
    Backoff     time.Duration    // default 2s, exp + jitter
    Retryable   func(error) bool // default: errors wrapped Retryable only
    OnExhausted Exhaustion       // Fail | Skip | Block
    Run         func(ctx context.Context, h StepHandle) error
}
```

- `StepHandle`: `Progress(done,total)`, `Note(string)`, `Warnf(format,…)`
  (feeds job warnings), `Checkpoint() error` (cancel/shutdown honored),
  `AddChild(key, name string, ref Ref) StepHandle`.
- Retry loop per contract: persist attempts; stop-requests consume no
  attempt; exhaustion applies the declared action (fail job / mark skipped +
  warning / park job `blocked` with reason in `job.error`, step back to
  pending with reason as note). Backoff sleeps hold the worker slot and are
  checkpoint-aware.
- Handlers become registrations: `Skeleton(ctx, s, job) ([]StepSpec, error)`
  called at claim; skeleton upsert is idempotent. Job type dispatch in
  `pipeline.execute` disappears.

**Scheduler** (rework `runner.go`): worker pool (4), per-type caps
`{ocr:1, ingest:2, index:2, embed:3, homework:2}` (code constants), per-book
mutex on `book_id`. Selection: oldest queued job whose type slot + book lock
are free; a blocked-on-book job never head-of-line-blocks others. Same wake/
nudge mechanism as today. Shutdown: running jobs → `queued`, interrupted
step → `pending`, completed steps persist (same contract as today's pause-on-
shutdown). Wait reasons computed at snapshot time from scheduler state.

**ETA** (`eta.go`): one rolling window per running step (generalize
`etaWindow`); job `etaSeconds` = remaining countable units ÷ rates, null
when uncountable.

**Handlers** — rewrite the five as skeletons:

- `ingest`: `store → text → ocr → toc`. OCR phase always declared; it
  self-skips with note "PDF has a text layer" when not needed. text/ocr keep
  page counters + idempotent re-scan (no per-page rows).
- `ocr` / `index`: single phase; existing guards (text-layer refusals) stay
  at submit.
- `embed`: single phase with batch item steps (`batch:<n>`, ~32 pages each);
  the batch is the retry unit; dropForeignVectors logic unchanged.
- `homework`: `extract` phase (one step) then item steps `question:<qid>`
  (`refType homework_question`), each item running locate then guide with
  notes ("Locating question 3…" / "Writing the walkthrough…"). Item
  discovery is idempotent by qid (re-run extract after a crash must not
  duplicate questions). Per-question failure = skip + warning, run
  continues. Question execution status/error derive from the item step;
  `homework_questions` keeps content only. Homework status transitions
  (pending → generating → ready) and the PDF pipeline are untouched domain
  side-effects.

**Retryable classification**: `llm` wraps transport/429/5xx as Retryable;
`UserError`, `TextLayerError`, and bad-input errors are not.

**Event broker** (new `events.go`): engine publishes job/step row changes;
api subscribes. Per-connection: send `snapshot`, then stream. 250ms
coalescing per step for progress/note; transitions immediate; `job_removed`
on retention/clear. `EventStarted/EventStep/EventWarning` notify machinery
stays for the CLI.

**Deletions**: `publishHomework` / `HomeworkEvent` fan-out, homework SSE
endpoint, `RetryQuestion` (engine + api handler). Keep homework status
side-effects (`SetHomeworkStatus` ready).

## A3. API (`internal/api`)

- Routes per Part 0. `jobJSON` v2 (drop stage/pages; add steps, waitReason;
  `error` stays `*string`).
- New `events.go`: SSE handler with keep-alive; sets headers per existing
  ask-stream conventions.
- `clear-finished` deletes terminal jobs, emits `job_removed` per id.
- Wire tests (api layer owns these): snapshot shape and ordering, SSE first
  events on connect (`snapshot` then deltas), retry/cancel 409 rules,
  step-retry 404 for unknown key, `maxAttempts` override accepted at submit.

## A4. Acceptance (backend)

From a clean data dir, verified via curl against `/api/events`:

1. Import a scanned PDF: 4 phases appear, `ocr` progresses page by page
   (throttled), job completes; import a text PDF: `ocr` arrives `skipped`
   with the text-layer note.
2. Cancel mid-OCR → incomplete steps `cancelled`; retry → job `queued`,
   only pending steps re-run, done pages skipped (re-scan, not re-OCR).
3. Kill the process mid-embed, restart → job requeued, completed batches
   skipped.
4. Submit embed on two books at once → both `running`; submit index on the
   same book as a running OCR → queued with "waiting on … for this book".
5. Homework with one question whose guide call fails 3× (fake LLM) → item
   `skipped` + warning, job completes; step-retry `question:<qid>` re-runs
   it successfully; attempts reset.
6. Homework with chat unconfigured → job `blocked`, `error` carries the
   reason; configure + retry → completes.
7. A transient LLM 429 (fake) retries with backoff and attempts visible
   (2/3 badge data), no user action needed.
8. `clear-finished` empties history, `job_removed` events fire, `jobs`
   snapshot shrinks.

---

# Part B — Frontend half

Build order: types + event store (against the mock) → shared step
components → task center → `/tasks` page → integration surfaces (book
detail, import, library pill, action buttons) → homework workspace → delete
old paths.

## B1. Data layer (`web/src/lib`, `web/src/hooks`)

- `types.ts`: `Job`/`Step` per Part 0; delete `stage`/`pagesDone`/
  `pagesTotal` from `Job`.
- `api.ts`: new endpoints (`retry`, `retryStep`, `clearFinished`); drop
  homework events/retry calls.
- New `events.ts`: SSE client as a module-level store
  (`useSyncExternalStore`, same pattern as `use-jobs.ts` today). Pure
  reducer `applyJobEvent(store, event)` folds `snapshot` / `job` / `step` /
  `job_removed` (last-write-wins by id; reset on snapshot). Exposes
  `useJobs()`, `useJob(id)`, and settled-transition callbacks (toast +
  refetch hooks that today live in `use-jobs.ts`). Delete the polling loop
  in `use-jobs.ts`.
- **Mock mode** (the /ask2 pattern): a dev-only fixture + scripted timeline
  implementing the contract — running import (ocr 412/640 ticking), running
  homework (locate items 8/12, one failed), a waiting embed with a wait
  reason, a blocked homework, a few recent. One seam: `events.ts` picks
  mock vs `EventSource` on an env flag; everything downstream is identical.
  The whole UI is built and reviewed against the mock before the cutover.

## B2. Shared step components

- New `step-checklist.tsx`: renders a job's step tree — phase rows (status
  icon ◦/spinner/✓/✗/⊘/⚠, name, dim truncated note, inline bar + `x/y`
  when `total > 0`, attempts badge when `attempts > 1`), item children
  collapsed to a summary chip ("8/12 · 1 failed") with expand chevron;
  expanded item rows with per-item Retry on failed/skipped. Pure
  presentational; takes `steps: Step[]`.
- Rework `job-progress.tsx` on top of the checklist (single-job widget for
  banners and action-button swaps). `lib/jobs.ts` helpers re-derive from
  steps: active step line, short label for the library `StatusPill`,
  duration, worth-announcing. Warnings finally render (inline ⚠ popover in
  the checklist).

## B3. Task center popover (`components/task-center.tsx`)

Per spec: trigger pill (spinner + "N running", "· M waiting", blocked
indicator, "Tasks" when idle); `w-[28rem]`; sections **Running / Waiting /
Blocked / Recent (6)**; running rows = job header (label + target title +
Cancel) + `StepChecklist` + ETA line; waiting rows show `waitReason` dim +
Cancel; blocked rows show `error` reason + Retry + Cancel + a fix deep-link
(chat unconfigured → `/settings`); recent rows show relative time + Retry on
failed/cancelled. Target title navigates (book detail / homework workspace).
Footer "View all tasks →" → `/tasks`. Mobile (<768px): full-screen sheet.

## B4. `/tasks` page

New `pages/tasks.tsx` + route + sidebar entry (System group). Filter chips
All / Running / Waiting / Blocked / Done / Failed. Rows expand to the full
checklist (all items expanded, warnings and errors inline, timestamps,
per-item retry). Actions: Retry, Cancel, **Clear finished**. Active + last
20 finished, matching the snapshot.

## B5. Integration surfaces

- `book-detail.tsx` banner, `import.tsx` processing card,
  `ocr/index/embed-action.tsx` button swaps: consume `useJobs()` +
  `job-progress`; drop per-type polling assumptions. Two concurrent jobs on
  different books must both render.
- `library.tsx` `StatusPill`: derive "OCR 412/640"-style lines from the
  active step.
- Toasts: keep settled-transition toasts; add blocked → toast with reason.

## B6. Homework workspace

- `GenerationProgress` renders the real job's steps from the event store:
  extract phase → question items with live notes. Delete the simulation,
  fixtures, and `simulateGeneration` in `lib/homework.ts`.
- Per-question Retry → step retry (`question:<qid>`). On any
  `refType:"homework_question"` step change, refetch
  `GET /api/homework/{id}` for content.

## B7. Acceptance (frontend)

Verified against the mock fixtures (screenshots, desktop + mobile widths):

1. Popover shows all four sections from fixtures; step notes tick; bars
   advance; expand/collapse works; per-item retry button appears on the
   failed question.
2. Waiting and blocked rows render reasons verbatim; blocked row links to
   settings.
3. `/tasks` filters and Clear finished behave; expanded detail shows full
   item lists and timestamps.
4. Library pill, book detail banner, import card, and action buttons all
   derive from steps with two concurrent running jobs.
5. Homework workspace shows real extract → questions progress from fixture
   events (no `setTimeout` theater left).
6. Reducer tests (`applyJobEvent`): snapshot reset, out-of-order fold,
   `job_removed` cleanup; step-tree builder test (flat pre-order → nested).

---

# Cutover (both)

1. Backend lands with wire tests green; frontend lands green on the mock.
2. Remove the mock seam; point `events.ts` at `/api/events`.
3. Manual pass of backend acceptance A4 steps 1–8 through the real UI.
4. Delete dead code both sides (old polling, homework SSE client, fixtures).
