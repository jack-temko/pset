# Spinner

The system's one looping animation, and the only thing permitted to
loop. A repeating motion means **"waiting"**, so nothing that isn't
waiting may borrow it — that rule predates this component and is why it
took until book import to earn one.

It is `currentColor` with a transparent top edge, so it inherits the ink
of whatever is speaking: `warning` in a preparing tile, `muted-foreground`
in a quiet row.

**Use it only where work is genuinely running and genuinely cannot be
counted** — examining a PDF, building a search index. Work that *can* be
counted gets a determinate bar instead: a number a student can watch is
worth more than a shape that turns, so the spinner is the fallback and
never the default.

**Don't:** use it for something merely queued (nothing is happening
yet — say so in words); use it as a skeleton for content that is
loading; put one next to a progress bar describing the same work.

`motion-reduce:animate-none` stops it flat, and the label carries the
meaning for anyone who can't see it turn.

## Changes from baseline

- **New in the app, not in the baseline**, and a deliberate exception to
  "nothing in the system loops". Recorded in `design/design-system.md`.
