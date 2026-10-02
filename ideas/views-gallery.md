# Views gallery

## Status

**In progress** (2026-09-30). Three branches, in order; each merges on its
own.

| Branch | Does | State |
|---|---|---|
| `views-plan` | This file, `CLAUDE.md`, and the note in `AGENTS.md`. | Done |
| `gallery-shell` | `/components` gets a sidebar and one section at a time. | Done |
| `views-homework` | `/views`, the fetch stub, and the homework pane as the pilot view. | Done |
| `views-skill` | The `pset-view` skill, written against what the two above built. | Done: written; task 10 tries it |

The skill is written last on purpose: it should describe the gallery and
the pilot view as they are, not as they were imagined.

## Information

### Why

`/components` is one 1794-line file with about 30 sections, and a single
scroll to find any of them. The three screens hold panes that are
separable and important (the homework panel, the Ask panel, the contents
rail, the scan) but they live as inline functions in
`pages/workspace/index.tsx` (1828 lines), so none of them can be looked at,
exercised or specified alone. Work on them one by one needs a place where
a view stands on its own, with sample data, every action live, and the
reasoning written beside it.

### Decided (2026-09-30 grill)

- **Route: `/views`**, beside `/components`; each view at `/views/<name>`.
  Neither is in the nav.
- **Both routes share one `GalleryShell`**: a left index (with a filter box
  and groups) and a content area. The product dropped its sidebar; this is
  a dev tool and doesn't share the rule.
- **`/components` shows one section at a time**, at `/components/<section>`,
  with the sidebar generated from a registry. Deep links and a fast page,
  at the cost of scrolling everything for a theme sweep (an "All" mode
  with scroll-spy can be added if that is missed). Sections live in group
  files: Foundations, Controls, Containers, Feedback, Overlays, Document
  and transcript, Composed.
- **Each section has a Docs toggle** showing the component's `README.md`.
- **A view lives in `web/src/views/<name>/`**: `index.tsx` (the view,
  extracted from its page, which then imports it), `spec.md`,
  `scenarios.ts`, and a line in the registry.
- **Mocking is at the fetch layer.** Every call goes through `api()` and
  `postForm()` in `web/src/api/client.ts`; on `/views` a stub answers
  `/api/*` from an in-memory store. The real hooks and views run, with no
  prop-drilling refactor, and mutations, optimistic updates and animations
  are real. An unmatched call answers 404 and **never reaches a real
  server**, so a view can't touch anyone's library. Each view gets its own
  `QueryClient` and the providers its page gives it (`BookHere`, `Pages`,
  `Boxing`). `events.ts` keeps `dispatch` private today; it gets a small
  exported `emit` so a scenario's timeline can walk a question through
  locating, located, reading and writing.
- **Handoffs are part of a view's design** (Jack, 2026-09-30). A view
  can send the student to another with context, and the way back is as
  designed as the way there. The model case: "Ask about this question" on
  a homework question opens Ask with that question as a context bubble
  (its statement, figure and guide state loaded), and Back from that Ask
  returns to the same set, on the same question, at the same scroll. A
  handoff names four things: the action, the target, what travels, and the
  return. The harness records a view's outgoing handoffs in a log beside
  it (a target that isn't a built view yet is a stub that shows what it
  received), and each view has an arriving scenario (`handoff-in`) for
  what it does when sent to.
- **A scenario** is fixtures plus an optional scripted event timeline. Each
  view ships the happy path and the tired paths: `empty`, `slow`, `failed`,
  `mid-flow-reload`, `return-after-break`. The `/views` page has a scenario
  picker and Replay.
- **Precedence when they disagree:** code, then a view's `spec.md`, then
  `design/*.md`. `design/*.md` keeps the grill history; a view's section
  there shrinks to a pointer once the view is extracted.
- **The spec renders beside the live view**, with a small renderer in the
  page (there is no markdown dependency).
- **Pilot view: the homework panel.** It has the most waits, failures and
  hand-offs, so it tests the design hardest. It needs the providers made
  explicit: `Walkthrough` reads `BookHereContext`, `Pages` and
  `BoxingProvider`.
- **The skill lives in `.agents/skills/pset-view/`** (the vendor-neutral
  location, `SKILL.md` with frontmatter plus `references/`), and
  `.claude/skills` is a symlink to it, so Claude Code and every harness
  that reads `.agents/skills` share one copy.
- **Agent instructions: `AGENTS.md` is the one file**; `CLAUDE.md` holds a
  single `@AGENTS.md` import so Claude Code reads the same text.

