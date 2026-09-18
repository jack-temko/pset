# BookCover

A book, drawn in CSS. There is no cover art anywhere in the product; every
book is a clothbound board in one of six hues.

Anatomy, in order: a 3:4 board with `radius-md` and a black/15 hairline,
filled with a 160° gradient from the hue's light value to its dark one; an
8px spine with a 1px white/20 groove; a soft top-left sheen, like a desk
lamp on cloth; a 4px white/20 page-edge strip inset on the right; and a
hairline white/15 plate holding an uppercase author line, the title in the
heading face clamped to three lines, a short rule and a small PSet stamp.

**The hue is derived, never chosen.** `coverHueFromSha` takes the first
byte of the sha256 modulo six. The same book is always the same colour, and
a seventh hue would break the shelf. The colours are the `--cover-*`
tokens — identical in both themes, because a book is an object rather than
a surface.

**What the caller provides:** `title`, `author`, the derived `hue`, and
layout classes only. The board is sized by its container and holds its
ratio; the plate type is fixed, so it belongs at a shelf tile's 160–200px
and should not be scaled far past it.

**Don't:** put an image behind it, tint it by subject, or scale the plate
type.

## Changes from baseline

- **Plate type sits at the 14px floor** — the author line, the stamp. This
  is the baseline's own correction to v1 (which used 8–10px here), carried
  through.
- **Colours come from `--cover-*` tokens**, not from literals in
  `lib/covers.ts` as in v1. That file now holds only the derivation, so
  there is one place the hues live.

## Open

- **The stamp reads `PSET`.** The BookCover baseline sets the stamp
  uppercase, while the Brand card says the name is always "PSet", never
  "PSET". The two disagree; this follows the more specific one, on the
  grounds that a letterspaced maker's mark is a typographic device rather
  than the name in prose. Worth settling.
- The shelf tile around the cover — the readiness line, the hover lift, the
  dimming of a book that isn't ready — lives in the page for now
  (`pages/home`). It moves here, or into its own component, when a second
  screen needs a shelf.
