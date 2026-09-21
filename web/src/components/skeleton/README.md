# Skeleton

The shape of content that hasn't arrived yet, at the size it will be, so
nothing moves when it does. A `muted` block and nothing else.

- **It holds space; it doesn't animate.** No pulse, no shimmer. The
  system allows one loop (the Spinner) because a repeating motion means
  "waiting", and a page of pulsing blocks would say it a dozen times at
  once. A skeleton that stays still still does its whole job.
- **Inline by default**, so a text-sized skeleton sits inside a real line
  box and the row keeps its real height: a skeleton row and the row that
  replaces it measure the same.
- **Draw what's coming, as many as are coming.** When the count is known
  (Health always has four checks), draw that many. When it isn't, draw a
  typical amount and accept a small settle.

**Don't:** use it for work in progress (that's a Spinner or a bar); use
it for something that loads faster than you can see; show a skeleton and
a spinner for the same thing.

## Changes from baseline

- **New in the app, not in the baseline.** It arrived when the Health
  checks visibly jumped from one "Checking…" row to four.
- The baseline's skeletons used `muted` too; this one drops their pulse,
  for the reason above.
