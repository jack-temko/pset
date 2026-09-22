# Dialog

The system's one modal, and its first. A native `<dialog>` opened with
`showModal()`, which is where Esc, the focus trap and the inertness of
everything behind it come from, without a library and without a bug of
our own.

**Two widths, and there are only two:** `default` 400 for a form of a
couple of fields, `wide` 560 for a stack of rows you read back. Both are
tokens (`--spacing-dialog`, `--spacing-dialog-wide`), not arbitrary
values.

**Three parts, always in this order:** a header carrying the title, the
body, and a footer band on `card-header` with Cancel and the one primary
action right-aligned. The primary counts what it will do where a count
exists: "Add 4 questions", not "Add questions".

**One way out, and it is Cancel.** There is no X in the corner: two
controls doing the same job in two places is one too many, and the
footer's Cancel sits where the decision is being made, beside the action
it undoes. The footer is required for exactly that reason: a dialog
without one would have no way out but Esc.

**The scrim is a signal, not a control.** A backdrop click does not
close: native `<dialog>` doesn't close on one, which is exactly what this
system wants, because a dialog holding half a pasted assignment must not
vanish to a stray click. You leave through Cancel or Esc.

The scrim is `foreground/25` with a 2px backdrop blur.

**The body is the app's one sanctioned vertical inner scroll.** The
dialog caps at 80vh, the header and footer are `shrink-0`, and the body
takes what is left. A dialog is its own screen, and the primary action
has to stay reachable however many rows the body grows.

**Don't:** nest a dialog in a dialog; put a scrolling region inside the
body; use it for a menu or a popover (neither exists yet, and neither is
this); open one without a title; add a second way to dismiss it.

## Changes from baseline

- **New in the app, not in the baseline.** It arrived with homework
  creation.
- **The scrim carries a slight backdrop blur**, which the Veil's notes
  argued against reusing. The distinction that makes both true: the Veil
  blurs *content you could read*, to say "not yet"; the scrim blurs a
  *whole screen you are no longer on*, to say "not here". They never
  appear in the same layer.
- **A native `<dialog>`, not a React portal.** Rejected the portal
  approach because Esc, focus containment and background inertness are
  three chances to get it subtly wrong, and the platform already has
  them right.
- **A dialog that saves as you go has one button, Done** (the Memory
  dialog, where each add and delete is immediate). Cancel would promise
  an undo there isn't, so Done is the way out and the primary at once.

## Open

- The header is title-only, so it has no slot for an action. Nothing has
  wanted one.
- No `dismissible` variant yet: everything the app has is a form worth
  protecting. A confirm dense enough to want backdrop-click can add one.
- Nothing here animates. If an entrance is ever wanted it must be an
  opacity change at 150ms, like everything else.
