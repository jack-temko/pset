# Menu

An overflow menu: the actions a bar has room to name but not to show. A
ghost "⋯" `IconButton` opens a floating card of rows beneath it,
right-aligned to the trigger.

- **The card** is `card` with a hairline border and `shadow-floating`, **radius-lg** (a large
  floating surface) and a 256px minimum width. **It has no padding and the divider no margin:**
  every pixel belongs to a row, so a hover wash runs right to the card's edge (the card clips
  the first and last wash to its radius). It eases in over 200ms (a fade and settle from its
  trigger's corner, none under reduced motion) and scrolls inside itself when it is taller than
  the room below.
- **Attached to its trigger.** The card sits flush under the trigger, one pixel up so their
  borders are one line. While it is open the trigger takes a border and the card's fill, with its
  bottom corners squared, and the card's matching top corner is squared too: together they read
  as one shape opening, whether the trigger is a "⋯" or a count.
- **One at a time.** Opening a menu closes any other that is open, whether it was opened by a press
  or from the keyboard, so menus never stack. A page can have a set menu, a question menu and a
  question list, and only one shows.
- **The trigger** is a ghost "⋯" `IconButton` by default, right-aligned to the card. Give it a
  `trigger` (a count, a name; a chevron is added and turns as it opens) and it becomes a small
  ghost `Button` and the card lines up with its left edge. `align` overrides either.
- **`MenuItem`**: a 40px row (`row`), a muted 16px icon, the label in `text-sm`, washed `muted`
  on hover and focus. It runs, then the menu closes. An optional **hint** sits at the row's end in muted `text-xs`: a short fact worth
  knowing before you choose it, like Print worksheet's "3 still being found" or a question's
  "Done". It says, it never disables. **`current`** marks the row you are on in a list of places:
  tinted `primary-soft` and outlined by a thin inset ring at 70% primary (the tint alone measures 1.16:1 against the
  card, under the 1.3:1 floor for a fill that carries shape; the ring measures 4.1 / 3.8:1, Night / Paper), and it is where opening the menu
  puts focus.
- **`MenuCheckItem`**: a fact you can take back, like Turned in. A
  primary check sits in the icon column when it's true, so labels stay
  aligned either way.
- **`MenuConfirmItem`**: the destructive act, last, below a divider:
  the row in destructive ink, icon included. Choosing it asks first in a
  **ConfirmPopover** under the row, and the menu **stays open** behind
  it: a press inside the popover isn't "outside" the menu, and its Esc
  is caught before the menu's. Cancel or Esc lands you back on the row;
  only the act closes the menu.
- **`MenuDivider`**: a `border-muted` hairline, for setting a state
  apart from the actions above it, and the destructive act from the
  rest.

It closes on Esc, on any press outside it, and after an item runs, and
focus returns to the trigger. Opening focuses the `current` item, else the
first; arrow keys move through them, Home and End jump. It portals to the body with fixed positioning, like
the Tooltip, so no scrolling pane can clip it.

**Don't:** put the one action a bar is *for* in a menu (the menu is for
the rest); nest menus; put a form or anything that needs typing in one
(that's a dialog).

## Changes from baseline

- **Redesigned** (2026-09-30, Jack, in the homework redesign): "slightly more modern and larger",
  the same in every dropdown, after an A/B of three hovers and three attachments. Rows went from
  32px to 40px, the minimum width from 192px to 256px, and the card from radius-md to radius-lg
  and attached flush to its trigger. The earlier "no padding" rule stays: an inset, rounded pill
  was tried and Jack wanted the wash to fill the whole row to the card's edge. Measured (Night /
  Paper): hover wash against the card 1.50 / 1.43:1, label text on it 9.4 / 11.3:1, hint text
  4.75 / 4.56:1, the card's border against the panel ground 1.43 / 1.30:1.
- **A labelled trigger, a `current` row and one-at-a-time** arrived with the homework header's
  question list, which had to be this same menu and not a look-alike.

- **New in the app.** It was deferred once ("inline buttons until it's
  proven") and arrived when the walkthrough header filled up with Add
  questions, Edit, Print and Turned in beside the set's title.
- **`MenuConfirmItem`** (2026-09-24) arrived with "one menu per thing":
  the book's menu and the homework set's both end with their delete.
