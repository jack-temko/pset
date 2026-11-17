# Backend for courses, materials and work: grill

- status: approved ("Approve as written", 2026-11-17)
- date: 2026-11-16
- brief: the backend the new screens need, as one decision: a step runner, a fresh schema for courses, materials and work, and one live-update contract; judged from an ordinary student doing this week's work, and from whoever maintains the code
- sources:
  - `design/backend.md`, `cmd/pset/main.go`, `internal/homework`, `internal/library`, `internal/ask`, `internal/jobs`, `internal/events`, `internal/llm`, `internal/usage` on `dev`
  - `origin/design:ideas/screens-grill.md`, `workspace-grill.md`, `ask-pane-grill.md`
  - `origin/courses:ideas/courses-grill.md` (evidence only since the design restart)
  - the call history in a copy of the test library (301 calls, $0.72)

## Summary

### In one line

A new backend on a `backend` branch: one baseline schema for courses, materials and
work, every piece of background work as a step on one runner, and a change log written
by the database that drives live updates and undo.

### Decisions

| #   | Decision                                                                                                                                                                                                   | Why                                                            | Beat                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| D1  | The rewrite lands on an integration branch, `backend`, off `dev`. The old screens die there; `dev` keeps the working app until the new screens can read real data                                          | `dev` is never half built                                      | Beside the old on `dev`; an adapter for the old screens |
| D2  | A clean slate for now: one baseline schema, nothing converted, the old data folder set aside as a dated copy and never deleted. A port may come later                                                      | No release has shipped; Jack may want his old library back     | A converter now; materials only                         |
| D3  | Every kind of background work is a step on one runner: imports, finds, readings, guides, checks, ranking, assignment reads and Ask turns                                                                   | One model of state, retry, resume, failure and usage           | Pipelines only; keeping the queue                       |
| D4  | The screens are given the steps themselves (find done, figures running, guide waiting), each with its own error and retry, in place of one state and an activity line                                      | A failed reading under a finished find can be shown and tried  | One derived state; both                                 |
| D5  | Guides and Ask answers are one kind of document with one stream: a guide fills in block by block                                                                                                           | One code path for one format                                   | Hold until checked; guides saved whole                  |
| D6  | When an input changes after a guide is written (a note, a corrected reading), the guide is marked out of date with one Rewrite button. Nothing is spent unasked                                            | `check-before-cost`                                            | Rewrite at once; rewrite when opened                    |
| D7  | An uploaded assignment sheet is kept as a material, opened beside its set                                                                                                                                  | Figures and boxing on the sheet; earlier homework can be found | Kept hidden; used up                                    |
| D8  | Finds first, then readings, then guides, oldest first, as today                                                                                                                                            | Predictable                                                    | What you are looking at first; due date only            |
| D9  | Guides are written three ahead: finds and readings for the whole set at once, guides for the next three problems not done                                                                                  | Guides are most of the spend and many are never read           | All at once; only when asked                            |
| D10 | A guide asked for by opening its problem goes ahead of guides PSet is writing ahead on its own                                                                                                             | Never wait behind problems you are not looking at              | Strictly in order                                       |
| D11 | Live updates are a change log in the database, written by triggers: sequence, kind, id, parents, the fields before and after, who did it, and which action it belongs to. The event stream replays the log | No write can forget to announce; reconnects and tabs just work | Announcing from Go, held in memory                      |
| D12 | Undo on every student action and Ctrl+Z, newest first, by writing an action's before values back. No history screen                                                                                        | One mechanism instead of undo code per feature                 | Undo and a history screen; record only                  |
| D13 | Removing anything hides it. A removed material stays underneath while any set uses it, so page links, figures and boxing keep working, and is deleted for good once nothing uses it                        | Tidying never breaks finished work                             | Deleted with the work marked; the work going too        |
| D14 | Undo replaces most confirms: a removal just happens, with "Removed Problem set 4 and its 12 problems. Undo." A confirm with numbers stays only for what cannot come back (Reset)                           | A dialog on a safe action is noise                             | Confirm and undo; confirm when it takes others          |
| D15 | Removed things and old values are kept for a week, then purged unless something still uses them                                                                                                            | A mistake from yesterday can be undone; a history comes later  | This session (first choice); 30 days; until emptied     |

