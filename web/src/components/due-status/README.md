# DueStatus

A homework's deadline in a row's trailing slot: the date always as
words, and a status pill only when there is a status.

The two carry different jobs, and separating them is the point.

- **The date is a fact you read** — "today", "Friday", "next Monday",
  "in two weeks" — in `text-xs` muted ink, and it is **always** there.
  A row never makes you guess when something is due.
- **The status is a flag you scan**, a `Label` to the date's left. It
  earns its colour by being rare: most rows have no pill at all.

| Status | Pill |
|---|---|
| `soon` | `warning`, clock icon, "Due soon" |
| `overdue` | `danger`, triangle icon, "Overdue" |
| `turned-in` | `success`, check icon, "Turned in" |
| none | nothing — just the date |

**The date arrives already relative and human.** This component never
formats one: whatever produces the list knows the user's clock, and it
does not. Never pass a raw timestamp.

**Don't:** invent a fourth status; drop the date when there is a pill;
use it outside a homework row.

## Changes from baseline

- **New.** It exists because the same rule was about to be written
  twice — once on Home, once in the book panel — and the two would have
  drifted.
- It replaces a mono `RowValue`. Mono is for machine strings; "today"
  and "Friday" are words, and they read as a data dump in JetBrains
  Mono.
- **An earlier take put the date inside the pill** ("Due Friday" as an
  outlined Label on every row). Jack's correction: a pill on every row
  is not a flag, it is wallpaper — the date belongs as text, the badge
  belongs to status alone. That also freed the ink to mean something,
  since the only coloured pills left are the ones that matter.

## Open

- The sample sets `status` by hand. Deriving it from a real due date is
  the backend's job: `soon` within a day or two, `overdue` past it.
