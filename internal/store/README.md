# store

The data for courses, materials and work, and its change log: one baseline schema
whose logged tables announce every change through database triggers. Built in track 2
of [the rewrite](../../ideas/backend-courses.md); not wired into the app until the
cut-over, so the old packages keep running meanwhile.

## Writing

- **Every write to a logged table goes through `Store.Write(ctx, actor, action, fn)`.**
  It runs `fn` in one transaction with a row in `change_ctx` saying who writes (the
  student or PSet) and the student's action id. The row is inserted first and deleted
  last, so it never commits; the write lock taken at BEGIN keeps every other
  connection from seeing it. A write made any other way is refused by the table's
  own triggers. Nothing but this package names `change_ctx` (a test checks).
- **One action is one `Write`.** Undo checks an action's changes against everything
  after them; an action split over two writes could not see what came between.
- **Nothing is deleted but by the purge.** Removing is `UPDATE ... SET removed_at`.
  A removed set's questions are not marked; they hide with it, and every read filters
  on the markers up the chain.
- **No `INSERT OR REPLACE`** on a logged table (a test checks): use
  `ON CONFLICT DO UPDATE`. With `recursive_triggers` on, as `Open` sets it, a REPLACE
  is refused rather than dropping the old row from the log.
- **Hot paths prepare their statements.** Every `Exec` recompiles the table's
  triggers (about half a millisecond for questions, measured in the spike).

## The tables

`Tables` classifies each logged table's columns once, and the triggers are generated
from it:

| Class     | Logged                                                                                     |
| --------- | ------------------------------------------------------------------------------------------ |
| `Student` | with old and new values: Undo writes them back, the page patches from them                 |
| `PSet`    | as "changed" with no values, unless the student's own action changed it (then with values) |
| `Meta`    | never: seq, stamps, saved rounds, anything that may hold a blob                            |

A test checks every real column is classified exactly once; a student column put
among PSet's would lose its undo with no other error. A new column is classified in
the same change, and a migration that alters a logged table drops its triggers and
makes them again from `Schema`.

Pages and sections are logged through their material (`pages_read`, `page_count`),
never row by row: per row, a 700-page import was a quarter to a half slower in the
spike. Only their deletes are guarded.

A question's change to its place, done, removal or difficulty also logs a
value-less change to its set (an echo) and bumps the set's `seq`, so the set's
counts arrive with it.

## The dependency map

`Links` (`deps.go`) declares every link between things once (spec:
`ideas/dependencies-grill.md`): its child and parent, the column, and
whether the child **owns**-links (lives inside its parent: hidden with it,
purged with it) or **refers** (points at something it doesn't own: keeps
resolving after the target is removed, and keeps it from being purged).
From it come:

- `Visible(kind, idExpr)`: SQL true while a thing and every owner are not
  removed; `VisibleSubject` for a kind and an id (the runner's steps).
- The purge of removed things (`purgeRemoved`): after a week, and only once
  nothing outside a thing refers to it or to anything inside it; repeated
  until a pass frees nothing more.
- `Owned`: what a removal takes with it, for its notice (`Done.Took`).
- `HiddenBy`: the nearest removed owner, for Undo's "its course is still
  removed".

`deps_test.go` walks the map against the schema: every link's column
exists, every single-parent owns-link is a cascading foreign key, and every
`*_id` column is a link or says in `notLinks` why it isn't.

## Reading the log

- `Since(seq, limit)`: each thing changed after `seq`, once, oldest first, with
  `after` only when every change in the batch was the student's to the student's
  columns. Otherwise, and for anything created, the page reads the thing again.
  `ErrResync` when the log no longer reaches back that far.
- `Handler`: `GET /api/events`. Replays from `Last-Event-ID` (or `?after=`), then
  follows. A change's event id is its `seq`; unlogged events (`Publish`: a document's
  blocks, a step's activity) carry none, so a reconnect resumes from the last change.
- `Undo(action, asNew)`: takes an action back as a new one; undoing that is redo.
  Refuses what is already undone, what a later action changed again
  (`store.changed_since`), and what PSet has written over since
  (`store.rewritten_since`). Each change records its depth in a chain of undos
  (0 an action, 1 its undo, 2 the redo): even is in force. `Newest`, what Ctrl+Z
  takes, is the newest change in force not yet undone, so Ctrl+Z walks back and
  never toggles. A redone removal is stamped now, so its week starts again.
- `Purge(now)`: weekly. Removed things older than `Keep` (a week) go, unless a find
  or a set still uses a removed material; then the log older than that, and the log
  of whatever is gone.
