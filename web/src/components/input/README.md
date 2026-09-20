# Input

The text controls: `Input`, `AutoTextarea`, `Field`.

The control border is `input`, deliberately darker than `border` — a
field has to look like something you can type into, and the hairline
that does elevation everywhere else is too quiet for that job.

**`Input`** is one line at `control` height, including
`type="date"`. The date picker is the browser's: it is the one control
in the app we don't draw, because a correct, keyboard-reachable,
locale-aware calendar is not worth rebuilding to match a palette.

**`AutoTextarea`** starts one line tall and grows to fit its content, so
a reference like "3.B.4" takes one line and a pasted statement takes
four. It never scrolls — its height follows the text. Growth is a height
assignment in an effect, not a transition: a field resizing under the
caret is not a state change to make legible.

**`Field`** is a real `<label>` wrapping a caption, the control, and an
optional hint, so the label text is part of the target.

**Don't:** put a placeholder where a label belongs; use `AutoTextarea`
for prose long enough to want its own scroll region.

## Changes from baseline

- **New in the app, not in the baseline**, which had no form controls.
- The native date input is a **deliberate exception** to "no control the
  browser styles". Recorded in `design/design-system.md`.
