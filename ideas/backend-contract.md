# The backend contract: the wire types

## Status

Built, awaiting merge. Branch `backend-contract`, track 1 of
[backend-courses.md](backend-courses.md). It merges into `backend` once that branch
exists, and then into `design`, whose sample data is retyped against it.

What it is: eleven new Go packages holding only `wire.go` (and a `doc.go` for the
package comment), generated to `web/src/api/gen/<package>.ts` by tygo. No handlers,
no SQL, no behaviour. The old packages (`library`, `homework`, `ask`, `errlog`) are
untouched and keep running until later tracks replace them.

Jack reads this file instead of the code. The judgement calls at the end are the
places most worth overruling, most doubtful first.

## Information

### Rules every shape follows

- Every resource has `id` (a UUID, except a condition's fixed name and an incident's
  six-character id) and `seq`, the change-log sequence of its last change. Of two
  copies of a thing, the page keeps the one with the higher `seq`.
- What the student can remove has an optional `removedAt` (course, material, set,
  question, turn). Removed things are hidden, undoable, and purged after a week.
- Page numbers are PDF pages, from 1, as today.
- A list is never `null` on the wire. Each list field's comment says "Never null": the
  store must leave it `[]`, as `internal/homework`'s `nonNilLists` does today. Lists
  that are optional parts of a place are left out instead (`sides`).
- Times are RFC 3339 strings; due dates are `YYYY-MM-DD`.
- References to other things end in `Id` (`courseId`, `setId`), as today's wire does.
- Leaf types are reused, not copied: `doc.Block`, `doc.Run`, `errs.View`,
  `pagenum.Run`, `probnum.Style`, `usage.Usage`.

### The packages

| Package     | Holds                                                                                 |
| ----------- | ------------------------------------------------------------------------------------- |
| `change`    | The change event, the kinds of resource, and the stream's unlogged events             |
| `step`      | A step: one piece of background work, its states and the step names per subject       |
| `course`    | A course                                                                              |
| `material`  | A material, its import progress and its contents                                      |
| `work`      | A set, a question, a find, a reading, and an assignment read with its rows for review |
| `document`  | A guide or an Ask answer                                                              |
| `turn`      | An Ask turn (a new name: `ask` is the old package)                                    |
| `incident`  | An incident, the kinds of failure, and what the page posts for its own failures       |
| `condition` | A condition and the first set of ids                                                  |
| `place`     | A remembered place: where, layout, unsent                                             |
| `action`    | The catalog entry as the page receives it, and the undo call                          |

### change

**Change** (the `change` event): one row of the change log. The page has one handler:
patch from `after` when it is there, otherwise read the thing again by kind and id.

| Field      | Holds                                                                          |
| ---------- | ------------------------------------------------------------------------------ |
| `seq`      | its place in the log; the page resumes from the last one it saw                |
| `kind`     | what kind of thing changed (Resource)                                          |
| `id`       | the thing                                                                      |
| `courseId` | the course it is in, if any                                                    |
| `setId`    | the set it is in, for a question and what hangs off it                         |
| `op`       | created, changed, removed, restored                                            |
| `after`    | the fields the student changed and their new values; absent for what PSet made |
| `actor`    | student or pset                                                                |
| `action`   | the id of the student's action it belongs to, which Undo takes back whole      |

**Resource**: course, material, set, question, find, reading, document, turn, read
(an assignment read), memory, step, incident, condition, place.

**Events on the stream.** `change` is logged. The rest are not and are lost on a
reconnect, which costs nothing because the finished result arrives as a change:

| Event                      | Carries                              | For                                      |
| -------------------------- | ------------------------------------ | ---------------------------------------- |
| `resync`                   | nothing                              | the page's seq is older than the log     |
| `document.block.start`     | documentId, index, type              | draw the block's skeleton                |
| `document.block.text`      | documentId, index, runs              | append to the open text block            |
| `document.block.repairing` | documentId, index, type              | "Tidying"                                |
| `document.block`           | documentId, index, block             | the finished block                       |
| `document.block.failed`    | documentId, index, block (a raw one) | the block shown muted, as its source     |
| `step.activity`            | stepId, label                        | "Reading page 142", "Searching 'eigen…'" |

