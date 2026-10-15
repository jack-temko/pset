# Brand

How the mark and the name appear.

**The mark** is `{P}`: Newsreader's P inside set-builder braces, drawn
from the font's outlines. It is a fixed-colour object: paper glyphs on a
`primary` tile, `rx` 7 on a 32 grid. It is never recolored for a theme,
which is why the hexes are inline rather than tokens, and it works on both
grounds unchanged. The file also ships as `public/pset-mark.svg` for the
favicon.

**The lockup** is the mark at `mark` (36px), `spacing-3`, then "PSet" in
the heading face at 600, `text-xl`. The braced wordmark `{PSet}` is for
outside the product (the gate page, Settings › About, the README) and
never inside the app.

**Voice:** always "PSet", never "PSET" or "Pset"; never possessive in UI
("Your books", not "PSet's books").

**Don't:** recolor, rotate, outline, or put the mark on another plate.
Minimum size in UI is 16px.

## Changes from baseline

- **The mark is 36px and the name `text-xl`**, in a 64px bar against
  24px icons opposite. The baseline's 28px mark and `text-lg` name
  dominated its 56px bar against 20px icons; when the bar grew with the
  type, the icons grew too, so the lockup could grow back without
  tipping the balance.
- The mark keeps its named token, `--spacing-mark`, rather than `size-9`:
  it is a brand measurement tuned against the bar, not a layout step.
- **The mark is inline SVG, not the `.svg` file.** Same artwork; inline so
  it scales with the lockup and costs no request. The file remains the
  favicon.

## Open

- The wordmark and the two alternate mark files (`-paper`, `-dark`) are in
  the design system's asset store but not yet in the repo. They arrive with
  the gate page and Settings › About, which are the only things that use
  them.
