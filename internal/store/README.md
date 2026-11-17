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
  (`store.rewritten_since`). `Newest` is what Ctrl+Z takes.
- `Purge(now)`: weekly. Removed things older than `Keep` (a week) go, unless a find
  or a set still uses a removed material; then the log older than that, and the log
  of whatever is gone.
