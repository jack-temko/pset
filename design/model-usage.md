# Model usage

What each finished job cost: one quiet line with a chevron where the job's
result is, and a modal behind it with the details. Decided 2026-09-29;
reworked 2026-10-08 by grill (`ideas/job-usage-modal-grill.md`), when the
line became a button again and the modal arrived. The popover of the first
version, and the plain text of the second, are gone.

## Surfaces

A trigger shows once a job is done or failed (never while it runs) and only
when at least one call was made:

- **Question walkthrough**: the last line of the question, ready, failed or
  unwritten. The modal splits it by stage: Find (or Boxed read), Figures,
  Guide, and the set's difficulty ranking (Rank) as a share.
- **Ask answer**: after the answer, or after the note on a turn that ended
  before it wrote anything. Stages are its tool rounds ("Round 1" ... with
  the tools each called) and Repairs.
- **Assignment read**: joined to the row's description after a dot. One
  stage, Read.
- **Book**: "Usage" in the book menu opens a dialog, not a trigger: the
  book's total, a row for each kind (questions, difficulty ranking, Ask
  answers, assignment reads, import), then the import's stages (Naming,
  Contents) and calls.

## The trigger

`web/src/components/usage/`, `UsageTrigger`: today's line (the model that
did the most work and `+N` for the rest, the time, the tokens, the cost)
as a button, with a small `ChevronRight`. `text-xs`, muted; the line and
the chevron turn to the accent together on hover and focus-visible. It is
`data-copy-skip` and keyboard focusable. Formatting is `usage-format.ts`
(unchanged): time to the second, tokens exact, cost to four decimals, `≥`
when a call reported nothing, a dash for nothing counted.

## The modal

`web/src/components/usage-modal/`, `UsageModal` on the Dialog at its
`table` width (960). The detail is fetched when it opens, and again each
time (a retry adds calls). From the top:

1. **Totals**: time, tokens in and out, cost, calls, failed; cached and
   reasoning tokens when the provider counted any.
2. **Stages**: a Table of stage, attempts (the runs that made calls in it),
   calls, time, tokens in and out, cost. The ranking's row is marked
   "Shared with N questions": each question takes an even 1/n of the
   ranking's figures, and the shares add up to the whole.
3. **Calls**, grouped by run (Run 1 is the first find, Run 2 a retry or a
   rewrite after notes; the ranking is its own group): time of day, stage
   (with the tools a round called, or the error), model (the one that
   answered, with "asked X" under it when a fallback served), ms, tokens in
   and out, reasoning, cost. A failed call is a soft red row with its error
   and no counts. A missing cost never reads as a zero.

A question's total is everything it ever cost, every run. The ranking is
split over every question in the set, including one with no calls of its
own (still being found, say), which shows no line to carry its share: the
set's question lines can add up to a little less than the ranking cost.
The book dialog counts the ranking once and is exact. The Table is
`web/src/components/table/`.

## The data

`calls` (migrations `usage/1` to `usage/3`), one row per LLM call, never
summaries. `usage/3` adds, to existing databases and without altering any
column, `stage`, `run`, `tools`, `reasoning_tokens` and `cached_tokens`;
older rows keep NULLs and read as stage "Other".

**Write path**: `logCall` (`internal/llm/calllog.go`) hands each finished
call to the sink wired in `cmd/pset/main.go`. A job names what its calls are
for with `llm.WithSubject` (`question`, `read`, `turn`, `book`, and `set`
for a difficulty ranking), `llm.WithStage` and `llm.WithRun`. A question's
steps pick their stage by job kind and chain their run through the job
payload (`questionPayload.Run`): a find queues its figure read and guide in
its own run, while a retry or a rewrite after notes starts a new one. The
agent loop names an Ask turn's rounds through `Loop.Stage`.

**Cleanup**: rows go with their subject (`usage.Forget`), as before; a
removed set forgets its ranking, and a removed book forgets its questions',
sets', reads' and turns' rows through the hook library hands homework and
ask. A call in flight when its subject goes records nothing (`forgotten`).
`Sweep` clears marks and unattributed calls at startup.

**The wire**: lists keep `usage` (`rows`, `total`, `failed`), so the line
needs no extra fetch; a question's line includes its share of the ranking.
The modal reads `GET /api/questions/{id}/usage`,
`GET /api/assignment-reads/{id}/usage`, `GET /api/turns/{id}/usage` (each a
`Detail` or null) and `GET /api/books/{id}/usage` (`BookUsage` or null).

## Testing

- **Store** (`internal/usage`): rows written once per call; aggregation as
  before; the migration on a database that already has calls; calls grouped
  by stage and run, attempts and failed counts; the ranking split evenly,
  adding to the whole, and counted once in the book; book totals by kind.
- **Engine**: each job's pipeline test asserts the stage and run on its
  calls (a question's find, figures and guide share a run; a retry is a
  second; an Ask turn's rounds; a read; a book's Naming and Contents), and
  the new endpoints.
- **Frontend**: `usage-format.test.ts`; the trigger, the modal, the book
  dialog and the Table have vitest tests. `/components` shows the trigger,
  the modal, the book dialog and the Table in both themes.

## Deferred

- **Prompts and replies in the modal**: they stay in
  `<data>/logs/llm.jsonl`.
- **Live totals while a job runs**: the line is for after.
- **A Settings usage page** and per-month totals: the calls table makes
  each a query.
- **The Writer fallback** that no call passes: a separate idea.
