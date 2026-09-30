# Grill skill

## Status

**In progress** (2026-09-30), on branch `grill-skill`. Grilled with Jack the way the
skill grills: audit, a weighted frontier, four questions a batch, recommendation first.
Tasks 1 to 4 are built (not merged: Jack is asked before any merge); task 5, the first
real grill, is a redesign of the homework panel with Jack.

## Two skills (Jack, 2026-09-30)

- **`grill`** (`.agents/skills/grill/`) is generic and knows nothing about views. It
  interviews the user about anything (a redesign, a feature, what to remove, an
  architecture choice, positioning or marketing) and writes the one-page spec. It has
  starter packs for those topics in `references/packs.md` and takes a **brief**.
- **`pset-view`** (`.agents/skills/pset-view/`, keeps its name) owns the view gates and
  the three modes, and calls `grill`, handing it the brief in
  `references/grill-stages.md`.

The interface is the brief: `topic`, `output` path, `viewpoint`, `locked` decisions
(with where they are written), and `stages` (gates, each with seeds, an artifact and an
exit test). `grill` returns a `grill.md` and stops for the user's OK; `pset-view` builds.

## Summary (glance)

**What it is.** A standalone `grill` skill that interviews the user until a spec is
ironed out, then writes one page they can read at a glance. `pset-view` uses it to
grill a view in gates before any code is written.

**The loop.** Audit alone, then repeat: build the frontier (every open question,
weighted), ask the top four in one batch, fold the answers in, rebuild the frontier.
Stop when the gate's high-weight questions are answered or the user says done;
everything left is taken at the recommended default and listed as assumed.

**The gates for a view** (each ends in a short recap you confirm before the next):

| Gate | Settles | Artifact you confirm |
|---|---|---|
| 0 Frame | what is true today (no design questions) | the audit brief |
| 1 Purpose and inventory | mission, what it shows, does, links, and never shows | mission sentence and inventory table |
| 2 Flow and layout | the flow, hierarchy, placement, A/B layouts | ASCII wireframe per state |
| 3 Behavior and states | interaction, feedback, empty, slow, failed, keyboard, Night, reuse | state and component list |
| 4 Data, backend, acceptance | data contract, backend wants, edge cases, what "done" means | data table, wants, scenarios and budget |

**Modes of pset-view, cut to three:**

| Mode | For | Grill |
|---|---|---|
| `redesign` | a view from scratch, or a new flow, layout or behavior (one mode: Jack treats them as the same) | all gates; gate 1 shrinks to a quick confirm when the purpose is clearly unchanged |
| `tweak` | bug fixes, small adjustments, one friction row | none (with no target it is the read-only audit) |
| `extract` | a view still inside its screen, put on `/views` unchanged | none: it moves the code verbatim, builds its simulated backend and scenarios, and writes a spec of what exists today |

After the spec the agent **stops for your OK**, then builds, verifies and documents.

## Decisions

