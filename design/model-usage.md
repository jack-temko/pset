# Model usage

What each finished job cost: model, time, tokens and dollars on one
quiet line, a light popover behind it. Decided 2026-09-29 by grill;
shipped the same day.

## Surfaces

- **Question walkthrough**: the last line of the question's scroll body,
  after the memory lines. Shows for `ready`, `failed` and `unwritten`
  questions that have calls; a question still being written keeps its
  working lines and shows nothing.
- **Assignment read row**: joined to the row's description after a dot
  ("2 due dates to look over · gpt-6-luna · 14s"), in the `ready` and
  `failed` branches. Only the usage part is the button, and the row's
  description wraps rather than truncates when it carries one — a
  truncated tail would clip the control it ends in.
- **Ask turn**: after the answer's last block inside the turn, for
  `done`, `stopped` and `failed` turns with calls. A turn that ended
  before it wrote anything (the first call refused, a stop at once) has no
  answer to end with the line, so the line follows its note instead.

Book import is deferred (the shelf row is busy and the cost is one-time
per book); its calls are recorded, so surfacing them later is only UI.

## The element

`web/src/components/usage/`, exporting `UsageLine`, with its README and
demos on `/components` (closed and open, both themes).

**Collapsed**: a button — the model's name, a dot, the time, and a
`ChevronDown` (`size-4`, rotating 180° when open, 150ms ease-out),
`text-xs text-muted-foreground`, hovering to `text-foreground`
underlined. `aria-haspopup="dialog"`, `aria-expanded`. The model named is
the one with the most tokens in the job: the headline is who did the
work. The line is `data-copy-skip`, so an answer's copy button doesn't
paste the machinery.

