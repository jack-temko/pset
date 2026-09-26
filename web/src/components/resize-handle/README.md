# ResizeHandle

The seam between two panes, made draggable. The workspace has two: the
rail's right edge and the panel's left.

- **It takes no width.** It sits on the hairline the two panes already
  share, with a 16px strip across it to catch the pointer. The layout
  doesn't move when it arrives.
- **A grip says the edge moves**: a 4 × 32 pill in `input` at the
  seam's middle, always showing, so you can tell before you touch it.
  Hover, a drag or keyboard focus turn the grip and the hairline to
  `ring`, and the cursor is `col-resize`.
- **It sizes one pane**, the one on its `pane` side; dragging toward the
  other pane grows it. The caller gives the limits and it holds to them.
- **Keyboard**: a `separator` with its value and limits. Arrows step
  16px (Shift for 64), Home and End go to the limits, Enter puts the
  default back, as a double-click does.
- `onChange` fires as the edge moves; `onCommit` once when a move ends,
  which is when the caller saves.

**Don't:** put a visible bar or gutter between the panes (the hairline
is the seam); use it inside a pane; resize without limits.

## Changes from baseline

- **New in the app, not in the baseline.** It arrived when the
  workspace's panes became adjustable (2026-09-26).
