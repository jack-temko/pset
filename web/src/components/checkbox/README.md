# Checkbox

A labelled checkbox for a state that must be as easy to take back as to
claim: a question marked **Complete**, a row marked **In this book**.

It is a checkbox and not a switch on purpose. A switch reads as a mode
you enter; a checkbox reads as a fact you record, and both of these are
facts. The system has no switch and does not need one.

- The whole control is the target: the box, the label, and the space
  between. A 16px box alone is not a target.
- Checked is `primary` fill with the check in `primary-foreground`;
  unchecked is `border-input` on `card`, the same border every field
  uses, because both are things you act on.
- `disabled` dims to 50% and drops pointer events, matching Button.

**Don't:** use it to trigger an action (that's a Button); use it for a
one-of-many choice; hide its label.

## Changes from baseline

- **New in the app, not in the baseline.** It is the Complete control
  that already lived inline in the walkthrough, lifted out when the
  add-questions dialog needed the same shape per row.
- Rejected a **Switch primitive** for "In this book": a switch implies a
  mode with consequences elsewhere, where this is one field of one row.
