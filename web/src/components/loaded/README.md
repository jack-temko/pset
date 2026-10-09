# Loaded

The one way anything that waits on data is drawn: a skeleton that holds the content's
space, a 150ms fade when the content arrives, and one line when it doesn't. Used by the
usage dialogs; every other screen follows (design-system.md, Motion).

- **Pending:** the `skeleton` renders at once, so its space is held from the first frame.
  For the first 300ms (`GRACE_MS`) it is `invisible` (still in layout), so a quick answer
  never blinks; after that it shimmers. The element carries `aria-busy`.
- **Data:** `children(data)` renders in the same element. If the box ever waited, it gets
  the `fade-in` utility (opacity only, 150ms, ease-out, none under reduced motion). Data
  that was already cached at the first render appears at once.
- **Morph:** when the content's height is more than 2px off the skeleton's, the box's height
  eases from one to the other over 200ms (ease-out) while the skeleton fades out and the
  content fades in. Equal heights, cached data and reduced motion skip it (reduced motion
  skips the fade too).
- **Error:** one line of muted destructive text. It is not the skeleton's size.

**The skeleton contract:** the same layout and size as the content: the same grid, the same
table header, the same row count (`useLastCount` gives a list's last known count, 3 the first
time). If the skeleton is the wrong height, the box jumps when the data lands, which is what
this component exists to prevent.

The morph is a safety net, not a licence: a skeleton off by more than 2px still fails the
jump check in CI, and should be fixed.

**What the caller provides:** the `query` (a TanStack query result), the `skeleton`, a render
function for the data, and the `className` of the layout both share.

**Don't:** put a spinner inside it; fetch in the render function; use it for a wait that
shows data from a prop; fade content that was cached.
