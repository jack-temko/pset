# Loaded

The one way anything that waits on data is drawn: a skeleton that holds the content's
space, a 150ms fade when the content arrives, and one line when it doesn't. Used by the
usage dialogs; every other screen follows (design-system.md, Motion).

- **Pending:** the `skeleton` renders at once in a layer, so its space is held from the first
  frame. For the first 300ms (`GRACE_MS`) it is transparent (still in layout), so a quick
  answer never blinks; then it fades in over 150ms and shimmers. The wrapper carries
  `aria-busy`.
- **Data:** `children(data)` renders in the content element. Data that lands inside the
  grace, or was cached at the first render, appears at once: no skeleton, no fade. Data that
  lands after the skeleton showed crossfades: skeleton and content share one grid cell, the
  content fades 0 to 1 over 150ms on top while the skeleton fades 1 to 0 underneath, then the
  skeleton unmounts. At no frame is neither drawn. Reduced motion swaps instantly.
- **The tree never changes shape:** one wrapper, one content element, the skeleton a layer
  that comes and goes, so the content never remounts and its fade never replays.
- **Error:** when the query failed and there is nothing to show, one `role="status"` line of
  muted destructive text (`errorText`, a neutral default). It is not the skeleton's size.

**The skeleton contract:** the same layout and size as the content: the same grid, the same
table header, the same row count (`useLastCount` gives a list's last known count, 3 the first
time). If the skeleton is the wrong height, the box jumps when the data lands, which is what
this component exists to prevent.

No height animation exists to hide a wrong skeleton: one was tried and dropped (it jittered).
A skeleton off by more than 2px is a bug the jump check (`make jumps`) reports.

**What the caller provides:** the `query` (a TanStack query result), the `skeleton`, a render
function for the data, the `className` of the layout both share, and optionally `errorText`.

**Don't:** put a spinner inside it; fetch in the render function; use it for a wait that
shows data from a prop; fade content that was cached.
