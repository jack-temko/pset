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
