# `/design`: one typed spec per unit, one page that renders it

## Status

In progress, branch `gallery-docs` (base `design`, D26).

## Information

**Why.** The component and view pages are walls of prose with a cramped example, on
three separate pages that do not link to each other. Jack wants one lasting spec
format every future feature fits, shown on one page he can judge a design from.

**Decisions.** All in `ideas/gallery-docs-grill.md` (D1 to D26, A1 to A11). Read its
Summary before anything else; it is the spec. The mockup of the chosen arrangement is
`web/src/pages/design-mock/` option A (`/design-mock/a/pane`): the real page looks and
behaves like it. Design starts from scratch (D24), so this change ships no real unit
and no rules, only the system and one sample.

### Files

New, the system (`web/src/design/`):

- `spec.ts`: the types and `defineSpec()`. Fields and their order are the table in the
  grill's artifact. Kinds `component | pane | view`. Ids are string literal types so a
  flow step that is not one of the unit's action ids, or a `priority.main` that is not
  one, fails the typecheck. Unit, state and rule references across files are checked
  by the test below. Every new field after this change is optional.
- `examples.ts`: `defineExamples(spec, {...})`: one render per state id (required by
  type), a `stress` render (required), and a `skeleton` render per state, required by
  type when the spec's `data` is not empty.
- `rules.ts`: the `Rule` type (id, kind `always | never | limit`, rule, check, scope,
  enforcedBy?) and `RULES`, an empty array.
- `registry.ts`: every unit's spec and its lazy examples, found with `import.meta.glob`
  over `web/src/units/*/spec.ts`; derived data: used by, leads here, leads to, units
  citing a rule.
- `limits.ts`: the length limits (purpose 200, any other line 160).
- `checks.test.ts`: runs on every registered spec and on the sample: required fields
  for its kind, limits, unique ids, every action target, flow step, cited rule and
  listed component resolves, `components` equals the unit ids imported by the unit's
  source files (read from disk; direct imports from `web/src/units/`), a render for
  every state, a stress render, a skeleton per state when `data` is not empty. One
  test per rule of the format, each proven by a deliberately broken fixture spec.
- `sample/spec.ts`, `sample/examples.tsx`: one sample component (a small list row
  with a menu, so it has states, actions, data, a flow of two steps, a local rule and
  two decisions). A fixture: not under `web/src/units/`, not in any tab.

New, the page (`web/src/pages/design/`):

- `index.tsx`: routes `/design`, `/design/:kind/:id`, `/design/rules`,
  `/design/rules/:id`, `/design/sample`. Tabs (Foundations, Components, Panes, Views,
  Errors, Rules; a tab with no units is hidden, except Foundations and Rules), the
  grouped list with a filter, the empty state of each.
- `unit.tsx`: the unit page, top to bottom as in the grill's artifact.
- `stage.tsx`: the example: toolbar (State, Load, Theme, Content, Width), the stage at
  real size with the resize handle, the flow strip. All of it in the URL
  (`?state=&load=&stress=&w=&theme=`). Both renders loaded content with the skeleton
  over it at half opacity, in the page, no iframes.
- `map.tsx`: the neighbourhood map, derived only.
- `sections.tsx`: Actions, Data and loading, Inputs, Priority and sizes, Rules
  (Always, Never, Limits), Decisions with the Full log link.
- `rules.tsx`: the Rules tab and a rule's page with the units citing it.
- Tests beside them for the URL state and the derived map.

Changed:

- `web/src/App.tsx`: add the `/design` routes (lazy, outside `<Live>`); remove
  `/design-mock`.
- `web/src/components/top-bar/index.tsx`: the dev link goes to `/design`.
- `web/src/index.css`: a scope class per theme so a theme can be shown inside the
  stage regardless of the app's theme (today only `.dark` exists). No token changes.
- `web/.oxlintrc.json`: only if `examples.tsx` files need the same
  `react/only-export-components` exception the sections have, with the reason.
- `.agents/skills/grill/SKILL.md`, `references/grill-file.md`: a unit grill writes its
  decisions into the unit's `spec.ts` and keeps only the word-for-word log
  (`log.md` beside the spec); other grills are unchanged. Gate 0 gains a "Prior art"
  part (D25): `references/prior-art.md`, light research on Primer first, cited in the
  recommendations. `pset-view` asks for it by default; `AGENTS.md`'s `grill` bullet
  names it.
- `.agents/skills/pset-view/SKILL.md` and `references/` (`spec-template.md`,
  `verify.md`, any other that names `spec.md`, `grill.md`, a README, `/views` or
  `/components`): they produce `spec.ts` and `examples.tsx` in `web/src/units/<id>/`
  and check on `/design`; the skill covers all three kinds; the old design docs bind
  nothing new (D24).
- `AGENTS.md`: "Checking UI changes" and "Skills" name `/design` and `spec.ts` for new
  units; "Branches" gains a `design` paragraph (D26), modelled on the `courses` one.
- `.github/workflows/ci.yml`: `design` joins `dev` and `main` in the two branch lists
  (full `make check`); the smallest change. Pausing the courses tracks (D22) is a
  separate change: neither `ideas/courses.md` nor the `courses` paragraph exists here.
- `ideas/views-gallery.md`, `ideas/grill-skill.md`: a line at the top pointing here
  for new work.
- `design/design-system.md` and `design/README` if there is one: one line saying
  these describe the old app and bind nothing new (A9).
- `ideas/README.md`: this file's row.

New doc: `design/design-docs.md`: the shipped system in one page (the format, the
page, the checks, how to add a unit, the freeze and the lock).

Deleted: `web/src/pages/design-mock/`, `ideas/gallery-docs-mockups.md`.

Untouched: everything under `web/src/components/`, `web/src/views/`,
`web/src/pages/components/`, `web/src/pages/views/`, `web/src/pages/gallery/` except
what the new page imports from them.

### Steps

1. `web/src/design/`: types, `defineSpec`, `defineExamples`, rules, limits, registry.
2. The sample fixture, and `checks.test.ts` with its broken fixtures.
3. The page: shell, tabs, list and empty states; then the stage; then the map and
   sections; then the Rules tab. Start from the mockup's option A code, replacing its
   sample data with the registry. The page uses today's components and tokens (A5).
4. The theme scope in `index.css`, and the Theme control reading the themes that
   exist.
5. Routes and the top bar link; delete the mockup and its brief.
6. The two skills, including the grill's prior-art step (D25).
7. Docs: `design/design-docs.md`, the pointers, `AGENTS.md`,
   `ideas/README.md`, and this file's Status.

### Tests

- `make check`, which runs the new tests too.
- New: `web/src/design/checks.test.ts`; the page's URL-state and map tests.
- To photograph, Paper and Night at 1280: `/design` (empty), `/design/rules` (empty),
  `/design/sample`, `/design/sample?load=loading`, `/design/sample?load=both`,
  `/design/sample?stress=1&w=280`, and `/design/sample` scrolled to the map and the
  tables.

### Acceptance

The grill's Acceptance paragraph, word for word. Plus: no file under the old gallery
or components folders changed; `/components`, `/views` and `/errors` still work.

### Out of scope

- Any real unit, rule, foundation, theme or vision. `web/src/units/` stays empty.
- Migrating or deleting any old component, page or doc.
- A whole-app map, a front page of live cards, a call log, a speed switch.
- Restyling `/design` itself.

If a decision is missing or two conflict, stop and report; do not guess.
