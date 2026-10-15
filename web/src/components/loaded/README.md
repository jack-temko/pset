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

**The reveal train.** Like React's Suspense, which reveals loaded content at most once every
300ms so nearby sections appear together: a box whose skeleton was seen reveals at once if no
box revealed in the last 300ms (`REVEAL_MS`), and otherwise joins the next reveal, 300ms after
the last. Everything that joined appears in the same frame. Data inside the grace, cached data
and overlays (`grace={false}`) don't use it. A box that goes pending again leaves the train.

**Several queries.** `queries` lists more queries the box waits on; it reveals once all have
answered (`children` gets `query`'s data and closes over the rest). Only `query` failing is the
box's error line; a failed extra one does not take the box down, and the content draws its own
line where that part would sit (`errorClassName` shapes the box's line when it is a pane). A page does this once, so its late facts are decided inside.

**Variants.** A view with more than one shape passes `view` (its key in `web/src/variants.ts`: home, rail,
homeworkList, homeworkSet, ask, settingsKey), `variant` (resolved before the data, or
`undefined` when unknown), `skeletons` (one per variant, typed by that view's names in
`web/src/variants.ts`), `neutral` (the chrome every variant shares, real, and a quiet body, drawn
when the variant is unknown) and `variantOf(data)`. Both layers get `data-view` and `data-variant`, so a check finds a box by view and variant (a
variant name such as `empty` belongs to more than one view). The types tie the two: the variant
is one of that view's names. In
development a skeleton variant that is not the content's, or content that switches variant
within half a second of appearing, warns on screen and in the console; `make jumps-check` (the
jump guard, part 3) finds a box by `data-view` and `data-variant` and fails the same. The variant is chosen in render (a lazy `useState` initial, a derived value), never
in an effect. Lists seed their details (`useListedSet`) so a click knows its variant.

**`fill`** makes the box as tall as its parent (`boxClassName` places it in a flex or grid parent), for a pane that bottom-aligns its content (the
Ask tab, the empty Homework list).

**Overlays pass `grace={false}`.** A dialog or popover is new on screen, so its skeleton shows
from its first frame (no hidden phase, no fade-in) and data crossfades over it even if it lands
inside 300ms. The grace is for content inside a page that is already there.

**Prefetch intent.** An overlay's data is warmed by `usePrefetchIntent(prefetch)`
(`lib/prefetch-intent.ts`): spread its handlers on the trigger. It prefetches after the pointer
has rested 60ms (a pointer sweeping past asks for nothing), at once on a press or keyboard
focus, and never for a touch pointer's hover. `Menu` and `MenuItem` take it as `intent`.

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
