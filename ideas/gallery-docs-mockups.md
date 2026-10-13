# Gallery docs: mockups for the grill (temporary)

Throwaway. Jack compares these to choose the unit page's arrangement. This file and
everything under `web/src/pages/design-mock/` are deleted before the pull request.
Decisions so far are in `ideas/gallery-docs-grill.md`; read its Summary first.

## The job

Build three arrangements of a unit's page, from the real components, on static sample
data, at `/design-mock/<option>/<kind>`:

- `<option>`: `a`, `b`, `c` (below).
- `<kind>`: `component` (Button), `pane` (today's homework panel, from
  `web/src/views/homework`, on its existing mock data and scenarios), `view` (Settings,
  if it can be rendered on the views mock layer in under about an hour of work;
  otherwise skip `view` and say so in the report).

A bar at the top of every mock page switches option and kind, so Jack can flip between
all of them without typing URLs. Nothing else in the app changes: do not touch
`/components`, `/views`, `/errors` or their code beyond importing from them. Register
the route in `web/src/App.tsx` next to the other gallery routes, lazy, outside `<Live>`.

## What every option shows

The same content, so only the arrangement differs. Put the sample content in one file
(`web/src/pages/design-mock/sample.ts`) as plain typed objects, one per kind, with
these fields. Write it short: every text field is one line, no paragraphs. Take the
facts from the existing README, `spec.md` and `grill.md`; do not invent behavior.

1. **Header**: kind, title, purpose (one sentence).
2. **States**: each with an id, a name and one line on when it happens. Button: its
   variants, sizes, with icon, disabled, busy. Homework: 5 or 6 of its real scenarios.
   Each state renders the real unit live.
3. **Components** (pane and view) or **Used by** (component): name as a link (a dead
   `#` link is fine), and what it is used for in a few words.
4. **Actions**: what the student can do, and what it leads to. A table.
5. **Data and loading**: what it reads, the call, what shows while waiting, what shows
   when it fails. A table. Empty for Button: show how an empty section looks (decide
   between hiding it and one muted line, and use the same choice in all options).
6. **Inputs**: Button's props and variants as a table (name, type, default, what it
   does). For a pane or view, what it is opened with.
7. **Rules**: four to six rules cited by id, each an id chip and one line, for example
   `R-one-primary: one primary action per screen`. Take real ones from
   `design/design-system.md`. Mark one as local to the unit.
8. **Decisions**: a table of what, why, beat. Homework: 6 to 8 rows from its
   `grill.md`. A "Full log" link at the end (dead link).

The example has a size control instead of today's Focus toggle: a component renders at
its natural size; a pane at pane width (about half of 1280) with a "full width" choice;
a view at full screen width, scaled to fit if the column is narrower. No call log, no
speed switch, no wireframes mode.

## The three arrangements

- **A, example on top.** The example fills the width, with the states as a row of
  chips above it (one state at a time) and the size control at the right. Below it,
  the spec sections in a two-column grid of compact tables.
- **B, side by side.** Example on the left, sticky, about 60 percent. The spec on the
  right as one scrolling column. Clicking a row in the States section shows that state
  in the example; the current state's row is marked.
- **C, contact sheet.** Every state rendered at once as a grid of scaled live
  thumbnails, each with its name and its one line; clicking one opens it at full size.
  The spec sections follow below as one column of compact tables.

All three share a left list of units (grouped, with a filter box; a few sample names
are enough, they need not navigate) and a row of tabs across the top: Foundations,
Components, Panes, Views, Errors, Rules. Only the look matters here; the tabs need not
work.

## Rules

- Real components and tokens only (`web/src/components/`, the design system's CSS
  variables). No new visual language. Follow `design/design-system.md`.
- Must look right in Paper and Night at 1280 wide.
- `make check-fast` passes.
- Commit on the branch as one commit, "Mockups for the gallery docs grill (temporary)".
- Report: the routes, anything skipped and why, and anything in the sample content you
  could not source from the existing docs.
