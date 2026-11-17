# Errors, full stack: grill

- status: awaiting OK
- date: 2026-11-17
- brief: one layer for every error, from where it is raised to where it is shown, stored and cleared, built on the change log and the step runner of `ideas/backend-courses-grill.md`; judged from an ordinary student doing this week's work
- sources:
  - `internal/errs`, `internal/errlog`, `internal/httpx`, and every `errs.Report` call on `dev`
  - `ideas/error-catalog-grill.md` (its D1 to D16 stand unless reversed below)
  - `origin/design:web/src/units/error-notice/spec.ts`, `web/src/api/client.ts`, `query.ts`, `screen-error.ts`
  - `ideas/backend-courses-grill.md`

## Summary

### In one line

Every failure is one incident: a live resource on the change log that says what kind
of failure it is, shows once at the closest place that owns it, and resolves by itself
when its cause is gone.

### Decisions

| #   | Decision                                                                                                                                                                                                   | Why                                        | Beat                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| E1  | One cause is said once: a single notice at the closest place that owns everything waiting on it ("Your account is out of credit. 12 problems are waiting."). The rows are not red; each says it is waiting | Twelve red boxes say one thing             | A notice on every row; a banner for the app    |
| E2  | Errors heal: when the cause is seen to be gone (a call succeeds, a key is saved), the waiting steps run again by themselves and the notice leaves                                                          | It is work already asked for               | One "carry on" button; each by hand            |
| E3  | Nothing more than the notice in its place: no count in the top bar and no passing message                                                                                                                  | Calm; the error grill's "no toasts" stands | A quiet count (recommended); a passing message |
| E4  | Settings lists what is open, then what resolved in the last week; older ones are purged, with the change log                                                                                               | Healed errors are noise after a while      | Kept until cleared; open only                  |

### The artifacts

**One table, `incidents`**, replacing the `errors` table and every `error` column on a
row (books, questions, turns, assignment reads):

| Column             | Holds                                                                |
| ------------------ | -------------------------------------------------------------------- |
| id                 | the six-character incident id                                        |
| chain, values      | the catalog ids, outermost first, and what each was raised with      |
| subject, parents   | what it is about (kind and id), and its set and course               |
| step, action       | the step that failed; the student's action that led to it            |
| born               | a request, a step, or the page                                       |
| state              | open, or resolved and how (healed, tried again, its subject removed) |
| count, first, last | the same cause on the same subject bumps the count, not a new row    |
| detail             | the Go error text; never a key, a prompt or an answer                |

An incident is a resource on the change log, so it reaches every tab as it opens and
leaves the screen as it resolves.

**Every catalog entry names its kind**, and the look follows the kind:

| Kind           | Example                       | Shown as                                                         | Clears when               |
| -------------- | ----------------------------- | ---------------------------------------------------------------- | ------------------------- |
| Passing        | the model is busy             | Not red. The step says "trying again in 8 s"                     | The retry works           |
| Waiting on you | no key, out of credit         | Not red on each row. One notice at the cause; rows say "waiting" | What it names is back     |
| Your input     | a name already taken          | One line under the field                                         | The field changes         |
| Can't          | problem not found in the book | Red, with the choice to make (try a page, box it)                | The student chooses       |
| Ours           | an unexpected failure         | Red, with Details and Copy                                       | Tried again, or dismissed |

**How an error travels**

1. Raised in Go as today (`entry.New`, `entry.Wrap`), or on the page from the same
   generated catalog (a crash, a dead event stream, a rejected promise).
2. Reported once, by the step runner, the request handler, or the page's one error
   module. A failure becomes an incident; your input and a refused request are
   answered and not kept, as today.
3. Announced by the change log, like any change.
4. Placed by one rule: shown once, at the closest thing on screen that owns its
   subject (the question, else its set, else the pane, else the screen).
5. Acted on by the layer: Try again reruns the step or replays the request it kept.
   No caller wires a retry.
6. Resolved: by healing, by a retry that works, or with its subject.

**From an incident to its trace.** Settings opens an incident onto its step, that
step's model calls and the changes around it.

### Assumed

- A1: a passing failure follows the step runner's retry rule (three tries, a growing wait) and turns into its real kind only when the tries run out.
- A2: what can clear a "waiting on you" error: a key, credit, the provider answering, embeddings (if they stay), disk space. Healing runs the waiting steps once per clearing; a step that fails again for the same cause reopens its incident, so nothing loops.
- A3: Copy stays the only way to report, as today. No "report to GitHub".
- A4: a model call's own error stays on its call row, reached from the incident through the step.
- A5: a switch for development forces any catalog error at any step, so every state can be looked at on a real screen. It is not in a release.
- A6: adding an error stays five lines; an entry gains two fields, its kind and what clears it.

### Open

- The words and look of "waiting" on a row, and of the one notice with its count: the error notice's own design pass on `design`.

## Reversals

- `ideas/error-catalog-grill.md` D12 ("the errors table keeps everything until cleared"): reversed by E4, asked 2026-11-17. Clear all goes; a week replaces it.
- Its D11 (background failures keep a catalog error on their own row): replaced by the one `incidents` table. Not asked as a question: it follows from steps owning failure (`backend-courses-grill.md` D3, D4).
- Its D13 (inline placement, a banner only for screen-wide errors, no toasts) stands, and E1 and E3 follow it.

## Disagreements

- E3: recommended a quiet count in the top bar, since a failure in a set you are not looking at can go unseen until it is due. Jack chose nothing more.

## Frontier

Empty.

## Log

### Gate 0

Audit shown 2026-11-17: the catalog, the wire shape, the chain and the notice unit are kept; errors are stored in four places, arrive three ways, leave the page's own failures out, make every caller wire its retry, say one cause many times and never heal. No facts corrected.

### Batch 1

- One cause. Options: Said once (Recommended) / On every row / Once, for the whole app. Answer: "Said once (Recommended)".
- Healing. Options: They carry on (Recommended) / One button / Each by hand. Answer: "They carry on (Recommended)".
- Attention. Options: A quiet count (Recommended) / Nothing more / A passing message. Answer: "Nothing more".
- Kept for. Options: Open, plus a week (Recommended) / Until cleared / Open only. Answer: "Open, plus a week (Recommended)".
