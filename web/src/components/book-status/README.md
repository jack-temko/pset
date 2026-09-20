# BookStatus

What is wrong with a book, or what is happening to it — or nothing at
all.

**Ready renders nothing.** Ready is the normal state, and a shelf of ready
books should be quiet — so anything this component draws is worth reading.
That is the whole point of it being a component: the "say nothing" case is
enforced in one place rather than remembered at each call site.

- `queued` — the word "Queued", muted, **and no spinner**: the runner
  prepares one book at a time, so nothing is happening to this one yet
  and a turning shape would claim otherwise for the next forty minutes.
- `preparing` — `warning` ink and **the engine's own phase name**, so a
  student reads the same words the log does. A phase that can count
  counts ("Read the pages · 140 of 312") over a thin `primary` bar on a
  `muted` track, with the progress role and values for screen readers. A
  phase that can't — examining, building search — gets a `Spinner`
  instead and no bar.
- `failed` — `destructive` ink, an alert icon, and the engine's sentence.

**The actions are optional and the caller owns them:** `onRetry` on a
failed book, `onDismiss` as Stop while it runs, Cancel while it waits,
and Dismiss once it has failed. They are quiet underlined text, not
Buttons — too small and too rare to compete with the cover above.

`isReady(state)` ships alongside it, because every caller that renders the
status also has to decide whether the thing is a link.

**What the caller provides:** the book's `state`, the two optional
handlers, and layout classes.

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

- **Phase names come from the engine**, via `IMPORT_PHASES`. Inventing
  friendlier words here would put the UI and the log in disagreement
  about what the app is doing.

## Open

- Nothing. Retry, Stop and Dismiss now live here, where the work is
  visible; the workspace readiness card the baseline put them in is not
  being built, because a book that isn't ready can't be opened at all.