### As built (`gallery-shell`)

Differences from the tasks as first written: the demo helpers both routes
share live in `sections/shared.tsx` (only `Shelf`); the Markdown renderer
was built in the gallery from the start (`pages/gallery/markdown.tsx`, its
parser `parse-markdown.ts`), so task 5 reuses it; the README loader is
`components/readmes.ts`; and `.oxlintrc.json` turns off the fast-refresh
rule under `sections/`, whose files are registries. 29 sections, in seven
groups; a section with a README (or several: Form controls has four) gets a
Demo | Docs switch, at `?view=docs`.

### As built (`views-homework`)

The homework panel's exits are props (`onJump`, `onAskAbout`, `onOpenSettings`):
`FailedQuestion` called `navigate` itself, which would have taken the view out of
the gallery, so it is now a prop the workspace fills in. The views route sits
outside the live stream (`App.tsx`), pictures go through `assets.url`, and
`emit` takes the cache to play into. Task 8 deviates once: `design/workspace.md`'s
Homework section keeps its decision history and gains a pointer to the spec,
because deleting 335 lines of grilled decisions was not safe before the spec
carries them. **"Ask about this" already existed** (an `About` chip on the Ask
composer); what was missing is the way back, and the Homework tab unmounting on a
tab switch is friction F1 in the spec. Task 11 is that fix.

### `spec.md`, the format

Fixed headings, terse lines, tables where a table fits:

```
# <View>
purpose:  one line
where:    parent screen, slot, size
student:  who, when, state of mind ("hour 7, 1am, Night theme, glancing
          between book and problem, low patience, low working memory")
flow:     numbered happy path; per step what they see, decide, do;
          then exits and re-entry after a break
budget:   targets, e.g. "common path <= 4 clicks, 0 typing, 1 decision a screen"
anatomy:  component tree, one line of role each
states:   name -> what shows -> how to reach it (scenario id)
actions:  user action -> effect -> feedback or animation
handoffs: out: action -> target view -> what travels (context) -> how back works
          in:  from which view -> what arrives -> what it shows for it
          ("Ask about this question" -> Ask, question as a context bubble,
          Back returns to the same set, question and scroll)
data:
  reads:  hook | endpoint | wire type
  writes: hook | endpoint | optimistic?
  events: SSE type -> cache effect
why:      UI/UX decisions, each with its reason and what it rejected
friction: id | where | what goes wrong for a tired student | severity | fix | status
wants:    backend changes proposed, not built
open:     unresolved
links:    design/ sections, component READMEs
```

`budget` turns "make it easier" into something a run can fail. `friction`
is a running log: fixed rows are marked, unfixed ones carry to the next run.

### The skill's loop

Modes: `fix`, `redesign`, `modify`, `improve`, `new` (extract a view),
`audit` (the friction log with no changes).

1. Set up: a worktree per `AGENTS.md`, the nvm PATH, `make dev` on
   `.dev/data`.
2. Load context: the spec, the scenarios, `design/design-system.md`, the
   READMEs of the components involved.
3. **Walk the student's flow.** Write or refresh `student`, `flow`,
   `budget`.
4. **Find the friction** with the lenses below, driving the flow in the
   harness (Playwright, output outside the repo), including every handoff
   out and back.
5. **Decide.** Declutter first, then reuse an existing component, then
   create one (folder, README, a `/components` section). A `redesign`
   shows the flow, the friction log and its proposal, with a
   recommendation, and waits for a go-ahead; a `fix` proceeds.
6. Implement.
7. Backend suggestions go into `wants` and are proposed (`wire.go`,
   routes); they are built only when asked.
8. **Verify against `budget`**: every scenario, both themes, 1280 or wider,
   keyboard only; tests, lint, build.
9. Update the docs: `spec.md` with its friction log, component READMEs,
   `design-system.md` if a token or rule moved.
10. Merge per `AGENTS.md`.

It asks Jack only when a finding depends on how he or his students behave
("what do you do right after a hint?"): at most three questions a run,
batched. The student lens proposes; it never overrides a locked decision
(the Focus toggle, hint then approach then solution, the 15px floor). A
finding that contradicts one is raised, not acted on.

### The lenses

Each produces friction rows.

1. **Glance test.** Eyes half shut for two seconds: what is this, what
   state is it in, what is the one next action? One primary action per
   region.
2. **Visibility ladder.** Each element is always visible, on focus or
   hover, one click away, or gone. The default is gone.
