# Design docs: one typed spec per unit

The system behind `/design`. Spec and reasons: `ideas/gallery-docs-grill.md`.

## The format

Every unit (a component, a pane that opens in the dock, or a view that owns a route) is
a folder `web/src/units/<id>/` with:

- `spec.ts`: plain data, written through `defineSpec()` (`web/src/design/spec.ts`). Fields
  in page order: `id`, `kind`, `title`, `group`, `purpose`, `states`, `stress`, `flows`,
  `components`, `actions`, `data`, `inputs`, `priority`, `sizes`, `rules`, `decisions`.
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
land in any unit. A pane or view lists its components by id, and a test checks the list
against its imports.

## The page

`/design/<kind>/<id>?state=&load=&stress=&w=&theme=`, top to bottom: kind, title and
purpose; the example live at real size, with State, Load (Loaded, Loading, Both), Theme,
Content (Normal, Stress), Width (draggable, px shown) and the flow strip; the neighbourhood
map; tables for actions, data and loading, inputs, priority and sizes; rules; decisions.
Tabs across the top (Foundations, Components, Panes, Views, Errors, Rules; a tab with no
units is hidden, except Foundations and Rules) and a grouped list with a filter on the left.

## Rules

`web/src/design/rules.ts` holds the rulebook, empty by design: a rule is written when the
thing it governs is designed. A rule has a permanent id, a kind (always, never, limit),
one sentence, a "how to check it" line, a scope and what enforces it. A spec cites rules by
id and may add local ones. A rule's page lists every unit that cites it.

## The checks

`web/src/design/checks.test.ts` runs on every registered unit: the fields its kind
requires, the length limits, unique ids, every action target, flow step, cited rule and
listed component exists, the components list equals the imports, a render for every
state, a stress render, a skeleton per state when `data` is not empty. Each is proven by a
deliberately broken fixture.

## Adding a unit

1. Make `web/src/units/<id>/` (the folder name is the id) with `spec.ts` and `examples.tsx`,
   copying `web/src/design/sample/sample-row/`.
2. Open `/design/<kind>/<id>` and judge it: states, Stress, Loading and Both, both themes,
   narrow widths, the flow.
3. `cd web && npx vitest run src/design` until the checks pass.

`web/src/design/sample/` is a test fixture (a component and a view), shown at the hidden
`/design/sample` and deleted when the format is locked.

## Freeze and lock

The spec is frozen when this system merges. Then enough components are built for one view,
the pane view and one pane; what that shows is changed; then the spec is locked.
