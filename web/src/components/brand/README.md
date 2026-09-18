# Brand

How the mark and the name appear.

**The mark** is `{P}` — Newsreader's P inside set-builder braces, drawn
from the font's outlines. It is a fixed-colour object: paper glyphs on a
`primary` tile, `rx` 7 on a 32 grid. It is never recolored for a theme,
which is why the hexes are inline rather than tokens, and it works on both
grounds unchanged. The file also ships as `public/pset-mark.svg` for the
favicon.

**The lockup** is the mark at `mark` (30px), `spacing-2`, then "PSet" in
the heading face at 600, `text-base`. The braced wordmark `{PSet}` is for
outside the product — the gate page, Settings › About, the README — and
never inside the app.

**Voice:** always "PSet", never "PSET" or "Pset"; never possessive in UI
("Your books", not "PSet's books").

**Don't:** recolor, rotate, outline, or put the mark on another plate.
Minimum size in UI is 16px.

## Changes from baseline

- **The mark is 30px and the name `text-base`**, against the baseline's
  28px and `text-lg`. At the baseline proportions the lockup dominated a
  56px bar against 20px icons opposite. The name coming down to 16px was
  the fix that mattered; the mark then settled a touch above 28.
- `30px` is off the 4px grid, so it is the named token `--spacing-mark`
  rather than an arbitrary value — a brand measurement, not a layout step.
- **The mark is inline SVG, not the `.svg` file.** Same artwork; inline so
  it scales with the lockup and costs no request. The file remains the
  favicon.

## Open

- The wordmark and the two alternate mark files (`-paper`, `-dark`) are in
  the design system's asset store but not yet in the repo. They arrive with
  the gate page and Settings › About, which are the only things that use
  them.