3. **Only what's valid now.** No disabled buttons for states that can't be
   reached; the actions offered follow the state.
4. **Decision load.** Count the choices on screen at once. Recognition over
   recall; the common path takes defaults and no typing.
5. **Stuck.** Dead ends, empty states that don't say what to do, waits with
   no progress or ETA, errors that don't say whether the work is safe,
   irreversible actions (undo beats confirm when it can be undone).
6. **Confused.** Jargon, internal states leaking into the UI, unlabelled
   icons, look-alike actions, state changes without feedback.
7. **Tired-body ergonomics.** No precision aiming, no hover-only
   affordances; the whole flow works from the keyboard with a sensible Tab
   order, Enter to confirm, Esc to back out; scroll position, drafts and
   the current tab survive a reload or a tab switch; Night is the primary
   theme for this persona; motion is calm and honours reduced motion.
8. **Re-entry.** After a break, does the view say where you left off and
   what is next?
9. **Trust.** When the model is slow or wrong, is the student ever blamed,
   and can they see the source behind an answer?
10. **Handoffs.** Every place the student's next need is another view: is
    there a door to it, does the context travel so they never retype or
    re-find it, and does Back put them exactly where they were (place,
    selection, draft, scroll)? A handoff that drops the student in a cold
    view, or strands them there, is a finding.

### Open

- How a handoff's return is carried: a `from` in the URL, or router
  history state. It must survive a reload, and a handoff must never leave
  the student with two Backs that disagree.
- Ask taking a context reference (a question id) on a turn is backend work
  the first handoff needs: it goes in the homework spec's `wants`. It fits
  the locked "one running conversation per book": the bubble is context in
  that conversation, not a second one.
- Whether an "All" scroll-spy mode is missed on `/components`.
- Whether `/components` and `/views` want a shared `/design` index above
  them.
- Later views to extract, in a likely order: the Ask panel, the contents
  rail, the scan, the Home sections, the top bar and activity sheet.

## Tasks

- [x] 1. (sonnet) A gallery shell with a sidebar, a filter and a registry
  - Files: `web/src/pages/gallery/shell.tsx`, `web/src/pages/gallery/registry.ts`, `web/src/pages/gallery/README.md`
  - Do: `GalleryShell` renders a left index (groups, a filter box, the current entry highlighted, keyboard reachable) and a content column inside `AppShell`. `registry.ts` defines the entry type (`id`, `title`, `group`, `note`) that both routes use. Follows the design system: no arbitrary values, 15px floor.
  - Done when: `npx tsc -b` and `npx oxlint` pass; the shell renders in both themes at 1280 wide.
- [x] 2. (sonnet) `/components` is split into group files, one section at a time
  - Files: `web/src/pages/components/index.tsx`, `web/src/pages/components/sections/foundations.tsx`, `web/src/pages/components/sections/controls.tsx`, `web/src/pages/components/sections/containers.tsx`, `web/src/App.tsx`
  - Do: move each `Section` and the demo helpers it uses into group files (foundations, controls, containers first; feedback, overlays, document and composed follow in task 3), each exporting registry entries; `/components/:section?` renders the chosen one inside the gallery shell, defaulting to the first. Nothing about a section's content changes.
  - Done when: every moved section looks the same as before in both themes; typecheck, lint and tests pass.
- [x] 3. (sonnet) The rest of the sections, and each section's Docs toggle
  - Files: `web/src/pages/components/sections/feedback.tsx`, `web/src/pages/components/sections/overlays.tsx`, `web/src/pages/components/sections/document.tsx`, `web/src/pages/components/sections/composed.tsx`, `web/src/pages/components/docs.tsx`
  - Do: finish the split; a Docs toggle on each section shows that component's `README.md` (imported `?raw`, drawn by a small renderer for headings, paragraphs, lists, tables, code).
  - Done when: all 30 sections are reachable from the sidebar; the Docs toggle shows the README of Button, Box and Shell correctly; typecheck, lint and tests pass. `web/src/pages/components/index.tsx` is under 100 lines.
- [x] 4. (opus) The fetch stub, `emit`, and an in-memory store
  - Files: `web/src/views/mock/api.ts`, `web/src/views/mock/store.ts`, `web/src/views/mock/scenario.ts`, `web/src/api/events.ts`, `web/src/views/mock/mock.test.ts`
  - Do: install a `fetch` stub for the life of a mounted view, answering `/api/*` from the store through per-scenario route handlers; unmatched calls answer 404 with the server's error shape and never call the real `fetch`. Export `emit(type, data)` from `events.ts`. A scenario is `{ id, title, fixtures, routes, timeline? }`.
  - Done when: a test proves an unmatched call never reaches the real `fetch`, that a mutation changes the store and a following read sees it, and that `emit` runs a registered handler.
