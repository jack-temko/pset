# Prior art

A short look at how established design systems solve the thing being decided, so the
recommended options rest on proven practice and not on taste alone. It is part of Gate 0.

## When

- The user asks for it, or the caller's brief asks for it.
- The grill is about interface design (a component, pane, view, foundations, theme, a
  UX pattern), or another topic where large companies publish how they do it.

Not for decisions that are only the user's to make (scope, priority, what to cut), and
not when the sources in the repo already settle it.

## How much

Light: at most five lookups. GitHub's Primer first (primer.style, and GitHub's own
product, the reference PSet started from), then one or two other published systems that
cover the same thing (for example Apple's HIG, Material, Atlassian, Carbon). Hand the
lookups to the cheapest agent that has web access, with the exact questions; where none
exists, do them in the session. Stop at five even if incomplete, and say what was not
found.

## What comes back

- In the Gate 0 brief, a **Prior art** list: one line per finding with its link, saying
  what the system does and the reason it gives.
- In the grill file, under `sources`, the links.

## How it is used

- It informs the recommended option and its one-line why ("Primer does X because Y"),
  where it applies.
- It never decides. Every option is still judged from the point of view in the brief.
  When the recommendation goes against common practice, the question says so, and why.
  The other options still get their strongest honest case.

## Honesty

A finding counts only if the page was read in this session. Anything recalled and not
checked is labelled "from memory, not checked". If the lookups fail, say so and grill
without them.
