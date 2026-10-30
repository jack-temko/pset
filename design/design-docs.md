# Design docs: one typed spec per unit

The system behind `/design`. Spec and reasons: `ideas/gallery-docs-grill.md`.

## The format

Every unit (a component, a pane that opens in the dock, or a view that owns a route) is
a folder `web/src/units/<id>/` with:

- `spec.ts`: plain data, written through `defineSpec()` (`web/src/design/spec.ts`). Fields
  in page order: `id`, `kind`, `title`, `group`, `purpose`, `states`, `stress`, `flows`,
  `components`, `actions`, `data`, `inputs`, `priority`, `sizes`, `exampleWidth` (optional: how wide the page opens the example), `rules`, `decisions`.
- `examples.tsx`: `defineExamples(spec, ...)`: one render per state, a `stress` render
  (the worst-case content), and a skeleton per state when the unit reads data.
- `log.md`: for a unit that was grilled, the word-for-word log. Nothing else is a doc.

Every text is one line: purpose up to 200 characters, any other line up to 160. A
flow step or `priority.main` that is not an action id fails the typecheck. A new field is
always optional and never changes meaning, so a format change is one edit plus a list of
failing files.

Links are written once, as an action with a target (a unit and a state). What leads
here, what it leads to, what is inside it and what it is made of are derived and drawn as
the neighbourhood map. A flow is an ordered list of the unit's action ids; a step may
land in any unit. A unit's components are not listed: the page derives them from its
imports.

Units import each other only through the `@/units/` alias; a relative import that leaves the
unit's folder is not allowed, and a check fails on it (so a unit's components can be read
from its imports).

The format is locked (ideas/spec-format-grill.md): it changes only through its own
grill, in one change that updates every spec and the checks together. A state's exact
`text` is optional; where given, a test renders the state and fails when the text is
not on screen. A data `call` is `'sample'` until the unit is wired, then an endpoint
that the comments of `web/src/api/gen` name. `remembers` (what, per what, for how
long) is optional. There is no skeleton prose, no narrowest width and no action key:
the skeleton render per state is the spec.

## The page

`/design/<kind>/<id>?state=&load=&stress=&w=`, top to bottom: kind, title and
purpose; the example live at real size, with State, Load (Loaded, Loading, Both),
Content (Normal, Stress), Width (draggable, px shown) and the flow strip; the neighbourhood
map; tables for actions, data and loading, inputs, priority and sizes; rules; decisions.
Tabs across the top (Foundations, Components, Panes, Views, Errors, Rules; a tab with no
units is hidden, except Foundations and Rules) and a grouped list with a filter on the left. Errors joins `/design` when it is rebuilt.

## The foundations

There is one theme: dark (`ideas/theme-grill.md`). `web/src/design/tokens.ts` holds its
colour, type, space and shape as typed data, with each text colour's allowed grounds;
`web/src/design/tokens.css` carries the same values as `--ds-*` variables, and a class per
type step (`ds-display`, `ds-body`, `ds-code` and so on), under the root class `ds`. The
stage draws every example under `ds`, and the Foundations tab shows the tokens with their
measured contrast, so they look the same whatever the app's own Paper or Night is. New
units style through these tokens only; the old `index.css` tokens and Tailwind `dark:`
variants are not used. `tokens.test.ts` measures the contrast of every text colour on
every ground it declares (4.5:1, and 7:1 for grey text), fails when `tokens.css` and
`tokens.ts` disagree, and fails on a spacing step that is not a multiple of 4. Fonts are
bundled with `@fontsource` (Source Serif 4 and IBM Plex Sans variable, IBM Plex Mono 400),
never fetched from a CDN.

## Rules

