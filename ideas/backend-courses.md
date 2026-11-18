# The backend rewrite: how it gets built

## Status

In progress. The decisions are in [backend-courses-grill.md](backend-courses-grill.md)
(approved 2026-11-17), [errors-grill.md](errors-grill.md) and
[actions-conditions-place-grill.md](actions-conditions-place-grill.md); this file is
the order of work and the tracker. Branch
`backend`, cut from `dev` on 2026-11-17 after track 0.

| Track | What                                | Status                                      | Branch             |
| ----- | ----------------------------------- | ------------------------------------------- | ------------------ |
| 0     | Groundwork on `dev`                 | Done: the bar is measured, the test fix #95 | `flaky-go-test`    |
| 1     | The contract                        | Done: #96                                   | `backend-contract` |
| 2     | Schema, change log, events          | Done: #97                                   | `changelog`        |
| 3     | The step runner                     | Done: #98                                   | `step-runner`      |
| 4     | Courses and materials               | Built (#100); Jack measures (below)         | `material-import`  |
| 5     | Work: sets, finds, readings, guides | Not started                                 |                    |
| 6     | Ask                                 | Not started                                 |                    |
| 7     | Undo, and the rest of the app       | 7a #99, 7b #101, 7c #102, 7d #103; 7d2      | `study-usage`      |
| 8     | The web data layer and the screens  | In progress: merged #106; actions and undo  | `actions-and-undo` |
| 9     | Cut over                            | Not started                                 |                    |

## Information

### Four rules for the whole rewrite

1. **The container changes, the craft does not.** The prompts, the model choices, the
   find's rungs, the three readings and the check were each won by an eval. They move
   into steps word for word. A track that touches them reruns the evals and must match
   the bar set in track 0.
2. **Leaves are kept.** `pdf`, `ocr`, `mathx`, `doc`, `pagenum`, `probnum`, `errs`,
   `httpx`, `agent` and most of `llm` are not rewritten. What is rewritten is what
   holds state: `library`, `homework`, `ask`, `jobs`, `events`, `usage`.
3. **The contract comes first.** The wire types are written before any behaviour and
   handed to `design`, so the new screens' sample data has the real shapes from the
   start and the two branches cannot drift.
4. **Each track ends in something that runs** and passes the full `make check` on
   `backend`. Nothing is left half built between tracks.

### The branches

- `backend` is cut from `dev` after track 0. Every track is a pull request into it.
  `dev` takes only fixes meanwhile, and is merged into `backend` weekly.
- `design` merges `backend` in after track 1 (for the types), and again at track 8.
  **Assumed:** `design` is the branch that becomes the app, so the last merge is
  `design` into `dev`. Say if `backend` should be the one instead.
- Reviews: tracks 2, 3 and 9 touch the database and get the reviewer, and the second
  reviewer if it escalates. Only track 8 is a UI change that waits for Jack to try.

### The tracks

**0. Groundwork on `dev`.** Before anything is cut.

- Find and fix the intermittent Go test seen on 2026-11-17 (first `make check` run in
  the grill's worktree failed, the next four passed).
- Set the bar: run `tools/findertest` and `tools/assignmenttest` on today's code and
  write down find accuracy, guides right, cost and time for a ten-problem set.
- Done when: `make check` passes ten times running, and the bar is in this file.

**The bar** (measured once on `dev`, 2026-11-17, seeded test library, $0.39 spent):

| Measure                                      | Result                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Finder, all three books (`tools/findertest`) | 44 of 44 questions found on the right page, in 5 min 05 s                                         |
| A set of 5 problems without figures          | 5 of 5 ready, none failed, 132.6 s from adding the set to the last guide                          |
| The same set, cost                           | $0.072 over 46 calls, about $0.015 a problem: finds $0.018, rank $0.001, guides and checks $0.052 |
| The same set, pace                           | finds 8 to 21 s each, two at a time; first guide at 45 s, the rest at 50, 78, 112 and 133 s       |

What the bar does not cover, so track 5 must not claim it: the finder eval scores the
page only, not the statement, boxes or figures, and some references are read without a
model; no problem in the timed set had a figure, so figure reading was not timed or
priced; guide correctness was not judged.

Found while measuring: `tools/findertest` deletes its set when it ends, which deletes
that set's calls, so its cost cannot be read afterwards (calls keyed to steps, and a
tool that reports its own cost, fix this in track 5).

**1. The contract.** Types only.

- `wire.go` for course, material, set, question, find, reading, document, turn, step
  and change; generated to TypeScript; no handlers.
- Also the shapes of an incident, a condition, a place and an action's entry, so the
  screens can be designed against them.
- Merged into `design`, whose sample data is retyped against it.
- Done when: `design` builds on the generated types. Jack reads the shapes once, since
  every screen is designed against them.

**2. Schema, change log, events.** The riskiest track, so it starts with a spike.

- Spike: the triggers on three tables, an import of a 700-page book through them, and
  an undo of a removed set. If logging slows the import by more than a tenth, pages
  are not logged row by row, only their material.
- Then: the baseline migration, the trigger generator (from one list of tables and
  which columns the student made), the stream replaying the log, hiding and the weekly
  purge, the action id.
- The `incidents` table, on the log like any resource
  ([errors-grill.md](errors-grill.md)); the `errors` table and every `error` column go.
- Done when: every table has a test that writes, reads the log, undoes and compares.
- Deletes: every migration, `events`' ring and `reset`, every `Publish` call.

**3. The step runner.**

- The `steps` table, states, input hashes, the one retry rule, limits per model,
  calls keyed to steps.
- The model client built once in `main`, with no package globals and no labels carried
  in `context`.
- Conditions: the key, credit, the provider, the readers, the data folder, the
  database and disk space as resources on the log, learned from what happens. They
  are what healing watches.
- Done when: a fake three-step pipeline survives a kill and a restart, retries, goes
  out of date when its input changes, and its calls vanish with its subject.
- Errors: every catalog entry gains its kind and what clears it; a failed step opens
  an incident; healing reruns waiting steps when their cause is gone.
- Also done when: a fake step that fails for want of a key runs again by itself once
  a key is saved, and its incident resolves.
- Deletes: `jobs`, lanes, `usage`'s forgotten marks and sweep.

**How track 3 went** (2026-11-17, Jack's calls in the cloud session):

- A step's tries start over with each new run (asked, Try again, out of date, a
  condition healed); a run cut short by shutdown, a crash or a pause is not a try.
- Healing has explicit triggers only: saving a key (key, credit), a passing health
  check in Settings, Try again on a waiting incident, and any model call that works.
  No background probe, so out of credit waits for Try again.
- No Stop: a running step whose subject is removed pauses, and resumes if the
  removal is undone. Ask's "stopped by you" is designed in track 6.
- All eight conditions clear: a passing failure still failing after three tries
  waits on the provider; the readers, the data folder, the database and disk space
  are named from the raw cause (`condition.Cause`).
- Wired into `main` now: `store.db` beside the old database, one keyed model client,
  a daily purge. Reset leaves `store.db` alone until track 7 moves it.
- `jobs` and its lanes are gone from the app: homework and ask put their work on
  `oldwork.Idle`, which keeps nothing, and the library leaves books queued. **On
  `backend` the old screens no longer import, find, guide or answer**; Jack uses
  `dev` meanwhile. The old queue survives only as `internal/oldwork/oldworktest`,
  imported by homework's and ask's tests, so what tracks 5 and 6 port stays tested;
  it goes with the last of them. The library's tests import inline instead.
- For track 7: a SQLite fault in `store.db` marks the `database` condition, but
  Settings' database check, which heals it, still looks at the old `pset.db`.
- Old databases need not keep working (Jack, 2026-11-17): the migration stack is
  reset once the rewrite is done, so a migration here never needs a way back.
- Not done here: no Try again route yet (the action comes with track 7's catalog),
  and the new store's event stream is not mounted (no screen reads it before
  track 8). Mounted 2026-11-18 at `GET /api/changes` for track 8 (the old screens
  keep `GET /api/events`; the stream takes that path at the cut-over).

**4. Courses and materials.** Built 2026-11-17 in the cloud, without Jack's books:
the five steps run on the repo's sample PDFs, a scan with OCR faked (no Tesseract
there), a fake model and embedder. Search was ported as it was, embeddings and
all; Jack's measurements decide whether they stay (the eval below). The search
step's input is the embedding model's name, but a done step is only checked against
its input when something calls the runner's Changed: a new embedder needs that call
(or the step dropped) when the eval decides. Naming's calls are keyed to the
contents step, with no separate "Naming" stage as the old usage store had. Not proven
until Jack's run: a real textbook and a real scan, Tesseract, Ollama, naming and
the contents against a real model. Courses were built in 7a.