- [x] 5. (sonnet) The `/views` route: registry, scenario picker, Replay, spec beside the view
  - Files: `web/src/pages/views/index.tsx`, `web/src/views/registry.ts`, `web/src/views/README.md`, `web/src/App.tsx`
  - Do: `/views` and `/views/:view` in the gallery shell; a view is shown with its own `QueryClient` and providers, a scenario picker, Replay, a log of the handoffs it sends, and its `spec.md` beside it. The spec is drawn by `pages/gallery/markdown.tsx`, built with the Docs toggle.
  - Done when: a placeholder view renders live with its spec; typecheck, lint and tests pass.
- [x] 6. (sonnet) The homework pane is extracted into `web/src/views/homework/`
  - Files: `web/src/views/homework/index.tsx`, `web/src/views/homework/walkthrough.tsx`, `web/src/pages/workspace/index.tsx`, `web/src/views/registry.ts`, `web/src/views/homework/providers.tsx`
  - Do: move `HomeworkTab`, `SetRow` and `Walkthrough` (and what only they use) out of the workspace page; the page imports the view; `providers.tsx` supplies `BookHere`, `Pages` and `Boxing` for the harness. Behaviour does not change.
  - Done when: the workspace's Homework tab behaves as before in the real app (both themes, 1280 wide); typecheck, lint and tests pass; `pages/workspace/index.tsx` is shorter by what moved.
- [x] 7. (sonnet) The homework scenarios, tired paths included
  - Files: `web/src/views/homework/scenarios.ts`, `web/src/views/homework/routes.ts`, `web/src/views/homework/timeline.ts`
  - Do: scenarios `happy`, `empty`, `slow`, `failed`, `mid-flow-reload`, `return-after-break`, `handoff-in`; a timeline that walks a question through pending, locating, located, reading and writing.
  - Done when: each scenario is reachable from the picker and Replay plays the timeline, with the animations, in both themes.
- [x] 8. (opus) The homework `spec.md`, with the student's flow and a first friction log
  - Files: `web/src/views/homework/spec.md`, `design/workspace.md`
  - Do: write the spec in the format above, including `student`, `flow`, `budget`, `handoffs` ("Ask about this question" out and back is the first) and a friction log from a real walk through every scenario (keyboard only, Night theme); shrink the Homework section of `design/workspace.md` to a pointer.
  - Done when: every heading in the format is present; each friction row names a scenario that shows it; the file reads correctly beside the live view.
- [x] 9. (opus) The `pset-view` skill, written against the built gallery
  - Files: `.agents/skills/pset-view/SKILL.md`, `.agents/skills/pset-view/references/student-lens.md`, `.agents/skills/pset-view/references/spec-template.md`, `.agents/skills/pset-view/references/mock-layer.md`, `.claude/skills`
  - Do: `SKILL.md` (frontmatter `name` and `description`, the modes, the loop, the guardrails) kept short, the three references, and `.claude/skills` as a relative symlink to `../.agents/skills`.
  - Done when: a fresh Claude Code session lists the skill and a run of `audit` on the homework view produces a friction log that matches the spec's format.
- [ ] 10. (opus) A first real run of the skill on the homework view
  - Files: `web/src/views/homework/spec.md`
  - Do: run `redesign` or `fix` on one friction row; the run's changes and the doc updates are the test of the skill.
  - Done when: the row is marked fixed in the friction log with the change made; the skill's loop needed no correction, or the corrections are written back into it.
- [ ] 11. (opus) The first handoff, finished: "Ask about this" already opens Ask with the question's chip; make Back return to the same set, question and scroll (friction F1)
  - Files: `web/src/views/homework/spec.md`, `web/src/views/homework/walkthrough.tsx`, `web/src/pages/workspace/index.tsx`, `design/workspace.md`
  - Do: run `redesign` through the skill on this handoff: a homework question opens Ask with that question as a context bubble, and Back returns to the same set, question and scroll. The spec's `handoffs` and `wants` say what travels and what Ask needs from the backend (a context reference on a turn); build the frontend side against the harness's stub, and the backend only when asked.
  - Done when: in the harness the handoff shows in the log with its context, and Back restores set, question and scroll (also after a reload); the homework `spec.md` and `design/workspace.md` say so.
