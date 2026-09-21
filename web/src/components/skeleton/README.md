# Skeleton

The shape of content that hasn't arrived yet, at the size it will be, so
nothing moves when it does: a `muted` block with a soft band of lighter
ink sweeping across it.

- **It shimmers**, one of the system's two loops (the Spinner is the
  other), and it means what they both mean: waiting. The band is `muted`
  mixed toward `card`, so it follows the theme. It's the `skeleton`
  utility in `index.css`, 1.6s ease-in-out; reduced motion leaves the
  block still.
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
- It started still, on the reading that only the Spinner may loop. Jack
  asked for the shimmer: a loading block is exactly the "waiting" that a
  loop is allowed to mean, and a still one read as a broken layout. (The
  Veil rejected a shimmer for the opposite reason: veiled content isn't
  loading, so it mustn't look like it.)
