# The backend rewrite: how it gets built

## Status

Planned. The decisions are in [backend-courses-grill.md](backend-courses-grill.md)
(approved 2026-11-17); this file is the order of work and the tracker. Branch
`backend`, not yet created.

| Track | What                                | Status      | Branch |
| ----- | ----------------------------------- | ----------- | ------ |
| 0     | Groundwork on `dev`                 | Not started |        |
| 1     | The contract                        | Not started |        |
| 2     | Schema, change log, events          | Not started |        |
| 3     | The step runner                     | Not started |        |
| 4     | Courses and materials               | Not started |        |
| 5     | Work: sets, finds, readings, guides | Not started |        |
| 6     | Ask                                 | Not started |        |
| 7     | Undo, and the rest of the app       | Not started |        |
| 8     | The web data layer and the screens  | Not started |        |
| 9     | Cut over                            | Not started |        |

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

**1. The contract.** Types only.

- `wire.go` for course, material, set, question, find, reading, document, turn, step
  and change; generated to TypeScript; no handlers.
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
- Done when: every table has a test that writes, reads the log, undoes and compares.
- Deletes: every migration, `events`' ring and `reset`, every `Publish` call.

**3. The step runner.**

- The `steps` table, states, input hashes, the one retry rule, limits per model,
  calls keyed to steps.
- The model client built once in `main`, with no package globals and no labels carried
  in `context`.
- Done when: a fake three-step pipeline survives a kill and a restart, retries, goes
  out of date when its input changes, and its calls vanish with its subject.
- Deletes: `jobs`, lanes, `usage`'s forgotten marks and sweep.

**4. Courses and materials.**

- Courses; a material's import as steps (examine, read pages, contents, numbering,
  search); textbook detection; page images.
- Decided here: **embeddings** (below), before the search step is ported.
- Done when: a real textbook and a scan import, resume after a kill, and search.

**5. Work.** The largest track; three pull requests.

- a. Sets, questions, assignment reads with the sheet kept as a material.
- b. Finds with the widening rungs, readings, ranking, the worksheet.
- c. Documents and their stream, guides three ahead, the check beside the guide,
  out-of-date marking.
- Decided here: **the limits per model**, by measuring.
- Done when: the evals match track 0's bar, and a ten-problem set is ready to work in
  under half the time it took in track 0.

**6. Ask.** Turns per course on the same documents and stream; memory.

**7. Undo, and the rest.**

- The undo call and Ctrl+Z's server side.
- Study time, usage views, Settings, health, Reset, the updater: moved onto the new
  tables with as little change as they allow.

**8. The web data layer and the screens.** On `design`.

- One event handler, one cache rule (the higher sequence wins), hooks per resource,
  the document stream, undo.
- Then each screen swaps its sample data for the hooks: Home, the course, the work
  pane, the material pane, Ask, Settings. Jack tries each.

**9. Cut over.**

- The old screens and their API go. `tools/testlib`, `fixturelib`, `samplegen` and
  `seedusage` are rebuilt on the new schema, and the test library is made again.
- `design/backend.md` is rewritten from this spec; each package's README with it.
- Jack's library: the old folder is set aside, and he imports again.
- Done when: `design` is merged into `dev` and `make check` is green there.

### What is still open, and where each gets decided

| Open                                         | Decided in    | How                                                                                                                              |
| -------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Whether embeddings and Ollama stay           | Track 4       | Run the Ask and guide evals with text search alone. If they match, the embed step, its health check and its table are not ported |
| Poppler and Tesseract as programs to install | After track 9 | A spike of an embedded PDF library. Not on the path: the leaves are kept, so it can change later without touching the rest       |
| The limits per model, in numbers             | Track 5       | Raise each until the provider pushes back, then halve                                                                            |
| Porting the old library                      | After track 9 | Its own small grill, if Jack still wants it. The old folder is kept until then                                                   |
| Routes and wire types                        | Tracks 1 to 7 | Written into `design/backend.md` as each part is built                                                                           |
| A history screen                             | Not planned   | The log keeps a week; a screen needs its own grill                                                                               |

### What could go wrong

- **A wrong trigger corrupts quietly.** Track 2's per-table tests, and undo is tested
  by comparing whole rows, not by reading the code.
- **The pipeline gets worse without anyone noticing.** Rule 1 and track 0's bar.
- **The branches drift.** The contract first, `dev` merged in weekly, and `dev` frozen
  for backend features.
- **It grows.** The history screen, the port and the PDF library are named above as
  not part of this, so they are not started by accident.

### What Jack does

- Track 0: nothing.
- Track 1: read the shapes.
- Track 2: hear the spike's result; decide if it changes the design.
- Tracks 4 and 5: approve a capped model key for the evals, each time.
- Track 8: try each screen.
- Track 9: import his library again.