**Open**: a portal to the body, at least `w-80` and as wide as its
numbers need (a 19-character model name and a seven-digit token count don't
fit 20rem; it never passes the window's edge), `rounded-md border bg-card
p-3 shadow-floating`, positioned as the ConfirmPopover positions itself
(under the anchor, over it when there's no room, right-aligned, clamped)
plus scroll (capture) and resize listeners that re-place it while open —
the transcript streams under it, and a popover that detached would point
at nothing. Closes on Esc (capture, stopped there) and on `pointerdown`
outside; a press inside only selects, so the numbers are copyable. No
focus trap; the line that opened it is its toggle. Chosen over expanding
in place so nothing ever reflows, and so there is one interaction to
learn. `design/design-system.md`, "Informing, not asking", carries the
rule.

**Card**: one row per model that *answered* — summed call time, summed
tokens (prompt + completion), summed cost — and a Total row with the call
count. A fallback's answers are its own row, not the model asked for's.
Mono and `tabular-nums` for the machine strings, right-aligned numbers.

**Time is the calls' durations added up**, not how long the job took:
calls made at once (the three figure readings) each count in full. The
line's time says so in its `title`, and the card ends with a muted note.

**Uncounted calls.** A call that failed or was stopped part-way has no
tokens or cost here — the provider still bills what it wrote and never
says how much — and so has a call to a provider that reports nothing. A
row (and the Total) with any of those marks its tokens and cost `≥`, since
they add up only the calls that reported; a row with none counted shows
"–", never a blank or a zero, which would say the call was free rather
than uncounted. The note says how many calls reported no usage, and how
many of those failed.

**Formatting** (`web/src/lib/usage-format.ts`, tested): time is rounded
once, to the second, then split — one decimal under 10s ("2.1s"), whole
seconds from 10 ("14s"), "1m 03s" from a minute, "1h 02m" from an hour, so
59.6s is "1m 00s" and 9.97s is "10s"; tokens exact with separators; cost
four decimals under a dollar ("$0.0031"), two from one ("$1.24", and
0.99996 is "$1.00"), "$0.0000" for exactly nothing (a local model serving
for free) and "<$0.0001" for a paid call too small for four decimals,
which must not read as free; model names without the `vendor/` prefix,
the full slug in the `title`.

## The data

A `calls` table (migration `usage/1`), one row per LLM call, not
summaries — any later view (per book, per month) is a query, not a
migration:

```sql
CREATE TABLE calls (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,            -- RFC3339, when the call started
  subject_type TEXT NOT NULL,  -- 'question' | 'read' | 'turn' | 'book' | ''
  subject_id TEXT NOT NULL,
  model TEXT NOT NULL,         -- requested
  answered TEXT,               -- the model that actually replied
  ms INTEGER NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost REAL,                   -- dollars, from OpenRouter
  host TEXT, session TEXT, error TEXT
);
CREATE INDEX calls_subject ON calls(subject_type, subject_id);

-- migration usage/2
CREATE TABLE forgotten (subject_type TEXT, subject_id TEXT, at TEXT,
  PRIMARY KEY (subject_type, subject_id));
```

**Write path**: one choke point — `logCall` (internal/llm/calllog.go)
hands each finished call to a sink wired in `cmd/pset/main.go`
(`llm.OnCall(usage.Sink(d))`; the llm package never imports the db). The
JSONL debug log keeps writing. Every call is recorded, import calls
included.

**Subject stamping**: `ChatRequest` grows a `Subject` (type and id),
filled from the context (`llm.WithSubject`) where sessions are set:
`internal/homework/question.go` (question, all three steps),
`internal/homework/assignment.go` (read), `internal/ask/loop.go` (turn),
`internal/library/import.go` (book). Calls with no subject are kept with
empty strings.

**Cleanup**: rows go with their subject, in the same transaction where
one runs — removing a question, deleting a set, dismissing a read,
clearing a conversation. Removing a book takes its imports', questions',
reads' and turns' rows through a hook library hands to homework and ask
(`Config.ForgetCalls`), before the cascade can orphan them.

**A call still in flight** when its subject is removed (the job is stopped
and the request unwinds afterwards) must not record a row for something
that no longer exists. `Forget` first writes a mark to `forgotten`, in the
same write that deletes the rows, and the sink's insert is one statement
that records nothing for a marked subject, so a removal can't slip between
the check and the write; a removal that rolls back takes its mark with it.
`usage.Sweep`, at startup, clears marks older than a day (a request can run
20 minutes) and calls spent on no subject older than 30 days (the Settings
key test, a reference the model read), which no removal would ever delete.

**The wire**: no new endpoints. `Question`, `AssignmentRead` and `Turn`
carry an optional `usage` — one shared struct in `internal/usage` (`rows`
per answered model, `total`, `failed`), filled by the handlers that
answer today with one grouped SELECT per subject (`usage.For` /
`ForSubjects`, the query lives with the store). `null` usage means no
calls, and the frontend draws nothing. Regenerate `web/src/api/gen/*`
with tygo as the Makefile does.

## Testing

- **Store** (internal/usage): rows written once per call with the right
  subject; aggregation groups by answered model (a fallback is its own
  row; two models asked for and one answering are one row) and sums; failed
  calls counted, and uncounted ones tallied; a subject whose calls all
  failed still reads; Forget and ForgetAll delete the subject's rows and
  mark them, a call ending afterwards records nothing, a rolled-back
  removal doesn't; Sweep clears old marks and old unattributed calls.
- **Engine**: the stamping sites (question, read, turn) each have a
  pipeline test — a sink over the db asserts every call carries the
  subject, and the wire form carries the summed card; removing a
  question removes its rows.
- **API**: the wire contract only, exercised through the same tests —
  `usage` present and shaped on Question, AssignmentRead and Turn.
- **Frontend**: the formatting is unit-tested (`usage-format.test.ts`);
  the component has no automated tier. `/components` demos (the line, open,
  a minimum, the widest), then the real app in both themes at 1280+, per
  AGENTS.md.

## Deferred

- **Book import surface**: rows are recorded; only the shelf row's UI is
  owed.
- **Live totals while a job runs**: the line is for after; the working
  lines already say how it's going.
- **Per-call detail, cached/reasoning token split, host**: in the calls
  table and the JSONL, not on the card.
- **Cross-job totals** (per book, per month, all-time): the calls table
  makes each a query; no UI decided.
