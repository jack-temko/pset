# StatTile

A dashboard number: a label, a big serif value, and one quiet line of
context. Home's "This week" region is four of them in a row: time on
homework (`chart-1`), reading (`chart-2`), asking (`chart-3`), and
questions worked, which carries a stacked bar showing the split by
activity.

- **Frame**: `card` fill, hairline border, `radius-md`, 16×20 interior.
  Card-shaped but not a Box: it has no parts, and nothing else ever goes
  inside one: the by-book split bar lives under the tile row on Home,
  full width, its splits in cover hues and named in a legend.
- **Label**: `text-xs` in `muted-foreground`, with a `size-2` dot in the
  activity's chart colour when the tile is an activity.
- **Value**: `text-2xl` in JetBrains Mono at 400, tabular figures. Unit
  letters go in `<small>` and drop to `text-xs` in `muted-foreground` so
  the figures carry ("4h 23m"). `DurationValue` renders minutes that way.
- **Context**: `text-xs` at 400 in `muted-foreground`.

**Voice.** The context line says what the number is ("so far this week",
"across 3 problem sets"). It never sets a target, shows a delta against
last week, or counts a streak. The dashboard reports, it does not nag.
An empty week shows "0m" (or "0" for a count) and "nothing yet this week".

**Don't:** add an icon per tile, animate the number, colour the value, or
put more than four in a row.

## Changes from baseline

- **The value is mono, not serif.** The baseline sets it in the heading
  face at 30px; Jack compared four treatments and picked JetBrains Mono,
  which is also what the system's own type rule says: counts, durations
  and page numbers are machine strings. `text-2xl` keeps the size on the
  nine-step scale (the mock's 26px is not a step).

- **The stacked bar is 4px (`h-1`), not 6px.** The spacing scale is
  integer 4px steps and 6px is off the grid; BookStatus's progress bar is
  already `h-1`, so every thin bar in the product now matches.
- **The context line resets to weight 400.** `text-xs` bakes 500
  system-wide (labels, badges); the baseline sets this one line at 400,
  and it is right: at 500 the context competed with the label.
- **`DurationValue` is exported here.** The baseline says "value, already
  formatted"; the `<small>` unit markup is the tile's own convention, so
  the formatter that produces it lives beside the tile rather than in
  every caller.

## Open

- The tiles render sample numbers. Real values arrive with Home's backend
  pass: the sessions table and the focus-aware timer.