### The artifacts

**Tables** (one baseline migration; every student-removable row has `removed_at`)

| Table                | Holds                                                                                                   | Made by |
| -------------------- | ------------------------------------------------------------------------------------------------------- | ------- |
| `courses`            | name, dates                                                                                             | student |
| `materials`          | course, title, file hash, page facts, page runs, problem numbering, whether it is the course's textbook | both    |
| `pages`, `sections`  | a material's text, search index and contents                                                            | PSet    |
| `sets`               | course, title, due, turned in, the sheet it was read from                                               | student |
| `questions`          | set, position, the text as typed, professor's notes, done, revealed, attached images                    | student |
| `finds`              | question, where it was found (a material and page, or an earlier question), boxes, figures, statement   | PSet    |
| `readings`           | question, the figure facts, the points that differed, whether the student corrected it                  | both    |
| `documents`          | owner (a question's guide, a turn's answer), blocks, saved rounds                                       | PSet    |
| `turns`              | course, the question asked, what it was about, its document                                             | student |
| `memories`, `study`  | course, as today                                                                                        | student |
| `steps`              | subject, name, state, input hash, run, attempts, error, order                                           | PSet    |
| `calls`              | step (cascades), model, tokens, cost, time                                                              | PSet    |
| `changes`            | sequence, time, action, actor, kind, id, parents, operation, before, after                              | trigger |
| `settings`, `errors` | as today                                                                                                |         |

Values are logged in `changes` only for what the student made. For what PSet made the
row says it changed, not what it held: a step can make it again.

**Steps**

| Subject         | Steps, in order                                  | Notes                                                    |
| --------------- | ------------------------------------------------ | -------------------------------------------------------- |
| Material        | examine, read pages, contents, numbering, search | read pages resumes where it stopped                      |
| Assignment read | read                                             | then the sheet is a material                             |
| Question        | find, figures (if any), guide, check             | guide waits until asked for (D9, D10); check runs beside |
| Set             | rank                                             | once nothing is left to find                             |
| Turn            | answer                                           | one at a time per course                                 |

A step's states: waiting, running, done, failed, out of date, not asked for. A step
whose input hash still matches is never run again.

**Live updates.** `GET /api/events` sends `change {seq, kind, id, course, set?, op,
after?}` from the log, from the sequence the page last saw. The page has one handler:
patch or read again by kind and id, and keep whichever copy has the higher sequence.
Words as they are written (a document's blocks, a step's "reading page 142") ride the
same connection and are not logged.

### Assumed