- Courses; a material's import as steps (examine, read pages, contents, numbering,
  search); textbook detection; page images.
- Decided here: **embeddings stay** (2026-11-18, from Jack's run of the real-import
  check on Yates and Goodman, 514 pages): with embeddings search found the definition
  and theorem pages a student wants (152 exponential, 156 Erlang, 185 to 188 joint
  PMF) where words alone missed them or returned index pages; the search step took
  5 min 42 s on his laptop's CPU, against none. The Ask and guide evals were never
  built, and this settled it without them.
- Measured: a textbook imports and resumes after a kill (7 min 27 s with
  embeddings, 48 s without; one model call, $0.0011; 3 of 514 pages without text).
  A scan read about 30 s a page on one core, under load: about 5 hours for 640
  pages. Fixed by reading pages several at once, one tesseract thread each
  (`parallel-ocr`); the scan run is to be repeated with the improved check
  (`internal/material/real_test.go`, which waits up to 6 h, logs pages read every
  minute, reports even on giving up, and writes the whole contents to a file).
- Done when: a real textbook and a scan import, resume after a kill, and search.

**5. Work.** The largest track; three pull requests.

- a. Sets, questions, assignment reads with the sheet kept as a material.
- b. Finds with the widening rungs, readings, ranking, the worksheet.
- c. Documents and their stream, guides three ahead, the check beside the guide,
  out-of-date marking.
