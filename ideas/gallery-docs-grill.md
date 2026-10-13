# Gallery docs: grill

- status: approved
- date: 2026-10-13
- brief: one dev URL for components, panes and views, and a typed, renderable spec per unit; judged from Jack reading a unit to judge its design, and an agent reading the same file to build
- sources:
  - `web/src/App.tsx`, `web/src/pages/gallery/`, `web/src/pages/components/`, `web/src/pages/views/`, `web/src/views/`
  - `design/design-system.md` and the other `design/` specs (45 written rules, no ids)
  - `ideas/views-gallery.md`, `ideas/grill-skill.md`, `ideas/courses.md`, `ideas/courses-grill.md`, `ideas/loading-standard-grill.md`
  - `.agents/skills/pset-view/`, `.agents/skills/grill/`
  - branch `dock` (the pane, pane tabs and split, unmerged)
  - built mockups at `/design-mock` (commits c81b921, 1d1486e; deleted before the pull request)

## Summary

### In one line

`/design` is one place where every piece of PSet's interface, at any size, is shown
working in its states above a short typed spec saying what it is for, what it links to,
which rules it follows and what was decided.

### Decisions

| #   | Decision                                                                                                                                                                                | Why                                                         | Beat                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| D1  | A unit's page serves Jack judging and an agent building, from one source                                                                                                                | One truth, no drift                                         | A review tool only; an agents' brief only               |
| D2  | Three buckets by a testable rule: a view owns a route, a pane opens in the dock, everything else is a component. Kind is one field                                                      | Refiling is a one-line change                               | Judgment by size; a fourth "chrome" bucket              |
| D3  | The source is a typed `spec.ts` per unit, plain data, written through one `defineSpec()`. Live states sit in a file beside it                                                           | No room for narration; wrong ids fail the typecheck         | Markdown with fixed headings; front matter plus notes   |
| D4  | One shared core for all kinds, plus a few fields per kind                                                                                                                               | All pages read alike                                        | One identical schema; three schemas                     |
| D5  | Text fields are single lines with generous tested limits (purpose 200 characters, any other line 160)                                                                                   | Stops paragraphs for good                                   | Shape only (first chosen, then reopened); warnings      |
| D6  | The example has four jobs: spot UI faults (overflow, spacing, padding, position), show every variant loading through its skeleton, walk a student's flow, give the feel                 | Jack's words                                                | An example that only lists states                       |
| D7  | Every unit supplies worst-case content. A unit that reads data names a skeleton for every state                                                                                         | Stress and Loading work on every unit                       | Optional; generated stress text                         |
| D8  | The page is arrangement A: the example on top at real size, the spec below as compact tables                                                                                            | A pane or a whole screen fits at real size                  | B, side by side; C, contact sheet                       |
| D9  | Links are written once, as actions with a typed target (unit and state). Exits, entrances and used-by are derived and drawn as one neighbourhood map                                    | Nothing to keep in step by hand                             | Hand-written entrances and exits; tables; flows only    |
| D10 | A flow is an ordered list of action ids, and a step may land in any unit. It lives where it starts                                                                                      | Journeys cross screens; a flow cannot invent a transition   | Flows inside one unit; a Flows tab                      |
| D11 | A pane or view lists its components by id, and a test checks the list against its imports                                                                                               | Chosen, and true                                            | Derived from imports; unchecked                         |
| D12 | One rulebook. A rule has a permanent id, a kind (always, never, limit) and a "how to check it" line. Specs cite rules; a unit may add local ones. Never and Budget are rules            | One wording per rule; Jack: "shouldn't never just be a rule" | Rules per spec; Never and Budget as sections            |
| D13 | The rulebook ships empty: the mechanism only, with zero rules. Rules are written as each thing is designed | Jack: wipe the rulebook clean | The 16 main rules (first chosen); all 45 written rules |
| D14 | Sections after the example: map, actions, data and loading, inputs, priority, sizes, rules, decisions                                                                                   | Jack's picks                                                | A "known problems" section                              |
| D15 | Decisions are typed in `spec.ts`, with permanent ids and a "superseded by" field. For a unit grill, the grill skill writes them there and keeps only the word-for-word log as a file    | One typed source                                            | Drawing the table from `grill.md`; a typed copy         |
| D16 | `spec.ts` is the only doc of a unit. No README, `spec.md` or `grill.md` for new work | One file of facts per unit | Keeping both |
| D17 | No call log, speed switch, wireframes mode or Focus toggle on the page                                                                                                                  | Jack: no need                                               | Keeping any                                             |
| D18 | Getting around: tabs across the top, a grouped list with a filter on the left, every unit name a link, the state and controls in the URL                                                | One click to any kind or unit                               | One list with no tabs; a front page of live cards       |
| D19 | The new system is at `/design`, with new units in a new folder. The old components, pages and docs are not migrated: the app moves to new units one screen at a time, and an old part is deleted when nothing imports it | The working app is never half-redesigned | Migrating the 36 components; replacing each in place; a separate app shell |
| D20 | This change ships the format, the page, the checks and the skills, with no real unit. One sample component, a test fixture at a hidden `/design/sample`, lets Jack see the page; it is deleted at the lock | Jack builds the units after | Button and Settings as exemplars (first chosen) |
| D21 | The grill and pset-view skills write the new format from this change on                                                                                                                 | Nothing new is born in the old format                       | Switching in the migration                              |
| D22 | The courses tracks pause, the dock included. They resume as views and panes in the new format when their components exist | No building on components about to be replaced | The dock converts first; carrying on and rebuilding later |
| D23 | The spec is frozen when this change merges. Jack then builds enough components for one view, the pane view and one pane; what that shows is changed; then the spec is locked | All three kinds proven before the lock | Freezing only after the first pane; one redesigned component in this change |

