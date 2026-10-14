# Button: log

The grill of 2026-10-13, word for word. Prior art: GitHub's Primer pages for Button,
Link, Label, IconButton and ProgressBar, read that day.

- Which variants exist? Primary, default, quiet (Recommended) / Add a solid danger
  button / Primary and default only. **Add a solid danger button.**
- How many sizes? **One, 32px (Recommended).**
- What happens while its action is running? **Spinner in the button, label stays,
  width kept (Recommended).**
- Can a button be disabled? **No: it stays pressable and says why (Recommended).**
- Icons? **An optional icon before the label (Recommended).**
- A busy button with no icon cannot keep its label in place, keep its width and show a
  spinner all at once. Which gives? The spinner replaces the label (Recommended) / A thin
  moving line, no spinner / As built: spinner squeezed before the label / Let the button
  grow. **"how does github do it?"**
- Do it GitHub's way? Yes, GitHub's way (Recommended) / A thin moving line, no spinner /
  As built. **Yes, GitHub's way (Recommended).**

Sources: https://primer.style/product/components/button/ and
`packages/react/src/Button/ButtonBase.module.css` in primer/react. The label keeps its
box with `visibility: hidden` and the spinner is drawn over it, so the size cannot change.

- A busy button with no icon cannot keep its label in place, keep its width and show a
  spinner all at once. Which gives? The spinner replaces the label (Recommended) / A thin
  moving line, no spinner / As built: spinner squeezed before the label / Let the button
  grow. **"how does github do it?"**
- Do it GitHub's way? Yes, GitHub's way (Recommended) / A thin moving line, no spinner /
  As built. **Yes, GitHub's way (Recommended).**

Sources for GitHub's way: https://primer.style/product/components/button/ and
`packages/react/src/Button/ButtonBase.module.css` in primer/react. The label keeps its
box with `visibility: hidden` and the spinner is drawn over it, so the size cannot change.

## The reason becomes a tooltip

- Jack, on trying the button: **"For the non disabled buttons, I don't love how the line
  that comes down looks, it being in a box and all. Also how does github manage that line
  if the button is in a spot where there is no space for it?"**
- How should a not-ready button say why? On the page, placed by the screen
  (Recommended) / A tooltip, as GitHub's optional one / The line under the button,
  without the box / Pressing opens a small dialog. **A tooltip, as GitHub's optional
  one.** See the tooltip unit. Sources: https://primer.style/product/components/button/guidelines

## Settled afterwards (the coordinator, not asked)

The builder found the first plan broke the contrast floors, and these were settled:

- Hover and pressed on the solid grounds mix black in (8 and 14 percent), since mixing
  the text colour in took the white label below 4.5:1. Default and quiet mix the text
  colour in.
- A not-ready button has no hover or pressed fill, and keeps the default shape whatever
  its variant (muted text does not reach its contrast on a solid ground).
