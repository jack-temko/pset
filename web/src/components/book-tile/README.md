# BookTile

A book on a shelf: the cover, wrapped in a link to the book. Hovering
lifts it 4px with `shadow-lift`, the one lift in the system, over 150ms
ease-out. No caption: the cover's plate already carries the title and
author, so a line under it would only repeat them.

**The shelf only ever holds books you can open**, so a tile has exactly
one state. A book that is queued, preparing or failed is an `ImportRow`
in a Box above the shelf instead.

**What the caller provides:** the `book`. The grid around it owns the
column count and gaps; the tile sizes itself to its cell.

**Don't:** add a caption under a cover; put a book that isn't ready on
the shelf.

## Changes from baseline

- **No "Ready" caption.** The baseline's shelf tile puts a `success` check
  and the word "Ready" under every ready cover. Across a shelf that is the
  same green line repeated under every book, saying what the absence of a
  warning already says. The exception is the information.
- **The due chip is not built.** The baseline shows an assignment's due chip
  on the tile; Home already lists what's due above the shelf, so repeating
  it on the covers is unresolved rather than implemented.

- **No not-ready tile.** It had one (a dimmed cover with its status
  and controls underneath) and it was rejected on sight. The captions
  had to be reserved or the row jumped, and reserved space made a shelf
  of ready books look gappy for the sake of a state it usually isn't in.
  Three other treatments were compared against it (a card over the
  cover, a badge with a popover, a one-line summary that opens down);
  the separate Box won because it needed no new parts and gave the
  engine's sentence and the controls full width.

## Open

- The lift's `transition` was dropped once while promoting this out of
  `pages/home`, and the cover snapped instead of rising. Tailwind v4 moves
  the translate to the standalone `translate` property, so a computed
  `transform` reads `none` either way; check `translate` when verifying
  this.
- Promoted here from `pages/home` the moment the components page needed it
  too. If a third surface wants a shelf, the grid around the tiles should
  probably come with it.