### step

**Step**: one piece of background work on one thing. Every material, read, question,
set and turn carries its `steps`, in order.

| Field            | Holds                                                            |
| ---------------- | ---------------------------------------------------------------- |
| `id`, `seq`      |                                                                  |
| `subjectKind`    | material, read, question, set or turn                            |
| `subjectId`      | the thing it works on                                            |
| `name`           | which step (below)                                               |
| `state`          | waiting, running, retrying, done, failed, out_of_date, not_asked |
| `attempts`       | how many times it has run, so a second failure says so           |
| `retryAt`        | when a retrying step runs again ("trying again in 8 s")          |
| `incidentId`     | the open incident it failed on, or waits on (no key, no credit)  |
| `startedAt`      | when its latest run began                                        |
| `endedAt`        | when its latest run ended                                        |
| `typicalSeconds` | how long this step usually takes here, for "about 20 s"          |
| `usage`          | what its model calls spent, across every run                     |

**Names**, per subject: material: examine, read_pages, contents, numbering, search.
Read: read. Question: find, figures, guide, check. Set: rank. Turn: answer.

`retrying` is a state of its own, beside the spec's six: the errors spec's "passing"
failure shows as "trying again in 8 s", which is neither waiting nor failed.

### course

| Field       | Holds                       |
| ----------- | --------------------------- |
| `id`, `seq` |                             |
| `name`      | what the student calls it   |
| `createdAt` | when it was added           |
| `removedAt` | when the student removed it |

### material

| Field       | Holds                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| `id`, `seq` |                                                                           |
| `courseId`  | its course                                                                |
| `title`     | its name                                                                  |
| `pageCount` | how many pages; 0 until examined                                          |
| `aspect`    | page height over width, so pages hold their box before they arrive        |
| `pageRuns`  | how printed page numbers run against PDF pages                            |
| `problems`  | how it numbers its problems, once worked out                              |
| `textbook`  | true for the course's textbook, where references are looked for first     |
| `progress`  | while being read in: pages done, pages total, about how many seconds left |
| `steps`     | its import: examine, read pages, contents, numbering, search              |
| `addedAt`   | when it was added                                                         |
| `removedAt` | when the student removed it; it stays readable while a set uses it        |

**Contents**: `materialId` and `entries`, each entry `{id, title, page, children}`, as
today. It has no `seq`: it is PSet's, and is read again when the contents step
changes.

### work

**Set**

| Field        | Holds                                                                |
| ------------ | -------------------------------------------------------------------- |
| `id`, `seq`  |                                                                      |
| `courseId`   | its course                                                           |
| `title`      | its name                                                             |
| `due`        | the date it is due, or empty                                         |
| `turnedInAt` | when it was turned in                                                |
| `sheetId`    | the material it was read from, opened beside it                      |
| `total`      | how many questions                                                   |
| `done`       | how many are marked done                                             |
| `bar`        | one entry per question: done, failed, weight (its difficulty)        |
| `estimate`   | time left at the student's pace: seconds, low, high                  |
| `timed`      | how many finished questions the estimate learned from                |
| `steps`      | rank                                                                 |
| `openedAt`   | when the student last had it open, for Home's "opened in the last 7" |
| `createdAt`  | when it was made                                                     |
| `removedAt`  | when the student removed it                                          |

**Question**: as the student made it and works it.

| Field        | Holds                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| `id`, `seq`  |                                                                          |
| `setId`      | its set                                                                  |
| `position`   | its place in the set                                                     |
| `text`       | what the student typed                                                   |
| `label`      | its name on the strip and header ("3.1 #7")                              |
| `notes`      | the professor's instructions, one a line, as runs                        |
| `done`       | marked done                                                              |
| `revealed`   | the help steps opened: hint, walkthrough, answers                        |
| `images`     | pictures the student attached: id, label, ratio                          |
| `difficulty` | 1 to 5 against its set, once ranked                                      |
| `seconds`    | time spent with it open                                                  |
| `guideId`    | its guide's document, once first written or asked for                    |
| `steps`      | find, figures (if any), guide, check; the guide step says if out of date |
| `removedAt`  | when the student removed it                                              |

