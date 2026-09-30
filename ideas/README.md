# Ideas

Work that is decided but not built, being built, or stuck. Settled
behaviour lives in `design/`; this folder is for what isn't settled in
code yet. One file per group of ideas that belong together, each with two
sections: **Status** (where it stands, what it waits on) and
**Information** (why, what was decided, how it would work, what it costs,
what's still open).

When you start one, set it to In progress and name the branch. When it
ships, the spec in `design/` becomes the truth: set it to Done with a
pointer there, and delete the file once nothing in it is still useful.

## Statuses

| Status | Means |
|---|---|
| **Idea** | Written down, not decided. |
| **Planned** | Decided (grilled), waiting its turn. |
| **In progress** | Being built; the file names the branch. |
| **Blocked** | Waiting on something the file names. |
| **Done** | Shipped; `design/` has the spec now. |
| **Dropped** | Decided against, with why, so it isn't proposed again. |

## Groups

Phases are the build order from the 2026-09-25 grill: finding first, then
pointing, then importing, because the importer feeds the same finder.

| Group | Status | Phase | In a line |
|---|---|---|---|
| [Finder test set](finder-tests.md) | Done | 1 | Lookalike assignments and known answers, so every change to finding and reading is measured. |
| [Book structure](book-structure.md) | Done | 1 | Printed page ranges and each book's problem numbering, detected at import. |
| [Finding problems](finding-problems.md) | Done | 1 | Read a reference into its parts, look where the book keeps it, and check the pick. |
| [Boxing a problem on the page](boxing-on-the-page.md) | Done | 2 | Drag a box (or several) on the scan: to add a question, or to show a failed find where it is. |
| [Importing assignments](importing-assignments.md) | Done | 3 | PDFs, a course web page, a photo or text, read into rows you review before they're added. |
| [Professor's notes](professor-notes.md) | Done | 3 | "do c", "no PSpice", "500 packets": kept with the question and followed by the guide. |
| [Structured guides](structured-guides.md) | Done | any | Ask answers and guides as typed blocks the server checks and repairs: math as runs, no red, three veils. |
| [Views gallery](views-gallery.md) | In progress | any | `/components` with a sidebar, `/views` for separable views with sample data and specs, and the `pset-view` skill that works on them one by one. |
| [Grill skill](grill-skill.md) | Planned | any | A standalone `grill` skill that interviews you in weighted batches until a spec is ironed out, and pset-view's gates for grilling a view before any code: purpose, flow and layout, behavior, data. |
| [Time remaining estimate](time-remaining-estimate.md) | Idea | any | A time left on a homework set from the student's own pace and an LLM-written difficulty index per question. Mocked in the redesign until this is built. |
| [Loose ends](loose-ends.md) | Idea | any | Small things noticed along the way. |
| [Model usage](model-usage.md) | Done | any | What each finished job cost: model, time, tokens and dollars on one quiet line, a light popover behind it. |
| [Audit fixes](audit-fixes.md) | Done | any | The 2026-09-29 audit, one branch per finding: leaks, restart, local-only API, docs. |
