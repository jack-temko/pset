# SegmentedControl

One choice out of a few, with every option visible: a `muted` track, the
chosen option lifted onto `card`. Built for the theme (Paper / Night /
System), where a dropdown would hide two of three answers for no reason.

- A `radiogroup` of `radio` buttons with `aria-checked`, and a required
  `label` for the group's accessible name.
- 32px tall like every control; options are `text-sm` at 4px radius
  inside the 6px track, so the corners nest.
- The chosen option's hairline shadow is the one elevation cue — it sits
  on `muted`, where a border would read as a second track.

**Don't:** use it for more than four options, or for options with long
labels; use it to trigger actions (that's a set of Buttons); use it
where the choice needs explaining (that's radio rows with hints).

## Changes from baseline

- **New in the app, not in the baseline.** It arrived when the theme
  toggle left the top bar for Settings and gained a System option: a
  toggle can't hold three states.

## Open

- Arrow-key movement between options isn't wired; each option is in the
  tab order instead.