| D24 | Design starts from scratch: vision, theme, foundations (colour, type, spacing, the mark), every component, and all rules. Views and panes are built as their components exist | Jack: "wipe the rulebook clean", "same thing for vision and theme" | Keeping the foundations as given; re-confirming them first |
| D25 | A grill does light research on what established design systems do (GitHub's Primer first) when the topic calls for it or Jack asks, and its recommendations cite it | Recommendations rest on proven practice, not taste alone | Recommending from memory |

### The artifact(s)

**The spec** (`spec.ts`, plain data; fields in page order):

| Field        | Holds                                                                                             | Kinds        |
| ------------ | ------------------------------------------------------------------------------------------------- | ------------ |
| `id`, `kind`, `title`, `group` | The URL, the bucket, the name, the list group                                   | all          |
| `purpose`    | One sentence                                                                                      | all          |
| `states`     | Each: id, name, when it happens, the exact text shown when empty or failed, its skeleton          | all          |
| `stress`     | One line saying what the worst case is (longest, most, empty)                                     | all          |
| `flows`      | Each: id, name, steps as action ids                                                               | pane, view   |
| `components` | Each: unit id, what it is used for                                                                | pane, view   |
| `actions`    | Each: id, exact label, shortcut key, what it does, target (unit and state)                        | all          |
| `data`       | Each: what it reads, the call, what shows while waiting, what shows when it fails                 | when it reads |
| `inputs`     | Each: name, type, default, what it does (a component's props; what a pane or view is opened with) | all          |
| `priority`   | What the student sees first; the one main action (an action id)                                   | all          |
| `sizes`      | The narrowest width it must work at; what gives way first, in order                               | all          |
| `rules`      | Rule ids cited; local rules (id, kind, rule, how to check)                                        | all          |
| `decisions`  | Each: id, decision, why, beat, date, superseded by; a link to the word-for-word log               | all          |

Beside it, `examples.tsx`: one live render per state id, a stress render, and the
skeleton renders, with data from typed builders on the generated API types.

**The page** (`/design/<kind>/<id>?state=&load=&stress=&w=&theme=`), top to bottom:

1. Kind, title, purpose.
2. The example, live, at real size. Controls: state chips; Loaded, Loading, Both;
   Paper, Night; Stress; a drag handle for width with the px shown; the flow strip
   with Previous and Next.
3. The neighbourhood map: leads here, leads to, inside, made of. Every box a link.
4. Tables: actions, data and loading, inputs, priority and sizes.
5. Rules, grouped Always, Never, Limits; each a link to the rule's page, which lists
   every unit that cites it.
6. Decisions table, and a link to the full log.

**A rule** (the rulebook is empty; this is the shape): a permanent id, a kind (always,
never, limit), one sentence, a "how to check it" line, a scope, and what enforces it
if anything does. The Rules tab lists them; a rule's page lists every unit citing it.

**What the tests enforce** on every registered unit: the fields its kind requires; the
length limits; unique ids; every action target, flow step, cited rule and listed
component exists; the components list matches the imports; an example render for
every state; a stress render; a skeleton for every state when `data` is not empty.

**Acceptance** (what Jack tries): open `/design` and find it empty but working: tabs, a
list, the Rules tab with no rules. Open `/design/sample`: switch states, drag the
width, turn on Stress, see Loading and Both, step the flow, switch theme; follow a
map box and a rule chip and come back; read the whole spec without meeting a
paragraph. Break the sample's spec on purpose (a wrong rule id, an over-long line, a
state with no render) and see the checks fail.

### Assumed

- A1: the Focus toggle becomes the width control (a component at its natural size, a
  pane at pane width, a view at full width, all draggable). Jack left it to me.
- A2: a tab appears when it has its first unit. Foundations and Rules are tabs from
  the start, empty.
- A3: `spec.ts` and `examples.tsx` sit beside the unit's code. New fields are added as
  optional, never changed in meaning, so a format change is one edit plus a list of
  failing files.
- A4: "the grill file goes" (D15) applies to unit grills only. Grills with no unit
  (vision, theme, this one) keep their file.
- A5: the `/design` page itself is built on today's components and tokens, since
  nothing else exists, and is restyled when the new foundations do. Its Theme control
  lists whatever themes exist and shows each inside the example only.
- A6: an empty section shows one muted line, not nothing.
- A7: the dev link in the top bar goes to `/design`; the old `/components`, `/views`
  and `/errors` stay reachable from the old footer until they are deleted.
- A8: mockups during a grill are built at a temporary route and deleted, as here.
- A9: `design/design-system.md` and the other `design/` specs keep describing the old
  app until it is gone, and bind nothing new. This change adds that line to them.
- A10: this change marks the tracks paused in `ideas/courses.md` and says so in the
  `courses` bullet of `AGENTS.md`.
- A11: order after this change: a vision grill, a theme and foundations grill,
  components, one view, the pane view, one pane, then the lock.

### Open

- Whether the old app's screens are rebuilt one for one or rethought: for the vision
  grill.
- What the new folder is called (assumed `web/src/design/` for the system and
  `web/src/units/` for units; the builder may propose better).

## Reversals

- `ideas/views-gallery.md` and `ideas/grill-skill.md` (D1, D6, D13 there): `spec.md`
  and `grill.md` beside each view, drawn on `/views`, with a wireframes mode. Replaced
  by D3, D15, D16 and D17. Both files get a pointer here when this ships.
- `design/design-system.md`, "each component has a README": replaced by D16. The line
  is updated in this change to name both forms until the migration ends.
- `.agents/skills/pset-view/references/spec-template.md`: replaced by the spec above
  (D21).
- The 2026-09-17 overhaul decisions (ink and paper, the Primer-like component set,
  the type and colour tokens, Paper and Night, the mark), written in
  `design/design-system.md`: all open again under D24. Asked as a reversal; Jack
  chose "Redesign those too", then "Same thing for vision and theme."
- `ideas/courses.md`: tracks 1 on are paused (D22). The architecture in
  `ideas/courses-grill.md` stands.
- Within this grill: D13 (16 rules), D20 (Button and Settings) and D23 (freeze after
  the first pane, then a migration) were replaced by Jack's later answers.
- D5 here reversed Jack's first answer (shape only) after one push back.

## Disagreements

- Panes now: recommended a Panes tab holding today's homework as a stand-in. Jack
  chose no tab until a real pane exists (D20).
- Migration: recommended migrating everything in this change. Jack chose the format
  only, with a plan after (D20, D23).
- Unmigrated units: recommended showing every unit on the new page, marked not
  migrated. Jack chose to leave the old pages as they are (D19).
- Decisions: recommended drawing the table from `grill.md`. Jack chose typed
  decisions and no grill file (D15).
- Tracks: recommended leaving the dock as it is. Jack chose that it converts before
  it merges (D22).
- Foundations: recommended keeping the tokens and themes as given. Jack chose to
  redesign those too (D24).
- Freeze (earlier round): recommended freezing after the dock converts. Jack chose after the first
  real pane (D23).

## Frontier

Empty.

## Log

### Batch 0, triage

- Tier? **Grilled.**

### Batch 1, gate 1

- What is a unit's page mainly for? Both, from one source (Recommended) / Your review
  tool / The agents' brief. **Both, from one source.**
- What makes the current unit pages horrible? (multi) **Walls of prose, Example is
  poor, Nothing is connected, Hard to get around.**
- Panes exist only on the unmerged dock branch. How should this change handle them?
  Build the kind now (Recommended) / Wait for the dock / Branch from dock. **"we will
  land components, views now. The split/pane interface is a view, so we will build the
  pane view, then build out homework as the first pane, from scratch."**
- Beyond components, panes and views, what else lives at the one URL? **Foundations
  and Errors too (Recommended).**

### Batch 2, gate 1

- What does this change do about Panes in the meantime? Tab with today's homework
  (Recommended) / Design now, tab later / Empty tab. **"design now tab later. This is
  more about design a spec that will last the lifetime of this product. Where any
  future features can fit in one of the three buckets, be designed well, and stay
  homogenous in terms of design."**
- What is the one source for a unit's spec? **Typed spec file (Recommended).**
- How does a pane or view know its components? **Listed, and checked (Recommended).**
- How do the grilled questions and answers show? **Decisions table (Recommended).**

### Batch 3, gate 1

- One schema for all three kinds, or one per kind? **Shared core, small extras
  (Recommended).**
- Where do the behavior and UX rules live? **One rulebook, cited by id
  (Recommended).**
- What else belongs on a unit's page? (multi) **Actions and where they lead, Data and
  loading, Inputs.** (Not picked: Known problems.)
- How much moves to the new format in this change? Everything that exists
  (Recommended) / A few exemplars / Everything, plus the real screens. **"this change
  specifcally is just the new formats. When we are done you will write me a plan for
  migrating to the new spec system as efficiently and correctly as possible."**

### Batch 4, gate 1

- Is the recap right, and which units get a fully worked spec? Recap right, three
  exemplars (Recommended) / plus a real screen / one exemplar. **"recap right, three
  exemplars, one for each."**
- Until the migration, what does a unit without a new spec show? New page, marked not
  migrated (Recommended) / Old pages stay as they are. **Old pages stay as they are.**
- What is the one URL called? **"/design, old urls do not need to redirect, we will
  completley wipe the old system of the face of the repo when we are done"**
- Which example tools stay? (multi: call log, speed, wireframes, focus) **"what do you
  think? Can we redesign so we don't need focus? No need for the rest."**

### Batch 5, gate 1

- One exemplar per kind means a pane exemplar, but no Panes tab until a real pane
  exists. Which is it? Today's homework as a stand-in (Recommended) / A written pane
  spec, no tab / Two exemplars only. **Two exemplars only.**
- Which whole screen is the view exemplar? **Settings (Recommended).**

### Batch 6, gates 3 and 4

- Where does a unit's decisions table come from? Read from the grill file
  (Recommended) / Typed in the spec / Typed, and the grill file goes. **Typed, and the
  grill file goes.**
- How is "no walls of prose" kept true? Hard limits, tested (Recommended) / Shape only
  / Limits as a warning. **Shape only.**
- How big is the rulebook, and what happens to the design system doc? **Seed it,
  design doc stays (Recommended).**
- Does `spec.ts` replace the README? **Yes, the spec replaces it (Recommended).**

### Unprompted, during batch 6

- **"The main things I am looking for with the preview is spotting immediate UI issues
  (e.g. text overflow, spacing, padding, location, etc), making sure that its can
  gracefully load with skeletons no matter the variant, the flow of a students work,
  and check the general feel of the UI."**

### Batch 7, gate 3

- Should the spec force every unit to prove it loads gracefully? **Required when it
  reads data (Recommended).**
- Should every unit supply worst-case content? **Required for all (Recommended).**
- Push back on length: keep shape only? Add generous limits / Keep shape only. **Add
  generous limits.** (Reopens D17: a test fails on clearly long fields, about 200
  characters for purpose and 160 for any other line.)

### Batch 8, gate 4

- When do the grill and pset-view skills switch to the new format? **In this change
  (Recommended).**
- Which courses tracks must use the new format? Every track not yet started
  (Recommended) / The dock too / None until the migration. **The dock too.**

### Batch 9, lasting the product's life

Jack: **"Anything that could bite me in the butt later and cause another migration of
everything? I am trying to avoid having to mess with this spec again."**

Told him, to be built in unless he objects (he did not): every spec goes through one
`defineSpec()` and new fields are optional; `spec.ts` is plain data, with the live
states in a file beside it; state data comes from typed builders on the real API
types; rule ids and decision ids are permanent, and a decision can be marked
superseded. Also: "the grill file goes" applies to unit grills only, since other
grills have no spec to hold decisions.

- What decides which bucket a unit is in? **A testable rule (Recommended).** A view
  owns a route, a pane opens in the dock, everything else is a component. Kind is one
  field.
- Where do flows that span units live? **Steps can point at any unit (Recommended).**
- When does the format freeze? After the dock converts (Recommended) / When this
  change merges / After the first real pane. **After the first real pane.**

### Unprompted, after batch 9

Jack: **"What would be the most effective way to show how views, panes, and components
interact? The current "flows" or "entrance" and "exits" section, or something else?
What's your thought?"**

My answer (a proposal, not yet his decision; he judges it on the mockups): write each
link once, as an action with a typed target (unit and state). Derive exits, entrances
and used-by from the actions and the components lists. Show them as one neighbourhood
map per unit page (leads here, leads to, inside, made of), every box a link. A flow is
an ordered list of action ids, playable on the example. No hand-written entrances or
exits. A whole-app map can be drawn later from the same data.

### Batch 10, guards against straying

Jack: **"One last check, are there any sections of this spec that are missing that
would allow a design to stray from my intended vision?"**

Folded in without a section (told him): an action carries its exact label and its
shortcut key; a state carries the exact text it shows when empty or failed; each rule
has a "how to check it" line.

- Which of these sections join every unit's spec? (multi: Never, Priority, Sizes,
  Budget) **"shouldn't never just be a rule in the rulebook? same with budget."**, with
  all four ticked.
