# Error notice: log

## Asked (2026-11-05)

Jack: "how do we show errors across the app? I definelty want an error component with
variants so all errors across the app look uniform."

Before it, the design units drew errors five ways: a red hint under a field, a red line with
a button in Ask, a red bordered box in Problem, a smaller one in Material for a damaged
file, and a page-filling red box in Material for a page that did not draw.

- Variants? Field, line, card, pane (Recommended) / Field, card, pane / Field and card only.
  **"The smallest subset that covers our use cases completley"**: line and block.
- Card look? **"Red icon + title, no border (Recommended)"**
- Details? **"Card and pane only (Recommended)"**
- Buttons when a fix comes first? **"Only the one that works (Recommended)"**

Prior art: PSet's own `ErrorNotice` in the old app (#34), which takes the catalog's View, and
GitHub Primer's inline messages.

## Redesigned (2026-11-05)

Jack, looking at the result: **"Don't love the look of the two variants of errors."**

What was wrong, seen in the Problem, Material, Settings and field contexts:

- Whole sentences in red. On the dark ground they vibrate, read worse than ink, and make a
  small failure look alarming.
- The block was bare text. Centred in an empty pane it looked unplaced, and in Problem its
  three fixes ran straight into the problem's own row of buttons, so the two rows read as one.
- The line's quiet action, wrapped onto its own line, read as stray white text.
- Details, a quiet button among the fixes, read as a fourth fix.

What changed (error-notice-d5 to d9):

- **Red marks, ink speaks** (d6). The one red is the mark: a circle with "!" (d7), 16px in a
  block and 14px in a line. What is in full ink, why and fix muted. A line is ink too; under a
  field, the field's red edge and the mark already say it failed.
- **A block is a quiet box** (d5): the border and 6px radius of the list and the help rows,
  on the raised ground, 16px inside, as wide as its place up to 560px. It keeps the error and
  its fixes together, apart from what is around it.
- **The line's action is outlined** (d8), as quiet-when-repeated asks of a single action, and
  wraps under the words with its edge on the mark's.
- **Details is a Fold** (d9) under the actions, so it reads as more to see; Copy in it is
  outlined.
- The pane example fills the stage instead of a fixed 560px, which the 480px stage clipped.

Revisited: d2's "no border". Jack's choice was between a red bordered box, a soft red ground
and no border; a neutral box was not on the table. The soft red ground stays out: muted text
on `danger-soft` falls under the 7:1 floor, so why and fix would have to be ink and the box
would be heavy. The red bordered box stays out: it is the Confirm's look, for a decision.

Prior art: GitHub Primer's Banner (critical: the icon coloured, the title and text in ink) and
InlineMessage; Atlassian's section message; macOS alerts (an icon, not red words); Radix
Themes' Callout (soft, surface and outline variants); Vercel Geist's Note and Error. Material,
Primer and Geist all draw an error as a round or stop sign and keep the triangle for a
warning.
