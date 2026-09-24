# ConfirmPopover

How every delete asks first: a small floating card under the control that
was pressed, not a dialog in the middle of the screen. The pointer and the
eye are already there.

- **The card** is the Menu's: `card`, hairline border, `shadow-floating`,
  radius-md, 320px (`w-80`), right-aligned to the control. It sits
  **under** the control, or **over** it when there isn't room below (Reset,
  at the foot of Settings), and never past the window's edge.
- **One sentence** says what goes: the question in the ink ("Remove
  3.A.4?"), what goes with it muted ("Its guide and your progress on it go
  with it."). Where what *stays* is the real question, it says that too
  (Clear keeps what the tutor remembers).
- **Cancel, then the act**, right-aligned, both `sm`. The act is named on
  a `destructive` button ("Remove book", not "OK"). **Focus lands on
  Cancel**, so Enter is the safe key, and the act is never drawn under the
  pointer that asked, so a double click can't confirm.
- **`busy`** is for an act that takes a while and stays open while it
  runs: the act's label meanwhile ("Resetting…"), both buttons waiting,
  nothing cancelling it. **`error`** says why it failed, in destructive
  ink under the sentence.

**It is the top layer.** Esc closes it and nothing else: it listens in the
capture phase and stops the event there, so a Menu it came from stays
open. A press anywhere else cancels it too. Cancel and Esc hand focus back
to the control; a press elsewhere leaves focus where you put it.

It portals to the body with fixed positioning, so no scrolling pane can
clip it. Like the Menu, it doesn't follow its control if the page scrolls
under it.

**From a menu**, use `MenuConfirmItem` (in `menu/`), which opens one under
its row and keeps the menu open.

**Don't:** use it for anything reversible (that needs no asking); put a
form in it (that's a dialog); open it from a dialog (dialogs never nest,
and a dialog's delete belongs in the thing's menu, not the dialog).

## Changes from baseline

- **New in the app** (2026-09-24). Deletes used to confirm three ways: the
  edit dialogs turned into the question, Ask's Clear swapped its line for
  "Clear this conversation? Clear · Keep" (the red act landing under the
  pointer), and Reset opened its own dialog; removing a question didn't
  ask at all. A row that turned into the question was tried beside this
  and not chosen.