- Decided here: **the limits per model**, by measuring.
- Done when: the evals match track 0's bar, and a ten-problem set is ready to work in
  under half the time it took in track 0.

Decided for 5a (Jack, 2026-11-18), from a map of the old homework code:

- **Every sheet is a material.** An uploaded PDF or image goes through the material
  import; a web page becomes a text material (its URL kept on it). A set points at its
  sheet (`sets.sheet_id`). "Check again" on a web page replaces the material's text
  (undoable), and the read compares the new rows with the set as today (added, changed,
  gone). This replaces the old `source` column: a set's source is its sheet's.
- **Pasted text is dropped** as a way to bring an assignment (Jack has not used it; the
  file upload covers professors' text). Typed questions stay.
- **Sheets are shown with their set**, not under Textbooks or Materials; still a
  material underneath, so finds can point into one.
- **A question says whether it is looked up** (`questions.find`) and which page the
  student pointed to (`questions.pin_page`, 0 for none): both the student's own and
  undoable. The old `in_book` and `pinned_page`.
- **Assignment reads use the Reader role**, keyed to their step, not the old chat
  setting. Its quality against track 0 is part of 5's evals.

The build plan for 5a, from the map (the old code's pure parts are reused as they are,
rule 1; what touched the old database or queue is rewritten on the store, runner and
catalog):

1. Schema: `questions.find`, `questions.pin_page`; a material's `url` and its text-only
   kind for web pages; an `assignment_reads` table (the read's state is a step's, its
   result JSON kept) beside the sets it imports into.
2. Actions: `set.add`, `set.rename`, `set.due`, `set.turn_in`, `set.remove`;
   `question.add` (drafts, references split into one per problem), `question.edit`,
   `question.move`, `question.done`, `question.reveal`, `question.notes`,
   `question.remove`; `read.start` (upload or URL), `read.import`, `read.dismiss`. Old
   rules kept: titles, dates, caps, notes, positions (removed rows skipped).
3. Steps: `read` (fetch or extract, then one Reader call with the old assignment
   prompt; rows `book` renamed `textbook` with the prompt and parser together), the
   sheet's material import run as its own steps.
4. Reads and routes for the page: a course's sets, a set's detail, a read's review.

**6. Ask.** Turns per course on the same documents and stream; memory.

**7. Undo, and the rest.** Built ahead of 4 to 6, in four pull requests: 7a the
action catalog, its route, Undo and the course actions; 7b places; 7c errors (the
Settings list, an incident's trace, Try again, the switch that forces an error);
7d Settings, health, study time, usage and Reset on the new store. Decided for 7d
(2026-11-18): usage is new reads over the store's `calls` (per course, material and
set), the old usage routes left frozen; study time is a per-course table in the
store; health reads the conditions and each Fix is an action; Reset moves onto the
store at the cut-over (track 9), since nobody uses this branch before then. 7d lands
in two pull requests: health and the key, then study time and usage. Then, from
`ideas/dependencies-grill.md` (approved 2026-11-18): textbooks as a kind of material
(#108) and the dependency map (`dependency-rules`). For track 9:
the key and the name now live in the store, and nothing copies them from the old
database, so an install that upgrades starts with neither (Jack imports again, and
saves his key again). Also for track 9: once `make test-library` snapshots the
store, it strips the store's `settings` table (the key). For track 8: a condition's
row holds the last error said about it, from a step or a check, so Settings shows
`condition.error` and not only the check's detail; a check's heal and a step's
failure at the same moment can still cross (the count of what it can't disprove
and Holds are two transactions). Each later track
adds its own actions, and the catalog's walk test grows with them. Decided
(Jack had no preference): one route for every action, `POST /api/actions/{action}`;
the key and profile move to `store.db` in 7d. For track 8: an action that can't
be undone writes as PSet, so the stream can't tell it from PSet's own work; a page
offers Undo only when the action's reply carries an `action`.

- The action catalog: every student action declared once (id, name, input, key, what
  it needs, whether it can be undone, whether it spends), generated to TypeScript.
  Routes, undo and Ask's tools come from it; Ask runs only what can be undone and
  costs nothing.
- Places: where the student was, the layout and what was not sent, per thing, by the
  one rule in the grill.
- The undo call and Ctrl+Z's server side.
- Errors: the Settings list (open, then a week), an incident's trace, and the
  development switch that forces any error at any step.
- Study time, usage views, Settings, health, Reset, the updater: moved onto the new
  tables with as little change as they allow.
- Settings health reads the conditions, and each Fix is an action.
- Done when: a test walks the catalog and proves every undoable action undoes, and
  no two actions share a key on one screen.

**8. The web data layer and the screens.** On `design`.

- One event handler, one cache rule (the higher sequence wins), hooks per resource,
  the document stream, undo.
- One error module: every failure on the page becomes a catalog error, the page's own
  are posted as incidents, each shows once at the closest owner, and the layer runs
  Try again.
- Shortcuts from the catalog, single keys when not typing; a blocked action says what
  it needs; places replace the browser-storage files for layout and position.
- The palette (Ctrl+K): actions, and going to a course, set, problem or material by
  name. A new unit, with its own short design pass first.
- Then each screen swaps its sample data for the hooks: Home, the course, the work
  pane, the material pane, Ask, Settings. Jack tries each.

**How track 8 goes** (Jack's calls, 2026-11-18):

- The cache is a normalized store of its own (each thing by kind and id, the higher
  seq kept), not TanStack Query: Jack uses `dev` until track 8 is done, so the new
  screens need not live beside the old hooks. Built ahead of the stream against a
  fake one (Jack, 2026-11-18); only its URL waits for gap 1.
- Gap 1 was handed to the backend session on 2026-11-18. The palette is on hold
  until Jack needs it.
- Until then: actions and undo, the error module and places, each a pull request
  into `design` that merges once green and reviewed. The new layer is
  `web/src/data/`; the old `web/src/api/` hooks go at the cut-over.

**Backend gaps found by track 8**, for the backend session (route or field, and why):

1. **The store's change stream is not mounted.** `main.go` serves the old bus at
   `GET /api/events`; `store.Handler` is on no route. Needed: mount it on a route of
   its own until the cut-over (say `GET /api/changes`, replay from `Last-Event-ID`
   or `?after=`), since the old screens still read the old bus. Blocks the store,
   every hook and C6's places on a new tab.
2. **No cheap read of the conditions.** C5 says a blocked action is said at its
   button, before the student tries, so the page needs every condition while it
   draws. `GET /api/health` runs the checks each time. Needed: a read that does
   not check (`GET /api/conditions`, or `GET /api/health?check=false`), and the
   conditions as changes on the stream so a healed one ungreys its buttons.
3. **`action.blocked` names no condition.** The refusal carries only sentences
   ("Add material can't run yet. ..."), so the page can't offer the fix as a
   button, or tell which condition to watch. Needed: the condition's id and its
   fix action's id on the reply (fields on the view, or a `blocked` object beside
   it).
4. **No action has a key.** Every catalog entry's `key` is empty (A6 drafts them
   with the catalog). Not blocking: the keys can be drafted in the palette's design
   pass, then written into the catalog. A6's test that no two actions share a key on one screen
   comes with them, on whichever side writes the keys.
5. **No catalog entry for the page's own failures.** `POST /api/incidents` takes a
   chain of catalog ids, but the catalog has none for what only the page sees: a
   crash, a promise nobody caught, a dead stream (`store.no_streaming` is the one
   close). The page reports them all as `internal.unexpected`, so Settings can't
   tell a crash from a lost stream. Needed: entries such as `page.crashed` and
   `page.rejected` (kind ours), and a word on which the stream's loss should use.
6. **A step's change names no subject.** A change of kind `step` carries the step's
   id (and course and set), but not what it is a step of, and no route reads one
   step. The store reads again whatever it holds that lists the step, which works
   for a material on screen and misses a thing not yet read. Not blocking. Nice
   to have: the subject's kind and id on a step's change.

**9. Cut over.**

- The old screens and their API go. `tools/testlib`, `fixturelib`, `samplegen` and
  `seedusage` are rebuilt on the new schema, and the test library is made again.
- `design/backend.md` is rewritten from this spec; each package's README with it.
- Jack's library: the old folder is set aside, and he imports again.
- Done when: `design` is merged into `dev` and `make check` is green there.

### What is still open, and where each gets decided

| Open                                         | Decided in    | How                                                                                                                        |
| -------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Whether embeddings and Ollama stay           | Track 4       | Decided 2026-11-18: they stay (track 4's measurements, above)                                                              |
| Poppler and Tesseract as programs to install | After track 9 | A spike of an embedded PDF library. Not on the path: the leaves are kept, so it can change later without touching the rest |
| The limits per model, in numbers             | Track 5       | Raise each until the provider pushes back, then halve                                                                      |
| Porting the old library                      | After track 9 | Its own small grill, if Jack still wants it. The old folder is kept until then                                             |
| Routes and wire types                        | Tracks 1 to 7 | Written into `design/backend.md` as each part is built                                                                     |
| A history screen                             | Not planned   | The log keeps a week; a screen needs its own grill                                                                         |
| The palette's design and each action's key   | Track 8       | The palette's design pass on `/design`; keys drafted with the catalog and corrected in the palette                         |
| The look of "waiting" and the one notice     | Track 8       | The error notice's design pass on `design`                                                                                 |
| Step replay and the cost ledger              | After track 9 | Ideas, not decided: [step-replay.md](step-replay.md), [cost-ledger.md](cost-ledger.md)                                     |

### What could go wrong

- **A wrong trigger corrupts quietly.** Track 2's per-table tests, and undo is tested
  by comparing whole rows, not by reading the code.
- **The pipeline gets worse without anyone noticing.** Rule 1 and track 0's bar.
- **The branches drift.** The contract first, `dev` merged in weekly, and `dev` frozen
  for backend features.
- **It grows.** The history screen, the port, the PDF library, step replay and the
  cost ledger are named above as not part of this, so they are not started by
  accident. Actions, conditions and places were added on purpose: undo and healing
  already build half of each.

### What Jack does

- Track 0: nothing.
- Track 1: read the shapes.
- Track 2: hear the spike's result; decide if it changes the design.
- Tracks 4 and 5: approve a capped model key for the evals, each time.
- Track 8: try each screen, and the palette.
- Track 9: import his library again.
