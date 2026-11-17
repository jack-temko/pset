# Tooltip

A short label that explains a target: on hover after 300ms, on keyboard
focus at once. `foreground` ground and `background` text, so it inverts
with the theme and reads as ink on paper turned over. 15px, the floor.

- **A description, never the name.** The target keeps its own label and
  the tooltip is wired with `aria-describedby`, so nothing that matters
  may live only in a tooltip. Its first job is exactly that kind of
  aside: the PDF page behind a printed page number.
- **It appears; it doesn't travel.** Opacity only, 150ms, like every
  other state change.
- `side="left"` for targets pinned to a pane's right edge (the rail's
  page numbers), where a label centred above would be clipped.

**Don't:** put a control or a link in one; use it to name an icon button
(that's `aria-label`, and it must stand alone); put more than a few
words in it.

## Changes from baseline

- **New in the app, not in the baseline.** It arrived with printed page
  numbers, when "which page is this in the PDF" needed an answer that
  shouldn't sit on screen all the time.
