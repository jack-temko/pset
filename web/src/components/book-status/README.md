# BookStatus

What is happening to a book that isn't ready yet, as one line — or
nothing at all.

**Ready renders nothing.** Ready is the normal state, so anything this
component draws is worth reading. That is the whole point of it being a
component: the "say nothing" case is enforced in one place rather than
remembered at each call site.

- `queued` — the word "Queued", **and no spinner**: the runner prepares
  one book at a time, so nothing is happening to this one yet and a
  turning shape would claim otherwise for the next forty minutes.
- `preparing` — **the engine's own phase name**, so a student reads the
  same words the log does. A phase that can count counts ("Read the
  pages · 140 of 312") beside a 160px `primary` bar on a `muted` track,
  with the progress role and values for screen readers. A phase that
  can't — examining, building search — gets a `Spinner` and no bar.
- `failed` — the engine's sentence, in `destructive` ink.

It carries **no controls**: it is the description line of an
`ImportRow`, and the row owns Stop, Cancel, Try again and Dismiss.

`isReady(state)` ships alongside it.

**Don't:** add a "Ready" state; show it twice on one screen; put
controls in it.

## Changes from baseline

- **No "Ready" line.** The baseline's shelf tile shows a `success` check
  and the word "Ready" under every ready cover. The exception is the
  information; the normal case is silence.
- **`failed` and `queued` are states here**, and **phase names come from
  the engine** via `IMPORT_PHASES` — inventing friendlier words would put
  the UI and the log in disagreement about what the app is doing.
- **It no longer sits under a cover.** It was the caption of a not-ready
  shelf tile, which reserved space under every book; it is now one line
  in an import row. See `book-tile/README.md` for the comparison.
