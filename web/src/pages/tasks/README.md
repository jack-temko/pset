# Tasks

This doc is the spec: the page renders exactly what's described here.

Tasks is where you come to **fix** things. Watching them happen is the
sidebar card's job (`components/task-card.tsx`), which is always on screen;
this page is the one you open when something needs a decision.

## What a task is

Two kinds, and only two: **preparing a book** and **writing an
assignment's walkthroughs**. Everything else a student does — rewriting one
walkthrough, moving a crop, correcting a question's wording — is a direct
request that renders on the thing it affects, never a queued task. With a
serial runner, a five-second repair queued behind a forty-minute book would
wait an hour.

## Data

`useTasks()` — the shared SSE store (`lib/events.ts`). No page-local
fetching: a snapshot on connect, then `task` and `phase` deltas keep every
section live. History prunes itself as tasks settle (newest 25 kept), so
there is no `Clear finished` button and nothing to sweep by hand.

## Sections

Fixed, in this order, each hidden when empty:

| Section | Holds |
|---|---|
| **Needs you** | Failed tasks. The only thing that earns the card's attention state. |
| **Running** | The one task executing. The runner is serial. |
| **Waiting** | Queued tasks, in FIFO order. |
| **Paused** | Tasks you stopped. Not an alarm — you did that on purpose. |
| **Done** | Finished tasks, newest first. |

## The row

One component, `components/task-row.tsx`, used here and nowhere else.

- **Status icon** — spinner (running) · dashed circle (queued) · pause
  (paused) · alert triangle (transient or environment failure) · slashed
  circle (permanent failure) · check (done).
- **State + title** — `PREPARING · Calculus, 8th ed.`, the title linking to
  the book or the assignment.
- **Reason** — why it is resting, in the student's terms. A paused task says
  where it got to; a failed one carries the engine's sentence verbatim.
- **The plan, inline and always visible.** Four phases at most, so hiding
  them behind a chevron would trade a click for nothing. Each phase shows a
  tick, a cross, a spinner or a dashed circle, plus a bar and a count while
  it runs, and its remaining time.
- **Actions** — `Stop` while queued or running; `Resume` (paused) or
  `Try again` (failed) when `task.retryable`; `Remove book` on any
  unfinished book task.

## Two failure shapes

The engine classifies; this page renders what it is told and never parses
error text.

- **`permanent`** — an encrypted or corrupt PDF. `retryable` is false, so
  **no Try again is offered**: it would fail identically, and offering it
  would be a lie. The row leads with the explanation and `Remove book`.
- **`transient` / `environment`** — a rate limit, a crash, a missing
  tesseract. `Try again` is the primary action, and it resumes rather than
  restarting.

## What stopping and failing do

Neither throws work away. A stopped task rests at `paused` with every
finished phase intact; a failed one keeps its pages too. **`Remove book` is
the only action in the app that deletes anything**, and it is confirmed.

## Deferred

Sort controls (server order is deliberate), a task-detail route, and any
per-phase retry — the phase that failed is the one a retry re-runs, so a
second door would only let you re-run work that already succeeded.

## Endpoints

`GET /api/events` (SSE) feeds everything. `POST /api/tasks/{id}/stop`,
`POST /api/tasks/{id}/retry` and `DELETE /api/books/{sha}` are the only
mutations.
