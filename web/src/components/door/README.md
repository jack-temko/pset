# Door

The way through truncated content, the same everywhere, because nothing
in a document page scrolls by itself. A full-width quiet row at the bottom
of the thing it extends: "Show all 9 ▾" opens in place, "Show fewer ▴"
closes.

- **In a Box**: the last row, above a `border-muted` hairline (the caller
  adds the border, since the door doesn't know where it sits).
- **Under a grid**: the row after the shelf's covers, no border.

The row is `h-row` (40px) of quiet space; the button inside it is a 28px
pill: `text-xs` in `muted-foreground`, the hover wash (`muted/50`, 150ms)
with the text stepping up to `foreground`. Wash and click target are the
same shape: a full-width target that highlights only its middle lies about
where it is. Announces itself with `aria-expanded`.

**What the consumer provides:** `open`, `total`, `onToggle`. The door
names what it opens onto: the count is the whole list, not the hidden
remainder.

**Don't:** use it for navigation (it expands in place); put it anywhere
but the bottom edge of what it truncates; pair it with an inner scrollbar.

## Changes from baseline

- The baseline has no door; its Box previews end in a passive footer
  ("Showing 3 of 9"). The design system's no-inner-scroll rule needs the
  truncation to open, so the footer became this row. Introduced when Jack
  asked for Homework's "show more" to work the same way across the whole
  frontend.

## Open

- Whether a very long opened list (dozens of homeworks, someday) needs the
  door to also collapse from the top, or pagination. Not until real data
  makes it real.
