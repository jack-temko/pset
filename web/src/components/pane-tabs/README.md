# PaneTabs

The tabs of one pane of the dock, and the header of the pane that has none.

**`PaneTabs`** takes the tabs (`id`, `kind`, `title`, `icon`), the id shown,
`onSelect`, `onClose` and an `end` slot.

- **One tab per thing**: the kind's glyph, the title, a close. The shown tab is
  marked like `UnderlineNav`'s (a 2px `primary` underline, the title at 500 in
  `foreground`, the pane's own ground behind it); the others are muted and
  wash on hover.
- **Closing is one click**, on the tab's own X (28px, inside a 40px strip), or
  Delete on a focused tab. Focus then moves to the tab now shown, or to the +
  when none is left, never to the page. Every tab is a tab stop; only the
  hidden tabs' X is skipped, so ten tabs are not twenty stops.
- **Many tabs.** Tabs share the strip's width between a floor of 144px and a
  ceiling of 240px and cut their titles short; the full "Kind: title" is the
  Tooltip (the tab's own name stays its title). Below the floor the strip
  scrolls sideways and brings the shown tab into view; the scrollbar is hidden,
  the tabs are the way.
- **Focus** is the system's one ring, drawn inside the tab so the strip does not
  clip it.
- **A group, not a tablist.** The strip is `role="group"` and the shown tab
  `aria-current`, as `UnderlineNav` does: a tablist's tabs may hold no button,
  and each tab here holds a close.
- **The end slot** is pinned beside the strip, so the + that opens something
  else never scrolls away.
- It draws a `bg-rail` strip 40px tall (`h-row`) with a hairline beneath.

**`PaneHeader`** is the strip of a pane locked to one thing: the glyph, the
kind in muted ink and the title, the same height as `PaneTabs` so the two
panes' hairlines are one line across the dock. It has no X: that pane cannot
be closed.

**Don't:** use for navigation between pages (tabs hold things, not places);
put an action in the end slot that is not "open something"; reorder or drag
tabs (the dock does not rearrange yet).

## Changes from baseline

- **New in the app** (2026-10-13), with the dock. `UnderlineNav` stays the
  tabs of the workspace's side pane (Ask | Homework): it has no close, no kind and
  does not shrink, so it was left alone.
