# Model usage

> **Superseded 2026-10-08** by [Job usage modal](job-usage-modal-grill.md): the line is now a button that opens a modal. The data model below (the `calls` table) stands, extended with stage, run and tokens detail.

## Status

**Done** · shipped 2026-09-29, the day it was decided. The spec lives in
`design/model-usage.md` now; the element is `web/src/components/usage/`.
Two things came out different from the plan below: the rows' delete
cleanup is explicit (`usage.Forget` at each subject's removal site, and a
hook for books) rather than SQL triggers — triggers can't be created in
the test envs that don't have every subject's table; and a read row that
carries the line wraps its description rather than truncating, so the
control at its end can't be clipped under an ellipsis.

## Information

### Why

Every call already reports its model, duration, tokens and dollar cost
(`llm.Usage` in internal/llm/llm.go), but the numbers go to a debug
log (`logs/llm.jsonl`) and die there. The point of the element is a
quick glance at what a thing spent, on the things that spent it: the
question walkthroughs, the assignment reads, the Ask turns.

### Decided (2026-09-29 grill)

- **Surfaces**: question walkthroughs, assignment read rows, Ask
  transcript turns. Book import is deferred (its shelf row is already
  busy and its cost is one-time per book), but its calls are still
  recorded, so surfacing them later is only UI.
- **Unit**: one finished job, aggregated. A walkthrough's line covers
  its whole production (find, figure read, guide), a read is one line,
  a turn is one line. Totals are lifetime for that subject: reruns and
  retries count, because the money was really spent.
- **Storage**: a `calls` table, one row per LLM call, not summaries.
  Any later view (per-book totals, monthly spend) is a query, not a
  migration.
- **Collapsed**: a quiet `text-xs` line, "model · time", that appears
  when the job has finished (ready or failed) and made at least one
  call. Nothing shows while it runs; the spinner and activity lines
  stay as they are.
- **Open**: one pattern everywhere, a light popover anchored under the
  line. Not the delete's ConfirmPopover reused as-is: that one asks a
  question, steals focus and vanishes; this one is read. Same anchor
  geometry (under the control, clamped to the window, portal to the
  body), but no buttons, no alertdialog, no focus move, and it follows
  its anchor on scroll and resize instead of detaching. Chosen over
  expanding in place so nothing ever reflows, on any of the three
  surfaces, and so there is exactly one interaction to learn.
- **Card**: one row per model that served the job, a Total row with
  the call count. Failed calls are included (they cost too), with a
  muted footnote when there are any.

### The element

**Component**: `web/src/components/usage/`, exporting `UsageLine`,
with its own README beside it, plus demos on `/components`
(`web/src/pages/components/index.tsx`) showing the line closed and
open, in both themes. Ship note: a short paragraph in
`design/design-system.md` beside the Deleting entry, saying a quiet
line may open a light popover that informs rather than asks.

**Collapsed line**. A button: the model's name, a dot, the time, and a
`ChevronDown` (`size-4`, rotating 180° when open, 150ms ease-out),
`text-xs text-muted-foreground`, hover `text-foreground` with
`underline-offset-2`. `aria-haspopup="dialog"`, `aria-expanded`. The
model named is the one with the most tokens in the job (usually the
writer): the headline is who did the work.

**Where it sits**, at the end of the thing produced:

- Walkthrough: the last line of the question's scroll body, after
  `MemoryLines` (`web/src/pages/workspace/index.tsx`, about line 1367).
  Shows for `ready`, `failed` and `unwritten` questions that have
  calls.
- Read row: joined to the `AssignmentReadRow` description after a dot
  ("3 due dates to look over · gpt-6-luna · 14s"), in the `ready` and
  `failed` branches (`web/src/pages/workspace/assignment-reads.tsx`);
  only the usage part is the button.
- Turn: after the answer's last block inside the `AssistantTurn`
  (`TurnView`, `web/src/pages/workspace/index.tsx` about line 613),
  for `done`, `stopped` and `failed` turns with calls.