- A1 (delegated, "pick the best way"): a find widens in rungs. First where the reference itself points (an earlier set's problem, a named handout); else the course's textbook; else the course's other materials, ranked by text search with no model call until a page is a candidate; else it fails and says where it looked.
- A2: a course's textbook is the first material PSet detects as numbering its problems; the student can change it. No kind is shown (S11).
- A3: a step's output lives in its own typed table (`finds`, `readings`, `documents`); the step row holds state only.
- A4: one retry rule for every step: a failure the model or network may recover from is tried again up to three times with a growing wait, then it fails with its catalog error.
- A5: concurrency is a limit per model, not a lane of two; the check's own solve starts when the guide does.
- A6: a part of a guide that the check corrects after the student could have read it is marked as corrected.
- A7: removing a course or a set follows D13 to D15: hidden, undoable, purged after a week.
- A8: the web data layer is rewritten around the one handler (Jack: "change the frontend if needed").
- A9: build order on `backend`: schema and change log; the runner and material import; the work pipeline; Ask; undo; then the web data layer.

### Open

- Whether embeddings (Ollama) stay: an eval of text search alone, its own decision.
- Poppler and Tesseract as programs beside the binary: needs a spike.
- The limits per model, in numbers.
- The port of the old library, if Jack wants it: its own small grill.
- The route list and wire types: written into `design/backend.md` as each part is built.

## Reversals

All of `design/backend.md`'s layering stays. These parts of it are replaced, each asked
as a question in this grill:

- "Cross-feature deletes are foreign keys with ON DELETE CASCADE": now hide, then purge (D13).
- "The queue publishes nothing to the UI; features publish their own domain events", the ring buffer and `reset`: now the change log (D11).
- Jobs, lanes and each feature's state column: now steps (D3, D4).
- Every question gets a guide as soon as it is found: now three ahead (D9).
- Within this grill, Jack first chose "work goes too, always warn with numbers and confirm" for a removed material, then reversed it twice over: the material is hidden and stays usable (D13), and undo replaces the confirm (D14).

## Disagreements

- D8: recommended that the open question's steps go first. Jack chose finds first, in order; D10 covers the one case that left open.
- D15: recommended 30 days. Jack chose this session, then, asked once more, a week: "since eventually I'll add a history".

## Frontier

Empty.

## Log

### Gate 0

Audit shown 2026-11-16 (the write-up in the session, plus: courses D25 chose a clean slate; screens A7 keeps the old screens running; K1, S10, S11 and "a material belongs to one course" taken as settled; reads take 1 to 40 ms). No facts corrected.

### Batch 1

- Landing. Options: Integration branch (Recommended) / Beside the old, on dev / Old screens on the new backend. Answer: "Integration branch (Recommended)".
- Old data. Options: What you made (Recommended) / Clean slate / Materials only. Answer: "For now clean slate, I may want to port over my old stuff later".
- Runner scope. Options: All of it (Recommended) / Pipelines only / Keep the queue. Answer: "All of it (Recommended)".
- Find scope. Options: The set's material (Recommended) / Every material / One textbook a course. Answer: "lets make this smart. My probability class often has problems that build off previous homeworks. So usually by default we should just look in the textbook, but if not found there it can widen the search. pick the best way to do this".

### Batch 2

- Live events. Options: Only what changed (Recommended) / The whole resource / A patch. Answer: "only what changed. make this smart. like really smart. change the frontend if needed. I want this whole event thing cool".
- Steps in UI. Options: The steps themselves (Recommended) / One state, derived / Both. Answer: "The steps themselves (Recommended)".
- Guide stream. Options: Same stream (Recommended) / Stream, show when checked / Keep as today. Answer: "Same stream (Recommended)".
- Stale work. Options: Mark it out of date (Recommended) / Rewrite at once / Rewrite when opened. Answer: "Mark it out of date (Recommended)".

### Batch 3

- The sheet. Options: Kept as a material (Recommended) / Kept, but hidden / Used up. Answer: "Kept as a material (Recommended)".
- Removal. Options: Work stays (Recommended) / Ask each time / Work goes too. Answer: "work goes too. but for stuff like this always warn the user with numbers and confirm".
- What first. Options: What you are looking at (Recommended) / Finds first, in order / Due date only. Answer: "Finds first, in order".
- Guides when. Options: A few ahead (Recommended) / All at once / Only when asked. Answer: "A few ahead (Recommended)".

### Batch 4

- Event design. Options: Build that (Recommended) / Same, in memory / Go further. Answer: "go further. explain this more to me. I find it facinating".
- What goes. Options: Its problems (Recommended) / Whole sets / Only its own set. Answer: "revert my other decision. This can be a rule for now. if you remove it, it can stay if its used elsewhere, just mark it."
- Asked guide. Options: Ahead of the others (Recommended) / Strictly in order. Answer: "Ahead of the others (Recommended)".

### Batch 5

- Removal, which meaning. Options: Hidden, still usable (Recommended) / Gone, work marked. Answer: "Hidden, still usable (Recommended)".
- Undo scope. Options: Undo, no history screen (Recommended) / Undo and history / Record only. Answer: "Undo, no history screen (Recommended)".
- Confirms. Options: Undo replaces most (Recommended) / Confirm and undo / Confirm when it takes others. Answer: "Undo replaces most (Recommended)".
- Keep for. Options: 30 days (Recommended) / Until you empty it / This session. Answer: "This session".

### Batch 6 (hand-back)

- Keep for, asked once more. Options: A week / This session, as I said / Session, but confirm removals. Answer: "a week since eventually I'll add a history".
- Hand-back. Options: Approve as written / I will read it first / Keep grilling. Answer: "Approve as written".
