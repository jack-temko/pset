# BookTile

A book on a shelf: `BookCover` plus `BookStatus`, and the rule about which
of them is a link.

- **Ready** — the cover alone, wrapped in a link to the book. Hovering
  lifts it 4px with `shadow-lift`, the one lift in the system. No caption:
  the cover's plate already carries the title and author, so a line under it
  would only repeat them.
- **Not ready** — the cover at 60% opacity, not a link, with `BookStatus`
  under it saying why.

**What the caller provides:** the `book`. The grid around it owns the
column count and gaps; the tile sizes itself to its cell.

**Don't:** add a caption under a ready cover; make a not-ready book
clickable; put the status anywhere but under the cover.

## Changes from baseline

- **No "Ready" caption.** The baseline's shelf tile puts a `success` check
  and the word "Ready" under every ready cover. Across a shelf that is the
  same green line repeated under every book, saying what the absence of a
  warning already says. The exception is the information.
- **The due chip is not built.** The baseline shows an assignment's due chip
  on the tile; Home already lists what's due above the shelf, so repeating
  it on the covers is unresolved rather than implemented.

## Open

- Promoted here from `pages/home` the moment the components page needed it
  too. If a third surface wants a shelf, the grid around the tiles should
  probably come with it.
