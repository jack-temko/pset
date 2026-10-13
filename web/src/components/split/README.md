# Split

Two panes side by side with the `ResizeHandle` on the seam: the shape of the
dock. The left pane is sized, the right takes the rest; the seam is the
hairline between them (the left pane's right border).

- **The ratio** is the left pane's share of the split's width, kept as a
  fraction so a layout set on a wide screen looks the same on a narrow one.
  It starts at half and is saved in this browser under the `id` the caller
  gives (the course), when a move ends.
- **Each pane stops at 360px** (`SPLIT_MIN` in `width.ts`, today's narrowest pane beside the page), and the
  seam does not move further. When the frame is narrower than two minimums,
  the left pane holds its minimum and the right takes what is left (the frame
  clips it); the seam sits still.
- **The seam** is the `ResizeHandle` as it is: drag, arrows (Shift for 64),
  Home and End to the limits, Enter or double-click for halves.
- **Each pane scrolls on its own.** The Split gives each a flex column of the
  full height and clips nothing itself; the content decides what scrolls.

`Split` takes `id`, `left`, `right`, optional `min`. It fills the height its
parent gives it.

**Don't:** nest a Split in a pane; add a toggle that collapses a pane (the
dock has no Focus: the seam is enough); resize without limits.

## Changes from baseline

- **New in the app** (2026-10-13), with the dock. The workspace still lays out
  its three panes itself (`lib/panes.ts`); it moves to this when the real
  workspace becomes the dock.
