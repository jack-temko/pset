# Progress bar: log

The grill of 2026-10-13, word for word. Prior art: Primer's ProgressBar page ("Default
to pairing the ProgressBar with text that explicitly shows the value(s)").

- Progress bar: how does it show how far a set is done? A segment per problem, with
  '2 of 6' beside it (Recommended) / One continuous bar, with the count / Just the
  count, no bar. **A segment per problem, with '2 of 6' beside it (Recommended).**

## Settled afterwards (the plan, not asked)

Above 12 problems it is one continuous bar, 72 wide; a finished set draws grey
(`fg-muted`), not blue.

## When narrow (2026-10-14)

- When a set line is narrow, what gives way? You decided the count '2 of 6' always
  shows beside the bar. Keep the count, shrink the bar (Recommended) / Hide the count
  when narrow / Drop the bar, keep the count. **Keep the count, shrink the bar
  (Recommended).**

So the bar measures its own width: segments narrow from 12px to 4px, then one
continuous bar takes over, and the count never gives way. The set line no longer
hides the count.

## Round of 2026-10-14, annotations

Jack, on the bars in a course list: **"The progress bars need to be longer."**, and on
the "0 of 6" beside one: **"This needs to be larger"**.

Two defects were hiding under this. The segments' 2px gap was set in a fractional step
the theme's lockdown does not compile, so the dashes touched and the bar read as one
solid stripe; the gap is back, as an explicit 2px. And the continuous bar held a fixed
72px, leaving the slack of its aside unused; it is now fluid, filling the room the
count leaves, from 16 up, so a longer bar is exactly as long as its aside allows. The
count goes up one type step, from small to body, in the bar itself, so the course row
and the set line both get it.
