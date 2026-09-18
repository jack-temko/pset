# BookStatus

What is wrong with a book, or nothing at all.

**Ready renders nothing.** Ready is the normal state, and a shelf of ready
books should be quiet — so anything this component draws is worth reading.
That is the whole point of it being a component: the "say nothing" case is
enforced in one place rather than remembered at each call site.

- `preparing` — `warning` ink, "Preparing · 140 of 312", and a thin
  `primary` bar over a `muted` track, with the progress role and values on
  it for screen readers.
- `failed` — `destructive` ink, an alert icon, and the reason.

`isReady(state)` ships alongside it, because every caller that renders the
status also has to decide whether the thing is a link.

**What the caller provides:** the book's `state`, and layout classes only.

**Don't:** add a "Ready" state here; show the status twice on one screen;
use it for task progress generally — it is about a book's usability, not
about work in flight.

## Changes from baseline

- **No "Ready" line.** The baseline's shelf tile shows a `success` check
  and the word "Ready" under every ready cover. In practice that was four
  identical green lines saying the same thing, and the old library page's
  own rule was that a book is Ready or Not ready with nothing in between to
  label. The exception is the information; the normal case is silence.
- **`failed` is a state here.** The baseline covers failure in the book
  workspace's readiness card but not on the shelf, which left a failed book
  looking like a preparing one that had stalled.

## Open

- The retry and remove actions that belong with a failed book live in the
  workspace's readiness card, which isn't built. Here the reason is
  read-only.
