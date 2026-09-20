# Veil

Frosted glass over content that exists but shouldn't be read yet — a
hint before it's wanted, a worked solution before the attempt.

The children are real and laid out at their true size, so nothing shifts
when the veil lifts. Over them sits a `backdrop-blur-md` pane on
`card/40` with a `border-muted` hairline and the invitation centered in
`text-xs` muted ink. The whole thing is one button: click anywhere and
the veil is gone for good.

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

## Open

- Nothing yet. If a veiled stage ever needs to re-hide, this gets an
  `onHide`; no surface wants that today.