**Find**: where PSet found a question. Exactly one of a material and page, or an
earlier question. A problem written out in full has no find.

| Field        | Holds                                                      |
| ------------ | ---------------------------------------------------------- |
| `id`, `seq`  |                                                            |
| `questionId` | the question                                               |
| `materialId` | the material it was found in                               |
| `page`       | the PDF page it starts on: the page link                   |
| `earlierId`  | an earlier question it builds on                           |
| `boxes`      | where it is on the page (page, x, y, w, h, text or figure) |
| `figures`    | its figures, cropped: label, w, h                          |
| `statement`  | the problem as printed, as runs                            |

**Reading**: how a question's figures read.

| Field        | Holds                                                  |
| ------------ | ------------------------------------------------------ |
| `id`, `seq`  |                                                        |
| `questionId` | the question                                           |
| `lines`      | the facts, one a line, as runs                         |
| `doubts`     | where the readings disagreed: the lines worth checking |
| `corrected`  | true once the student corrected it                     |

**Detail** (the work pane's read): the set, its questions, their finds and readings.
Guides are read by their document id.

**Read** (an assignment sheet being read for review)

| Field        | Holds                                      |
| ------------ | ------------------------------------------ |
| `id`, `seq`  |                                            |
| `courseId`   | its course                                 |
| `source`     | a web address, a file's name, or "pasted"  |
| `sheetId`    | the material an uploaded sheet was kept as |
| `setId`      | the set it was read to update, if it was   |
| `steps`      | read                                       |
| `assignment` | what was read, once done: title and groups |
| `createdAt`  | when it started                            |

Its rows are today's, unchanged but for names: **AssignmentGroup** `{due, title,
rows, imported, setId, gone}`, **AssignmentRow** `{kind, text, labels, unread, notes,
present, added, changed}` with kind textbook, own or other, **NotesChange**
`{questionId, label, was, now}`, **SetQuestion** `{questionId, label}`.

### document

| Field       | Holds                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| `id`, `seq` |                                                                         |
| `ownerKind` | question (its guide) or turn (its answer)                               |
| `ownerId`   | the question or turn                                                    |
| `blocks`    | what is written so far; a guide's first block is its hint               |
| `state`     | writing, done, stopped (ended before whole; the step says why)          |
| `corrected` | the index of each block the check changed after it could have been read |

### turn

| Field        | Holds                                                                 |
| ------------ | --------------------------------------------------------------------- |
| `id`, `seq`  |                                                                       |
| `courseId`   | the course whose conversation it is in                                |
| `question`   | what was asked                                                        |
| `about`      | the chip: questionId (if a problem), label, text                      |
| `images`     | pictures pasted with the question: id, ratio                          |
| `answerId`   | the answer's document                                                 |
| `tools`      | what Ask did, in order: tool, label, after (blocks written before it) |
| `remembered` | preferences it saved: memoryId, text                                  |
| `steps`      | answer                                                                |
| `createdAt`  | when it was asked, for the day dividers                               |
| `removedAt`  | when the student cleared it                                           |

### incident

| Field         | Holds                                                                      |
| ------------- | -------------------------------------------------------------------------- |
| `id`, `seq`   | the six-character id                                                       |
| `error`       | what the student is shown (`errs.View`)                                    |
| `kind`        | passing, waiting_on_you, your_input, cant, ours                            |
| `subjectKind` | what it is about; absent for something general (the key)                   |
| `subjectId`   | the thing                                                                  |
| `courseId`    | its course, for placing it                                                 |
| `setId`       | its set                                                                    |
| `stepId`      | the step that failed: Try again reruns it                                  |
| `action`      | the student's action that led to it                                        |
| `born`        | request, step or page                                                      |
| `route`       | the request's route or the page's address                                  |
| `state`       | open, healed, tried_again, subject_removed, dismissed                      |
| `count`       | how many times the same cause failed on the same subject                   |
| `firstAt`     | when it first happened                                                     |
| `lastAt`      | when it last happened                                                      |
| `resolvedAt`  | when it was resolved                                                       |
| `detail`      | the error's own text, for a bug report; never a key, a prompt or an answer |

**PageReport**, what the page posts for its own failures: `chain` (catalog ids,
outermost first), `links` (each link's values), `detail` (the error text and stack),
`route`, and optionally `subjectKind`, `subjectId`, `action`. The reply is the
incident.

### condition

| Field   | Holds                                                                                         |
| ------- | --------------------------------------------------------------------------------------------- |
| `id`    | key, credit, provider, pdf_reader, scan_reader, data_folder, database, disk_space, embeddings |
| `seq`   |                                                                                               |
| `holds` | whether it is the case                                                                        |
| `since` | when it last started or stopped holding                                                       |
| `error` | while it does not hold: what is missing and the fix, from the error catalog                   |
| `fix`   | the action that fixes it, if any                                                              |

### place

One shape, `{id, seq, ownerKind, ownerId, group, kind, tabId?}` plus the fields its
kind fills. A thing has at most one place of each kind, except a material's `page`
and `zoom`, which are per tab.

**A material's spot is per tab** (W6, M8): a material can be open in two tabs, and
each keeps its own exact spot and zoom. A `page` or `zoom` place with a `tabId` is
that tab's own, and goes when the tab closes. One without a `tabId` is the
material's last spot, which a newly opened tab starts from.

| Kind         | Group  | Owner    | Fields                                                      |
| ------------ | ------ | -------- | ----------------------------------------------------------- |
| `problem`    | where  | set      | `questionId`                                                |
| `page`       | where  | material | `tabId?`, `page`, `down` (fraction of that page scrolled)   |
| `line`       | where  | document | `block` (index of the block last in view)                   |
| `sides`      | layout | course   | `sides` (each: `tabs` {id, kind, thingId}, `open`), `split` |
| `zoom`       | layout | material | `tabId?`, `zoom` (1 is fitted to width)                     |
| `ask_draft`  | unsent | course   | `text`, `aboutId`                                           |
| `note_draft` | unsent | question | `text`                                                      |
| `new_set`    | unsent | course   | `title`, `due`, `text` (its lines)                          |

A tab's kind is set, material or ask.

### action

**Entry**: `{id, name, key?, needs[], undoable, costs}`. `needs` is condition ids.

**Undo** (the request): `{action?}`, the action's id; absent for Ctrl+Z, which takes
back the newest one not yet undone.

**Undone** (the reply): `{action, entry, said, kind, id, seq}`: the action taken
back, its catalog id, the sentence to show ("Renamed back to Problem set 4."), the
thing Show goes to, and the seq of the undo's last write.

### What was dropped from the old types, and why

From **Book** (`library`), now Material:

- `sha256`: a duplicate check on the server; no screen shows it.
- `author`: the course screen's material row shows a name and pages (C5).
- `cover`: the shelf is gone.
- `kind` (digital or scanned): it only ordered the import queue; no kind is shown (S11).
- `rail`: the contents rail is gone; Contents opens over the pages (M3).
- `state` with `phase`, `done`, `total`, `error`: replaced by `steps`, `progress` and
  the step's incident.
- `usage` (the dialog's shape): spend moves to the course's stats box, a later track.
- `updatedAt`: replaced by `seq`.

From **Summary** (`homework`), now Set:

- `bookId`: now `courseId`. `dueDate` is now `due`.
- `opening`: the first open problem, carried for the old walkthrough's skeleton. The
  work pane reads the set's Detail instead.

From **Question** (`homework`):

- `homeworkId`: now `setId`.
- `inBook`: a problem written out in full is told by having no find step.
- `statement`, `page`, `boxes`, `figures`: now on the Find.
- `hint`, `walkthrough`: now one Document, read by `guideId`.
- `state`, `attempts`, `failedAt`, `updatedAt`: now the question's `steps`.
- `error`: now the step's incident.
- `activity`: now the `step.activity` event.
- `reading`, `readingEdited`, `readingDoubts`: now the Reading.
- `usage`: now on each step.
- `rev`: now `seq`.
- An attached image was a figure with a `ratio`; it is now an `Image` with its own id.

From **Turn** (`ask`):

- `bookId`: now `courseId`.
- `answer` (blocks): now a Document, read by `answerId`.
- `steps` (tool rows with `running` and `memoryId`): now `tools` and `remembered`;
  the one running is the answer step's activity line.
- `state`, `error`, `usage`, `updatedAt`: now the answer step, its incident, its
  usage, and `seq`.
- `about` was a string; it is now the chip `{questionId, label, text}`.

From **AssignmentRead** (`homework`), now Read:

- `bookId`: now `courseId`.
- `state`, `error`, `activity`, `usage`, `updatedAt`: now its read step.
- `Assignment.source` moved up to the Read, which already had it.
- Row kind `book` is now `textbook`.

From **errlog**'s Group and Incident: grouping by id is the page's to do; `at` is now
`firstAt` and `lastAt`.

From **settings**' HealthCheck: `name`, `detail` and `fixable` are now the
condition's `error` (with its catalog words) and `fix`.

Not in this contract: request bodies (patches, adds, the assignment import, boxing,
retry). Each is an action's input, written with the catalog in track 7. The only
requests here are the undo call and the page's report. Memory, settings, usage and
study time keep their old wire until they move (tracks 6 and 7).

### Judgement calls, most doubtful first

1. **A set's counts move with its questions.** `total`, `done`, `bar` and `estimate`
   are on the Set as the spec asks, so a question's change must also bump its set's
   `seq` (track 2's trigger on questions touches the set). The other way: drop them
   and let the page count from questions, which lists like Home do not load.
2. **No `guideOutOfDate` on the question.** The guide step's `out_of_date` state says
   it; a second field could disagree with it.
3. **Ask's tool calls are not steps.** A turn has one runner step, `answer`; what it
   did while answering (K13, K15) is `tools`, each with the block index it followed.
4. **Usage is per step, not per question.** A question's spend is the sum of its
   steps' `usage`, added up on the page. The other way: a `usage` total on the
   question too.
5. **`action` on a change is the action's own id, not its catalog id.** Undo needs to
   name one action among many of the same kind. There is no general reply type that
   hands the page its action's id; it reads it off the change events, or track 7
   adds one.
6. **Request bodies are left to the catalog** (above). The design branch's sample
   data needs only the resources.
7. **`resync` is new**: the log keeps a week, so a page asleep longer cannot replay.
8. **Block events carry `index`**, so a page that read a document part way through
   knows which blocks it already holds.
9. **`retrying` is a seventh step state**, for the "passing" failure.
10. **`typicalSeconds` on a step** for P10's "Writing the walkthrough, about 20 s",
    from the steps table (A5 of the actions grill).
11. **`openedAt` on a set**, for Home's "opened in the last 7 days" and "last opened"
    (S14).
12. **A condition's words come from the error catalog** (`error`) rather than its own
    name and detail, so a blocked action and Settings say the same thing.
13. **A course has no dates.** The spec's table says "name, dates"; no screen shows a
    term, so only `createdAt` is kept.
14. **A place is one flat shape** with fields per kind rather than a nested union, so
    tygo can generate it; eight kinds.
15. **A document's `stopped` covers a failure part way** as well as the student's
    Stop; the step says which.
16. **Names**: `courseId` and `setId` (with `Id`, as today) where the spec wrote
    `course?` and `set?`; `turn` for the Ask package, since `ask` is the old one;
    `Read` for an assignment read, `Resource` for the kinds of thing.
17. **`Image` is defined twice**, in `work` and in `turn`, so the two features do not
    import each other.
18. **Contents has no `seq`** and pages and sections are not on the log, pending
    track 2's spike.

### For later tracks

- **Track 2's triggers:** a set's `seq` must move when one of its questions
  changes, because the set carries the counts, the bar and the estimate.
- **Track 7:** a reply to a student's action must carry that action's id, so the
  Undo message can name it.
