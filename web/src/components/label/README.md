# Label

The small pill that names a kind or a state in a word or two: "Turned
in", "Due today", "Scanned".

24px tall, `radius-full`, a 1px border, `text-xs` at 500, `spacing-2`
padding, an optional `size-3` icon. **Outlined by default**: the border
and the text share one ink, so a Label reads as a quiet outline rather
than a block of colour.

| Tone | Use |
|---|---|
| `default` | A kind: Digital, Scanned. Quiet ink. |
| `primary` | Due within the week, the page anchor. |
| `success` | Turned in, Ready, passing. |
| `warning` | Due today, usable with warnings. |
| `danger` | Overdue, failed. |

`filled` adds the tone's soft tint as ground, for the one state in a
list that must jump out ("Needs you"), never as a default.

**A status Label always carries a word.** Colour alone never means
anything. Add the icon where the row is scanned rather than read.

**Composition.** Labels sit inline after a title or in a row's trailing
slot, at most two per row. A Label is never clickable.

**Don't:** use one as a filter chip (that's a SegmentedControl); fill it
by default; invent a sixth ink.

## Changes from baseline

- **24px tall with 14px text**, not the baseline's 20px with 12px. The
  system's type floor is 14px and the baseline's own Label spec is the
  one place it breaks its floor: the floor wins, as it did for the
  Counter, and the pill grows a step to hold the larger text.
- **`filled` works for every tone**, not just danger. The tints all
  exist; restricting the mechanic to one tone would have meant a
  one-off later.

## Open

- The baseline's mono variant (page numbers as a Label) is not built;
  `PageRef` in the transcript covers that job with jump behaviour.