**Popover**. A portal to the body, `w-80`, `rounded-md border bg-card
p-3 shadow-floating`, positioned exactly as `ConfirmPopover` positions
itself (`web/src/components/confirm/index.tsx` lines 57-66: under the
anchor, over it when there's no room, right-aligned, clamped), plus
scroll (capture) and resize listeners that re-run the placement while
open. Closes on Esc and on `pointerdown` outside; a press inside only
selects, so the numbers are copyable. No focus trap: focus stays on
the line, Esc returns nothing because nothing was taken. Opening
another line closes the first for free, via the outside press.

**Card contents**, in a `tabular-nums` table, right-aligned numbers,
mono for the numbers and the model slugs (machine strings):

```
perceptron-mk1.5     2.1s    9,412  $0.0004
gpt-6-luna           4.0s   21,034  $0.0009
deepseek-v4.1-flash  7.9s   18,554  $0.0018
Total · 6 calls     14.0s   49,000  $0.0031
```

- One row per `answered` model: summed call time, summed tokens
  (prompt + completion), summed cost. Total row the same, plus the
  call count in its first cell.
- If any calls errored: a `text-xs text-muted-foreground` footnote
  "Includes 1 failed call." (count as words).
- Missing values (a provider that reported no usage) show "–", never
  a blank.

**Formatting**.

- Time is the models' time: call durations summed. It adds across
  rows, and it matches the "Thought for 12s" the transcript already
  says. One decimal under 10s ("2.1s"), whole seconds at 10 and up
  ("14s"), "1m 03s" from a minute.
- Tokens exact with separators ("21,034"), never abbreviated: the
  card is where precision lives.
- Cost: four decimals under a dollar ("$0.0031"), two from a dollar
  ("$1.24"), "$0.0000" when a local model served for free.
- Model names: the slug with the `vendor/` prefix dropped
  ("deepseek-v4.1-flash"), full slug in the `title` attribute.

### The data

**Table** (a migration in internal/db beside the others):

```sql
CREATE TABLE calls (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,            -- RFC3339, when the call started
  subject_type TEXT NOT NULL,  -- 'question' | 'read' | 'turn' | 'book' | ''
  subject_id TEXT NOT NULL,    -- the question/read/turn/book id
  model TEXT NOT NULL,         -- requested
  answered TEXT,               -- the model that actually replied
  ms INTEGER NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost REAL,                   -- dollars, from OpenRouter
  host TEXT,
  session TEXT,
  error TEXT
);
CREATE INDEX calls_subject ON calls(subject_type, subject_id);
```

Rows are deleted with their subject (cascade from questions, reads and
turns); there is no time-based purge, the rows are tiny. Questions and
turns made before this ships have no rows, so no line: the element
appears on work run after it.

**Write path**. One choke point: where `logCall` writes the JSONL
record today (`internal/llm/calllog.go`), it also hands the record to
a sink callback wired in `cmd/pset/main.go` (the llm package never
imports the db; the db supplies the sink). The JSONL debug log keeps
writing. Every call is recorded, import calls included, so no
migration is owed later.

**Subject stamping**. `ChatRequest` grows a `Subject` (type and id),
set where sessions are set today: `internal/homework/question.go`
(question, all three kinds), `internal/homework/assignment.go` (read),
`internal/ask/loop.go` (turn), and the import paths with `book`.
Calls with no subject are kept with empty strings.

### The wire

No new endpoints. `Question` and `AssignmentRead`
(internal/homework/wire.go) and `Turn` (internal/ask/wire.go) each
grow an optional `usage` field, one shared struct in a small
`internal/usage` package both features import:

```
Usage {
  rows: [{ model, ms, tokens, cost, calls }]   -- one per answered model
  total: { ms, tokens, cost, calls }
  failed: int                                   -- errored calls, for the footnote
}
```

Filled by the same handlers that answer today, with one grouped SELECT
per subject (the query lives with the store, in internal/usage). The
existing fetches and SSE refetches carry it; `null` usage means no
calls, and the frontend draws nothing. Regenerate
`web/src/api/gen/*` with tygo as the Makefile does.

### Testing

- Store (internal/usage): rows written once per call with the right
  subject; aggregation groups by answered model and sums; failed calls
  counted; cascade deletes with the subject.
- Engine: the three session sites stamp the subject (a pipeline test
  per feature).
- API: the wire contract only, `usage` present and shaped on Question,
  AssignmentRead and Turn.
- Frontend: no automated tier. The `/components` demos, then the real
  app in both themes at 1280+, per AGENTS.md.

### Deferred

Moved to [loose-ends.md](loose-ends.md#from-the-finished-ideas).
