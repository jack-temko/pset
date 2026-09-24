# Menu

An overflow menu: the actions a bar has room to name but not to show. A
ghost "⋯" `IconButton` opens a floating card of rows beneath it,
right-aligned to the trigger.

- **The card** is `card` with a hairline border and `shadow-floating`,
  radius-md. It genuinely floats, so it gets the shadow. **It has no
  padding and the divider no margin:** every pixel belongs to a row, so a
  hover wash runs right to the card's edge and the divider. (With 4px of
  padding the wash stopped short of the boundary, and those strips were
  dead to the pointer.)
- **`MenuItem`**: a 32px row, a muted 16px icon, the label in `text-sm`.
  It runs, then the menu closes. An optional **hint** sits at the row's
  end in muted `text-xs`: a short fact worth knowing before you choose
  it, like Print worksheet's "3 still being found". It says, it never
  disables: the item still runs.
- **`MenuCheckItem`**: a fact you can take back, like Turned in. A
  primary check sits in the icon column when it's true, so labels stay
  aligned either way.
- **`MenuDivider`**: a `border-muted` hairline, for setting a state
  apart from the actions above it.

It closes on Esc, on any press outside it, and after an item runs, and
focus returns to the trigger. Opening focuses the first item; arrow keys
move through them. It portals to the body with fixed positioning, like
the Tooltip, so no scrolling pane can clip it.

**Don't:** put the one action a bar is *for* in a menu (the menu is for
the rest); nest menus; put a form or anything that needs typing in one
(that's a dialog).

## Changes from baseline

- **New in the app.** It was deferred once ("inline buttons until it's
  proven") and arrived when the walkthrough header filled up with Add
  questions, Edit, Print and Turned in beside the set's title.