- When are the rulebook's rules decided? **Its own grill, before the freeze
  (Recommended).**

Jack, during batch 10's follow-up: **"We'll hit the main design rules now, and expand
the list as we make progress on the migration."** (Replaces "its own grill, before the
freeze".)

Answered him on Never and Budget: they are rules, not sections. A rule has a kind
(always, never, limit); a unit cites global rules and adds local ones.

### Batch 11, gate 2, on the built mockups

Mockups at `/design-mock/<a|b|c>/<component|pane>`, real components, sample content.

- Which arrangement is a unit's page? A, example on top / B, side by side / C, contact
  sheet. **A, example on top.**
- Does the neighbourhood map replace hand-written entrances, exits, components and
  used-by? **Yes, the map (Recommended).**
- Is that the starting rulebook? These 16 (Recommended) / All 45 now / Only the five
  vision rules. **These 16 (Recommended).**

### Batch 12, tail

- Getting around, as in the mockup? **Yes, as mocked (Recommended).**
- If this change had to be half the size, what goes? **Nothing, build it all
  (Recommended).**

### After the mockup review

Jack: **"Take a deeper look at the UI on the new designs page. There are some issues.
With spacing, alignment, and more. Take a look and fix what you can"** Three rounds of
fixes to arrangement A followed (commits f351cb9, fdb1251 and one more).

Jack: **"Actually wipe the rulebook clean, we will start from scratch redesigning every
componenent from scratch. Building views+panes as we need them and as we have the
componenents for them."**

### Batch 13, starting from scratch

- Does "from scratch" include the foundations (locked 2026-09-17)? Keep them as given
  (Recommended) / Re-confirm them first / Redesign those too. **Redesign those too.**
- Where do the redesigned components live while both exist? **A new folder, switch
  over later (Recommended).**
- What happens to the courses tracks? **Pause them (Recommended).**
- What proves the format in this change? One redesigned component (Recommended) /
  Nothing: ship it empty / A throwaway sample unit. **"we will freeze the spec once you
  are done. Then I will work on adding enough components for a view, the pane view,
  and one pane. Then we will make any changes in that process then finally lock the
  spec. Alright idea?"** Answered yes; proposed a sample component as a test fixture
  at a hidden address so he can see the page (assumed, D20).

Jack, unprompted: **"Same thing for vision and theme."**

### After the OK

Jack: **"One final add, one part of the grill should be (when required or asked) it should do some light preliminary research on what big companies do (especial GitHub since we use its theme). That will influence the grills reccomeneded decisions where applicable."** (D25.)