`web/src/design/rules.ts` holds the rulebook. It starts with the eleven principles of the
vision (`ideas/vision-grill.md`), then six for the foundations (serif to read, mono for
copy, figures follow text, colour has a word, contrast floors, room for big type), then two for controls (one-primary, links-go-buttons-do), one for labels (sentence-case) and one for destructive actions (friction-matches-loss); further rules are written when the thing they govern is
designed. A rule has a permanent id, one sentence, a "how to check it" line, a scope and
what enforces it. It has no kind: every rule is worded as what to do ("Keep a row title on
one line"), and a rule with a number just states the number. A spec cites rules by id and
may add local ones. A rule's page lists every unit that cites it.

## The vision

`web/src/design/vision.ts` is plain data: the one line that says what PSet is, then a
short list of facts (who it is for, the job, the centre, the student, what PSet is not,
the feel). The Rules tab of `/design` opens with it, above the rules, so the principles
are read with what they serve. The principles themselves are rules, not part of that
header. `check-before-cost` is about the backend's pipelines (scope `pipelines`), so
the docs of those pipelines cite it, not units on `/design`.

## The checks

`web/src/design/checks.test.ts` runs on every registered unit: the fields its kind
requires, the length limits, unique ids, every action target, flow step and cited rule
exists, a render for every state, a stress render, a skeleton render per state when
`data` is not empty, a wired data call that is an endpoint in the generated API types,
and each state's `text` found in its render. The inputs are checked against the
component's props, both ways, by the typecheck: `defineExamples(spec, Component, ...)`
fails when they differ. Each check is proven by a deliberately broken fixture.

## Adding a unit

1. Make `web/src/units/<id>/` (the folder name is the id) with `spec.ts` and `examples.tsx`,
   copying `web/src/design/sample/sample-row/`.
2. Open `/design/<kind>/<id>` and judge it: states, Stress, Loading and Both, both themes,
   the flow (desktop only).
3. `cd web && npx vitest run src/design` until the checks pass.

`web/src/design/sample/` is a test fixture (a component and a view), shown at the hidden
`/design/sample` and deleted when the format is locked.

## The first units

Four components are the first real units, built for Home (`ideas/home-atoms.md`): Button
(four variants, one size, never disabled: busy or not ready instead), Text link (underlined
inside text, plain when standing alone), Tag (one shape, two tones) and Tooltip (a small
floating label in the top layer that finds room inside the viewport; a not-ready button
says why in one). The Components tab now appears with them. They added `danger-solid`, `on-danger`, `neutral-soft` and the
interaction steps (`hover`, `pressed`, and hover and pressed for each solid ground) to the
foundations, and two rules, `one-primary` and `links-go-buttons-do`. A solid ground takes
black for hover and pressed, so its white label keeps 4.5:1; a transparent control takes
`fg`.

Home's parts follow (`ideas/home-parts.md`). Basics gains Counter (the old design's pill after
a title). Lists are built from two units: List (the old Box: a frame, an optional header
band, rules between rows drawn by the list) and List row (the one row shape, GitHub issue
style: a title and a status on line one, small meta on line two, an aside at the right).
Course row, Assignment row and Set line are compositions of List row and draw nothing of
their own: the assignment row shows a set (its due label, course, time left, last opened and
bar), the course row is one lean line (its name and a muted count of sets still to do), and
the set line is the assignment's row for the window pane. Progress bar narrows itself by its own width. Section
heading follows the old Home's SectionHeader (title, Counter, action, no rule). Top bar is
the wordmark, the path and Settings. Rows and bars use container queries, so they follow the
stage's width. The type steps sit in a cascade layer below the utilities, so a utility wins;
there is a `brand` step for the wordmark. Home is S14 in `ideas/screens-grill.md`: an Assignments list, then a Courses list. The
Components tab lists thirteen units.

## Follow-ups

- Jack: **"once we have enough components, the design page should be built from the same
  components and theme and vision. Just to stay uniform across the board and reduce
  out-of-band code."** When tabs, a side list, a table, a select, a segmented control and a
  text input exist as units, `/design` is rebuilt from units and the `ds` tokens, and its
  use of the old app's components and tokens is deleted.
- The shell's own all-capital eyebrow ("COMPONENT") breaks `sentence-case` and goes when
  the shell is rebuilt.

## Freeze and lock

The spec is frozen when this system merges. Then enough components are built for one view,
the pane view and one pane; what that shows is changed; then the spec is locked.
