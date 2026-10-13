# The vision is in the rulebook: eleven rules, a header on the Rules tab, no rule kinds

## Status

Built, awaiting approval. Branch `vision` (base `design`).

## Information

**Why.** Design restarted from scratch, so PSet had no written vision and an empty
rulebook. Jack grilled out what PSet is and the principles every unit must follow.

**Decisions.** All in `ideas/vision-grill.md` (V1 to V14, A1 to A5). Read its Summary
first; it is the spec. The words of the one line, the audience, the job, the "is not"
list and the eleven rules (ids, rule, how to check) are taken from it exactly.

### Files

- `web/src/design/rules.ts`: remove `kind` from the `Rule` type; add the eleven rules
  from the grill's table, in its order, each with id, rule, check and scope (`all`,
  except `check-before-cost`, whose scope is the backend's pipelines: add that scope
  value if the type lacks one).
- `web/src/design/spec.ts`: remove `kind` from local rules.
- `web/src/design/vision.ts` (new): plain data: the one line, who it is for (V1), the
  job (V2), the centre (V3), the student (V4), the "is not" list (V8), the feel (V14).
  One line each, within the length limits.
- `web/src/design/checks.ts`, `checks.test.ts`, fixtures under `web/src/design/sample/`:
  drop everything about rule kinds; add a check that `vision.ts` lines respect the
  limits and that rule ids are unique and kebab-case. Have the sample row cite one
  real rule (`keep-the-place` or whichever truly applies to it) besides its local one.
- `web/src/pages/design/rules.tsx`: the Rules tab opens with the vision as a short
  header (the one line as the page's lead, then the other lines as a compact
  definition list), then the rules as one flat list (rule, how to check, id, and the
  count of units citing it). No groups.
- `web/src/pages/design/sections.tsx`: a unit's Rules section is one flat list; the
  "local" label stays.
- Tests beside those files updated to match.
- `design/design-docs.md`: rules have no kind and are worded as what to do; the vision
  header; where the vision lives.
- `ideas/gallery-docs-grill.md`: mark D12 as replaced in part by V13 here (keep the
  row, add the pointer), and the same wherever "always, never, limit" is described.
- `.agents/skills/pset-view/references/student-lens.md` and the two places in
  `pset-view/SKILL.md` that quote the 1am student: rewrite to V4 (an ordinary student,
  maybe a bit tired), and point at the rulebook for the principles. Keep the ten
  lenses only where they do not contradict the eleven rules; say which you dropped.
- `.agents/skills/grill/` and `pset-view/`: any text that names rule kinds.
- `AGENTS.md`: the `pset-view` bullet's "tired student's point of view" follows V4.
- `ideas/README.md`: this file's row; `ideas/vision-grill.md` committed.
- Deleted: `web/src/pages/vibes/`, its route in `web/src/App.tsx`,
  `ideas/vision-vibes.md`.

### Steps

1. Commit the grill and this plan; delete the vibes and their route.
2. The format: remove kinds everywhere; update checks, fixtures and tests.
3. The eleven rules and `vision.ts`.
4. The Rules tab header and flat lists.
5. The skill's lens and the docs; this file's Status.

### Tests

- `make check` (base `design`).
- To photograph, Paper and Night at 1280: `/design/rules` (full page),
  `/design/rules/keep-the-place`, `/design/sample` scrolled to its Rules section.

### Acceptance

`/design/rules` opens with the one line and the five short facts about PSet, then
eleven rules in one flat list, each with its check and its id; a rule's page lists the
units citing it; a unit's Rules section has no groups; no file mentions rule kinds;
`/vibes` is gone; `make check` passes.

### Out of scope

- Theme, colours, type or any restyling (the feel in V14 is words only).
- Any real unit, and any change to `README.md` or the old design docs.
- Which screens the product needs (V10).

If a decision is missing or two conflict, stop and report; do not guess.