| # | Decision | Why | Rejected |
|---|---|---|---|
| D1 | The record lives at `web/src/views/<name>/grill.md`, beside `spec.md`. | `/views` can render it beside the live view; an agent on the view finds both; it moves with the view. | `design/grills/`, `ideas/` |
| D2 | A standalone `grill` skill in `.agents/skills/grill/`, with pluggable stage banks; `pset-view` supplies the view banks. | The same procedure also grills backend features and new ideas; a view bank is view knowledge. | grill inside pset-view only; a fully generic grill with no banks |
| D3 | Five gates (0 to 4 above), each ending in an artifact the user confirms. Jack delegated the choice. | Artifact-anchored gates stop later stages drifting from unchecked earlier ones; cheap, high-leverage decisions come first; a later answer that contradicts an earlier gate reopens it. | one continuous frontier; three ungated stages |
| D4 | Audit first: read the view, its spec, friction log, design docs and code; ask only what the code cannot answer; every question carries a recommended option with its reason. | The user confirms or overrules instead of authoring. | neutral options; asking blind |
| D5 | A gate ends when its high-weight questions are answered or deferred; the rest is taken at the recommended default and listed as **assumed**. | Bounded length at 1am; assumptions are visible and overrulable. | exhaust everything; a fixed number of batches |
| D6 | The summary sits at the top of `grill.md` and `/views` draws it. | One place to glance; no second file to keep in step. | a phone Artifact each time; a separate spec file |
| D7 | An answer that contradicts a locked design decision is asked as an explicit reversal ("this reverses X, dated D; reverse it?"). If yes, the reversal and reason go into `grill.md`, the view's `why` and the design doc. | Better designs can win, and nothing is reversed quietly. | never re-ask locked decisions; treat everything as open |
| D8 | Each grill is fresh (redesigns and rewrites dominate). | Jack's call. | resume only stale questions; always overwrite |
| D9 | pset-view has three modes: `redesign`, `tweak`, `extract`. `redesign` covers from scratch and rework (Jack: the same thing for his use); `extract` is the old `new`, since a view cannot be redesigned until it is on `/views`. | Jack asked to cut modes to a few and to have one suggested. | the old six modes; separate `rebuild` and `redesign`; `audit` as a mode (it is `tweak` with no target); `review` as a mode (it is a step of `redesign`) |
| D10 | After the spec, stop for Jack's OK, then build. | A misread decision costs less on a page than in finished code. | build automatically; build a slice per gate |
| D11 | If an answer looks worse for the tired student than the recommendation, push back once with the reason, then record the answer and the disagreement. | Design sense gets one hearing; it never argues at 1am. | never push back; keep pushing |
| D13 | Wireframes are **built from the real component library** on static sample data and shown under a Wireframes mode on `/views`, never drawn in ASCII. Layout options are separate labelled wireframes on one page. | Jack: the ASCII ones were "all butchered"; his own components are the design language, and the user can lift veils and open menus. | ASCII wireframes in the ask tool's previews |
| D12 | Extras included: a **student walkthrough simulation** (the agent walks a wireframe as the tired student and reports where it gets stuck, before Jack sees it); a **post-build review round** (photos of the real view and a short mini-grill on what feels off); a **cross-view consistency check** (same concept named and placed the same way elsewhere, and every handoff's target exists and accepts what it is sent). Never-show list and rejected alternatives per decision are always in. | Jack picked these. | designing for more student moments than the tired one |

## Assumed (overrule any at a glance)

- **A1** The previous grill is archived to `web/src/views/<name>/grills/<date>.md` when a new one starts. (D8 said fresh; archiving is cheap and reversible.)
- **A2** Weight = cost to reverse x number of later decisions it unlocks x uncertainty (how many plausible options, how unsure the recommendation is). Ties go to the question that blocks others.
- **A3** A batch is at most four questions (the ask tool's limit), two to four options each, recommended first and marked. A layout choice shows ASCII wireframes in the option previews.
- **A4** A free-text answer ("Other") is read as new information: it can settle several questions and add new ones to the frontier.
- **A5** A harness without an ask-user tool gets the same batch as a numbered list in chat, with the same options and the same recommended first.
- **A6** The grill file is Markdown with fixed headings: Summary, Mission, Inventory (shows, does, links, never shows), Wireframes, Decisions, Assumed, Open, Reversals, Disagreements, Frontier (what is left), and the Q&A log, verbatim, by batch.
- **A7** Gate 1's mission is one sentence: "For the student <moment>, this view lets them <job> so that <outcome>", plus "It is not for <x>". Jack amends it at the gate.
- **A8** The tired student (hour 7, 1am, Night) is the design persona; the walkthrough simulation uses it. Other moments are noted in `open`, not designed for.
- **A9** The grill is for views first; a bank for backend features can follow, using the same procedure.
- **A10** Nothing is written into the repo except `grill.md` (and its archive) and, after Jack's OK, the changes the spec calls for.

## Information

A note on words: the grill is **not a program**. It is a skill, which is a set of
Markdown instructions the model loads as context: a procedure to follow (audit,
build the frontier, ask a batch, fold in the answers, repeat) and a file format to
write. The asking itself is the harness's own ask-user tool. The only code in this
plan is task 4, the `/views` tab that displays a finished `grill.md`.

Where this came from. The pilot run of `pset-view` (`views-gallery.md`) found and
fixed a real bug from the tired student's flow, but it decided things alone that
Jack would rather have decided: the friction log was the brief, and the agent chose
the fix. For a redesign the decisions come first and are Jack's, so they are asked,
in the order that cheapens the rest, and written down once. The same reasoning as
`ideas/README.md`'s grills, made repeatable.

What the skills are made of:

```
.agents/skills/grill/
  SKILL.md                     the loop, the rules, when it stops
  references/frontier.md       building and weighting the frontier; question craft
  references/grill-file.md     the grill.md format, heading by heading
  references/packs.md          starter gates and seeds: redesign, feature, removal,
                               architecture, positioning
  references/fallback.md       running without an ask-user tool
.agents/skills/pset-view/
  references/grill-stages.md   the view gates: questions to ask, artifact and exit
                               criterion for each, the walkthrough simulation,
                               the cross-view check, the post-build review
```

Question craft the skill must encode: a question names one decision; options are
distinct, not trivial variants; the recommended option comes first with its reason;
descriptions say what the choice costs the tired student; layout options carry
wireframes; anything the code already answers is not asked.

What is still open: the exact weights (A2 is a starting formula, tune it from the
first real grill); whether `/views` shows the summary above the spec or in a tab.

## Tasks

- [x] 1. (opus) The grill procedure as a standalone skill
  - Files: `.agents/skills/grill/SKILL.md`, `.agents/skills/grill/references/frontier.md`, `.agents/skills/grill/references/grill-file.md`, `.agents/skills/grill/references/fallback.md`, `.agents/skills/grill/references/packs.md`
  - Do: write the skill from D2 to D8, D11 and A2 to A6: audit, frontier, weighted batches, the done rule, push back once, the file format, the fallback for harnesses without an ask-user tool. Frontmatter with `name` and `description`; short `SKILL.md`, detail in the references. `.claude/skills` already links `.agents/skills`.
  - Done when: the skill lists in a fresh session; a dry run on a toy topic produces a `grill.md` with every heading in A6 and a summary a person can read in under a minute.
- [x] 2. (opus) The view gates for pset-view
  - Files: `.agents/skills/pset-view/references/grill-stages.md`, `.agents/skills/pset-view/references/spec-template.md`
  - Do: gates 0 to 4 as in the table, each with its question templates, artifact and exit criterion; the student walkthrough simulation before wireframes go to the user; the cross-view consistency check; the post-build review round. Add `mission` and `inventory` to the spec template.
  - Done when: each gate names what it asks, what the user confirms, and when it ends; the template has the new sections.
- [x] 3. (opus) pset-view: three modes (redesign, tweak, extract), grill first, stop for OK
  - Files: `.agents/skills/pset-view/SKILL.md`, `.agents/skills/pset-view/references/verify.md`, `.agents/skills/pset-view/references/student-lens.md`
  - Do: replace the six modes with `redesign`, `tweak`, `extract` (D9); `redesign` runs the grill and stops for OK (D10); `tweak` with no target is the read-only audit; `extract` is the old `new` (keep its steps from `mock-layer.md`); the loop gains the post-build review round; keep the guardrails and the lessons of the first run.
  - Done when: the loop reads end to end without a reference to a removed mode; `AGENTS.md` mentions the grill skill.
- [x] 4. (sonnet) /views draws the grill summary beside the spec
  - Files: `web/src/pages/views/index.tsx`, `web/src/views/registry.ts`, `web/src/views/types.ts`, `web/src/views/README.md`
  - Do: a view may carry `grill.md` (loaded `?raw`); `/views/<name>` shows its Summary section above the spec, under a Grill tab or heading (open: see Information).
  - Done when: a view with a `grill.md` shows its summary on `/views`, in both themes; one without shows nothing new; typecheck, lint and tests pass.
- [ ] 5. (opus) The first real grill: `pset-view redesign` on the homework panel, with Jack
  - Files: `web/src/views/homework/grill.md`, `web/src/views/homework/spec.md`
  - Do: run the skill for real, in gates, with Jack answering; write the summary; stop for his OK.
  - Done when: `grill.md` has a summary Jack can read at a glance and every decision has a reason; corrections found are written back into the skills.
