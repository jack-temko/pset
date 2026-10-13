# The foundations: one dark theme as tokens, three typefaces, a contrast test, six rules

## Status

Built, awaiting approval (branch `theme`, base `design`).

## Information

**Why.** Design restarted from scratch. New units need colour, type, space and shape
to be drawn with, chosen by Jack by eye on built mocks.

**Decisions.** All in `ideas/theme-grill.md` (T1 to T10, A1 to A7). Read its Summary
first; it is the spec. Every value in its Colour, Type and Space and shape tables is
used exactly. The mock at `web/src/pages/theme-mock/` with `?k=half&p=cool` is the
visual reference.

### Files

New:

- `web/src/design/tokens.ts`: the foundations as typed plain data: colours (name,
  value, what it is for, and for each text colour the grounds it may sit on with its
  floor: 4.5 for `fg`, `accent`, `attention`, `danger`, `success` and `on-accent`; 7
  for `fg-muted`), the three soft grounds computed as the hue at 15 percent over
  `bg-raised`, the type steps, the spacing steps, the radii, the border and focus
  ring. Add `success` #3fb950; adjust `danger-soft` the smallest step that makes
  `danger` on it pass 4.5 (A4), and say the value in the report.
- `web/src/design/tokens.css`: the same values as CSS variables under one root class
  (name it `ds`), with the font families and a `color-scheme: dark`. Generated from
  or checked against `tokens.ts` by a test, so the two cannot drift. Nothing in
  `web/src/index.css`'s existing tokens changes.
- `web/src/design/tokens.test.ts`: computes WCAG contrast for every text colour on
  every ground it declares and fails below its floor; fails when `tokens.css` and
  `tokens.ts` disagree; fails on a spacing step that is not a multiple of 4.
- `web/src/pages/design/foundations.tsx`: the Foundations tab, rendered under the
  `ds` class from `tokens.ts`: colour swatches with name, value, use and measured
  contrast on each allowed ground; the type steps set in their own face and size with
  a sample line each; the spacing steps as bars; the radii; the focus ring. A plain
  page in the same layout as the Rules tab, with a test beside it.

Changed:

- `web/package.json` and its lockfile: `@fontsource-variable/source-serif-4`,
  `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` (or the variable Plex
  packages if they exist; say which). Imported where `tokens.css` is, with only the
  weights the scale uses. No CDN.
- `web/src/design/rules.ts`: six rules after the eleven, worded as what to do, each
  with its check: `serif-to-read` (set what the student reads in the serif and what
  they act on in the sans); `mono-for-copy` (use mono only for codes, ids and what
  may be copied); `figures-follow-text` (set a figure in the font of the text it sits
  in); `colour-has-a-word` (give every meaning colour its word or glyph);
  `contrast-floors` (keep text at 4.5:1 or more and grey text at 7:1 or more;
  enforced by `tokens.test.ts`); `room-for-big-type` (give display type 96 above and
  56 below, and a heading 64 above and 16 below). Checks in the grill's spirit; keep
  each line within the limits.
- `web/src/design/themes.ts`, `web/src/pages/design/stage.tsx`, the URL state and
  their tests: the stage's Theme control and `?theme=` go (one theme, A6). The stage
  renders its example under the `ds` class. The two sample fixtures are restyled to
  use the new tokens, so the sample is the first thing drawn with them; they keep
  their states, flows and checks.
- `web/src/pages/design/index.tsx`: the Foundations tab renders the new page instead
  of its empty line.
- `web/src/design/vision.ts`: the "Not settled" line goes, since the colours are now
  settled.
- `design/design-docs.md`: the foundations, where they live, the `ds` class, the
  contrast test, one theme.
- `ideas/gallery-docs-grill.md`: a pointer on the decision that named the Theme
  control (D8's page description) to T1 here.
- `ideas/README.md`: this file's row; `ideas/theme-grill.md` committed.
- Deleted: `web/src/pages/theme-mock/`, its route in `web/src/App.tsx`,
  `ideas/theme-mocks.md`.

Untouched: `web/src/index.css` tokens, every old component and page, the app's Paper
and Night setting, and the `/design` shell's own styling (it is restyled later).

### Steps

1. Commit the grill and this plan; delete the mock and its route.
2. Fonts, `tokens.ts`, `tokens.css` and the test.
3. The six rules.
4. The stage: `ds` class, Theme control removed, fixtures restyled.
5. The Foundations tab.
6. Docs and this file's Status.

### Tests

- `make check` (base `design`), which includes the new tests.
- To photograph at 1280, with the app in Night and again in Paper (the pages under
  `ds` must look the same in both): `/design/foundations` (full page),
  `/design/sample`, `/design/sample?load=both`, `/design/sample?stress=1&w=280`,
  `/design/rules`.

### Acceptance

`/design/foundations` shows the colours with their measured contrast, the seven type
steps in Source Serif 4 and IBM Plex, the spacing steps and the radii; the sample row
and sample screen are drawn in the new theme whatever the app's own theme is; the
stage has no Theme control; six new rules are on the Rules tab (seventeen in all);
changing `fg-muted` to a darker grey makes `make check` fail; no font is fetched from
the network; `/theme-mock` is gone; nothing in the old app looks different.

### Out of scope

- Any real unit, the mark, motion, icons, and restyling the `/design` shell.
- Any change to the old tokens, components or the app's theme setting.
- Layout of any screen.

If a decision is missing or two conflict, stop and report; do not guess.
