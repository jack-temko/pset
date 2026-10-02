# HomeworkStatus

How a homework row says when it is due and whether anything is wrong.

**The deadline is a fact, so it lives in the meta line.** `dueLine`
(`src/lib/due.ts`) renders it as the last clause of a row's description ("Linear Algebra
Done Right · 4 questions · due Friday") alongside the other quiet facts
about the set. A turned-in homework says "turned in Sep 12" instead.

**The status is a flag, so it gets the trailing slot alone.**
`HomeworkStatusLabel` renders one `Label`, or nothing:

| Status | Pill |
|---|---|
| `soon` | `warning`, clock icon, "Due soon" |
| `overdue` | `danger`, triangle icon, "Overdue" |
| `turned-in` | `success`, check icon, "Turned in" |
| none | nothing at all |

Most rows render nothing, which is the point: a pill that appears on
every row is wallpaper, not a flag, and the colour stops meaning
anything.

**The date arrives already relative and human** ("today", "Friday", "in
two weeks"). Neither export formats a date: whatever produced the list
knows the user's clock, and these do not. Never pass a raw timestamp.

**Don't:** invent a fourth status; put the date back in the trailing
slot; colour the meta line to match the pill.

## Changes from baseline

- **New**, and it exists because the same rule was about to be written
  twice (once on Home, once in the book panel) and the two would have
  drifted.
- It replaces a mono `RowValue` holding the date. Mono is for machine
  strings; "today" and "Friday" are words, and they read as a data dump
  in JetBrains Mono.
- **Two earlier takes were rejected by eye**, both rendered in place
  against real tokens: the date inside an outlined pill on every row
  (wallpaper), then a pill and a date side by side in the trailing slot
  (two things fighting for one column). Jack picked the version where
  the two separate entirely: deadline into the meta line, status alone
  on the right.

## Open

- The sample sets `status` by hand. Deriving it from a real due date is
  the backend's job: `soon` within a day or two, `overdue` past it.
