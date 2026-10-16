# Tag: log

The grill of 2026-10-13, word for word. Prior art: GitHub's Primer pages for Label.

- What forms does it take? One shape, five tones (Recommended) / Two shapes /
  Neutral only. **"one shape, but the tones got out of hand, lets start small like the
  buttons and grow if needed"**

## Settled afterwards (the coordinator, not asked)

The neutral tag's text is `fg`, not `fg-muted`: grey text must reach 7:1, and no ground
light enough to read as a ground on `bg-raised` lets it. Its ground, `neutral-soft`, is
`fg` at 8 percent over `bg-raised`.

## Overdue (2026-10-14)

- A set past its due date: how is that shown? 'Overdue' in red (Recommended) /
  'Overdue Sat' in amber / Same as due soon. **'Overdue' in red (Recommended).**

So Tag gains a `danger` tone: `danger-soft` ground, `danger` text (4.51:1 on it, held
by the contrast test).

## GitHub-style labels (2026-10-16)

Jack, on the "Due soon" and "Overdue" badges: **"Can we make them look more like GitHubs badges?"**

Every tone is now an outlined pill after GitHub's issue labels: full radius, 20 high, 8 sides, a 1px border and the text in the tone's colour on a transparent ground, set in a new `label` step (IBM Plex Sans 12/18, 500) used only by tags, with a 12px glyph. Neutral is a `border` outline with `fg-muted` text. The text colours are the ones already measured on `bg` and `bg-raised` in tokens.ts (attention and danger at 4.5:1, fg-muted at 7:1).
