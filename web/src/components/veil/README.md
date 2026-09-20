# Veil

Content that exists but shouldn't be read yet — a hint before it's
wanted, a worked solution before the attempt.

The content is **always there and always laid out at its true size**, so
nothing shifts when it lifts. It is simply pushed back: `blur-[6px]` at
`opacity-45`, which leaves the shape of the answer legible — how long it
runs, whether there's a display equation in it — while the words are
not. Centered over it sits the invitation as a 28px pill on `card` with
`shadow-floating`, so it reads as a control rather than a caption.

**Three states, and the motion is the point:**

| State | Content |
|---|---|
| at rest | `blur-[6px]`, `opacity-45` |
| hover | `blur-[4px]`, `opacity-60` — it eases closer, not open |
| revealed | sharp, full, resolved over 150ms |

Hover is a promise, not a peek: it never becomes readable, it just comes
toward you. Revealing lets the content resolve rather than snap — the
pill goes at once and the words come into focus behind it.

- **`label`** is both the invitation and the accessible name — "Show
  hint", "Show walkthrough". Default: "Click to reveal".
- **`revealed` / `onReveal`** are the caller's; the Veil keeps no state,
  so persistence belongs wherever progress already lives.
- Veiled content is `inert` and `aria-hidden`: a screen reader hears the
  button's label, not the answer behind it.

**Don't:** veil something that has no reason to be hidden; use it as a
loading state (that's a skeleton); nest one in another; put actions
inside the veiled content.

## Changes from baseline

- **New in the app, not in the baseline.** It arrived with the homework
  walkthrough: the staged hint → approach → solution reveal collapsed
  into two stages, each veiled rather than hidden behind a Reveal
  button, so the shape of the answer is visible while its content is
  not.
- Three takes, each rejected by eye against real tokens:
  1. A sweeping shimmer over blurred content — read as a loading
     skeleton, the one meaning a veil must not have, and looping motion
     broke "motion is functional".
  2. Frosted glass: `backdrop-blur-md` on a `card/40` pane inside a
     hairline border. It hid the shape along with the words and sat on
     the panel as an obvious rectangle.
  3. Lighter glass with the tint masked to fade at the edges. Better,
     but still two layers pretending to be one surface.

  The current version drops the pane entirely and treats the content
  itself as the thing being pushed back, which is what it is.
- **It adds a second movement to the system** (blur and opacity
  resolving), where the design system previously had only the book
  cover's lift. Recorded in `design/design-system.md`.

## Open

- Nothing yet. If a veiled stage ever needs to re-hide, this gets an
  `onHide`; no surface wants that today.
