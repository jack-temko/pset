# ImportRow

A book on its way to the shelf: its cloth colour, its title, one line of
what is happening, and the controls for exactly that state. A `BoxRow`
with a `CoverSwatch` leading, `BookStatus` as the description, and the
buttons trailing.

| state | line | controls |
|---|---|---|
| queued | Queued | Cancel |
| preparing | the phase, its count and a bar, or a spinner | Stop |
| failed | the engine's own sentence | **Try again** · Dismiss |

- **Stopping leaves a failed row** rather than removing it, so Try again
  is the undo and there is one shape for "not going to finish", not two.
- **Only Try again is outlined**: it is the one action here that starts
  work. Everything else is a ghost button.
- Rows live in **one Box above the shelf, which exists only while there
  is work.** Preparing first, then queued in order, then failed.

**What the caller provides:** the `book` and its handlers. The row never
decides what a handler does.

**Don't:** put an import row in the shelf grid; show a ready book in
one; add a control a state doesn't have.

## Changes from baseline

- **New in the app, not in the baseline.** The baseline showed import
  status under a dimmed cover on the shelf. That reserved caption space
  under every book, so a shelf of ready books looked gappy; the status
  moved here, where it has the full width.
