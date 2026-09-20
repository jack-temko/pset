# Veil

Frosted glass over content that exists but shouldn't be read yet — a
hint before it's wanted, a worked solution before the attempt.

The children are real and laid out at their true size, so nothing shifts
when the veil lifts. Over them sit two layers and a label:

- **The blur** — `backdrop-blur-[5px]`, covering the block edge to edge.
  Enough to take the words while leaving the shape of the answer: how
  long it is, whether it has a display equation in it.
- **The tint** — `card/45`, masked by a radial gradient so it fades out
  toward the edges. This is what keeps the veil from reading as a hard
  rectangle pasted onto the panel; there is no border.
- **The invitation** — the label, centered, `text-xs` in muted ink.

**The blur is never masked, only the tint is.** A gap in the blur would
hand back the words at exactly the edges the fade makes softest.

The whole thing is one button: click anywhere and the veil is gone for
good.

- **`label`** is both the invitation and the accessible name — "Show
  hint", "Show walkthrough". Default: "Click to reveal".
- **`revealed` / `onReveal`** are the caller's; the Veil keeps no state,
  so persistence belongs wherever progress already lives.
- Veiled children are `inert` and `aria-hidden`: a screen reader hears
  the button's label, not the answer behind it.

**Don't:** veil something that has no reason to be hidden; use it as a
loading state (that's a skeleton); nest one in another; put actions
inside the veiled content.

## Changes from baseline

- **New in the app, not in the baseline.** It arrived with the homework
  walkthrough: the staged hint → approach → solution reveal collapsed
  into two stages, each behind glass rather than behind a Reveal button,
  so the shape of the answer is visible while its content is not.
- An earlier take used a sweeping shimmer over `blur-sm` content. It
  read as a loading skeleton — the one meaning a veil must not have —
  and looping motion broke the system's "motion is functional" rule.
  Frosted glass is still, and static means "hidden", not "loading".
- The first glass was heavier: `backdrop-blur-md` (12px) on `card/40`
  inside a hairline border. It hid the shape along with the words and
  sat on the panel as an obvious rectangle. Lighter blur plus a tint
  that fades at the edges keeps the hiding and loses the box.

## Open

- Nothing yet. If a veiled stage ever needs to re-hide, this gets an
  `onHide`; no surface wants that today.
