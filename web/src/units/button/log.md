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

## Settled afterwards (the coordinator, not asked)

The builder found the first plan broke the contrast floors, and these were settled:

- Hover and pressed on the solid grounds mix black in (8 and 14 percent), since mixing
  the text colour in took the white label below 4.5:1. Default and quiet mix the text
  colour in.
- A not-ready button has no hover or pressed fill, and keeps the default shape whatever
  its variant (muted text does not reach its contrast on a solid ground).
