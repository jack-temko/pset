# Spec format: grill

- status: awaiting OK
- date: 2026-10-22
- brief: lock the unit spec format (`web/src/design/spec.ts`) now that a view (Home), a pane view (the workspace) and a pane (work) have been built with it (S12); judged from whoever reads or builds a unit next, Jack first
- sources:
  - `web/src/design/spec.ts`, `web/src/design/checks.ts`, `web/src/design/checks.test.ts`
  - `web/src/pages/design/sections.tsx`, `web/src/pages/design/stage.tsx`
  - the specs of `home`, `workspace`, `work`, `tabs`, `heatmap`
  - `ideas/screens-grill.md` (S12), `ideas/vision-grill.md` (A3: frozen format), `ideas/workspace-grill.md` (W8, W18), `ideas/work-pane-grill.md`
  - memory: desktop only, no small screens (2026-10-21)

## Summary

### In one line

The spec keeps only what the code cannot say for itself, its exact text is checked
against the render, and from now on it changes only through its own grill.

### Decisions

| #    | Decision                                                                                                                                         | Why                                                                       | Beat                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------ |
| F1   | `sizes.narrowest` goes; `sizes` keeps only "gives way first", the ordered list of what shrinks or scrolls when a side gets narrow                  | Desktop only; a side still narrows inside the workspace split             | Drop sizes entirely; keep narrowest        |
| F2   | A state's exact `text` is checked: a test renders the state and fails when the text is missing. The `when` prose stays short, reviewed by eye      | The work pane's summary still claimed a due date after say-it-once       | Review by eye only; cut prose to one line  |
| F3   | No skeleton prose at all, per unit or per state. The required skeleton render per state is the spec                                                | The render is what Jack looks at; the sentence repeated it 8 times        | One sentence per unit; one per state       |
| F4   | Decisions keep their full history; the design page shows those in force and folds the replaced ones away                                          | Work has 19, workspace 15; the current ones should read first             | Current only; flat list                    |
| F5   | Once locked, the format changes only through its own small grill and one PR that updates every spec and the checks together. New fields optional  | No unit drifts onto a private variant                                     | Additive without a grill; frozen till data |
| F6   | New optional `remembers` section: what is kept, per what (set, course, material), for how long. Shown on the design page                         | keep-the-place becomes readable: problem and summary per set, arrangement | Leave it to decisions                      |
| F7   | Input names are checked against the component's props, both ways                                                                                | Inputs were hand written and could drift                                  | Prose only                                 |
| F8   | A data `call` is marked sample until the unit is wired; once wired, the check fails if it is not an endpoint in the generated API types           | The spec stays true when Home and the workspace meet the server           | Prose forever                              |
| F9   | Cut: the `components` list (the design page lists them from the imports), input `type` and `default` (TypeScript has them), the action `key` (no shortcuts, W18), data `waiting` and `failed` (the states hold them) | Each repeated something the code or another field already holds           | Keeping them, typed by hand and checked    |
| F10  | Home's narrow-width code (360 states, narrow skeleton heights) is stripped in this change                                                        | It dies with `narrowest`; the change already edits every spec             | A separate cleanup PR                      |
| F11  | Home keeps its repeats, with a reason recorded under say-it-once: the greeting's due line answers "when is the next one due" without reading Assignments; "this week" on Home and per course are never on screen together | Jack: the repeats earn their place                                        | Fixing them, A/B'd                         |

### The artifact(s)

**The locked format** (page order; * = required)

| Field              | Holds                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------- |
| id*, kind*, title*, group* | as today                                                                        |
| purpose*           | one sentence                                                                            |
| states*            | id, name, when (short prose), text (exact, checked against the render)                 |
| stress*            | the worst case, one line                                                                |
| flows              | pane and view: journeys as action ids                                                   |
| actions*           | id, label, does, target                                                                 |
| data               | reads, call (`sample` until wired, then checked against the API types)                  |
| remembers          | new: what, per what, how long                                                           |
| inputs*            | name (checked against props), does                                                      |
| priority*          | first, main                                                                             |
| sizes*             | gives (ordered)                                                                         |
| rules*             | cite, local                                                                             |
| decisions*         | as today; replaced ones folded on the design page                                       |
| exampleWidth, log  | as today                                                                                |

Gone: `sizes.narrowest`, state `skeleton` prose, `components`, input `type` and
`default`, action `key`, data `waiting` and `failed`. The design page lists a unit's
components from its imports. Every unit's spec is updated in the same PR, and the
work pane's summary state loses its stale due date.

### Assumed

- A1: `rules.local`, `Target` and `flows` stay as they are; nothing in the three builds strained them.
- A2: the format lives in `web/src/design/spec.ts` with its comments as the reference; no separate doc.
- A3: a state with no `text` is fine; the text check runs only where `text` is given.
- A4: the third Home repeat, the due tag beside the due date in a row, is kept with the reason that the tag gives the urgency at a glance and the date gives the exact day. Jack gave reasons for the other two, not this one.

### Open

- None for the format. Next by S12's order: the material pane and Ask pane grills, then wiring Home and the workspace to real data.

## Reversals

None of a locked decision. F3 replaced Jack's own earlier answer in this grill (one
skeleton sentence per unit) when he was asked whether the sentence could go entirely.

## Disagreements

None.

## Frontier

Empty.

## Log

### Batch 1

1. The spec requires a 'narrowest width' for every unit, which goes against desktop-only. What should replace it? Options: Keep only 'gives way first' (Recommended); Drop sizes entirely; Keep it as is. Answer: "Keep only 'gives way first' (Recommended)"
2. The spec's prose drifted from the build (the summary state still claims a due date). How do we keep them honest? Options: Check exact text against the render (Recommended); Review by eye only; Cut the prose to one line. Answer: "Check exact text against the render (Recommended)"
3. Every state repeats its skeleton sentence, often word for word. Change it? Options: One per unit, override per state (Recommended); Keep one per state. Answer: "One per unit, override per state (Recommended)"
4. The decision lists are long (19 on the work pane). What should a spec's decisions hold? Options: Current ones shown, replaced ones folded (Recommended); Current ones only; Keep as is. Answer: "Current ones shown, replaced ones folded (Recommended)"

### Batch 2

1. Once locked, how can the format change? Options: Own small grill and PR (Recommended); Additive only, no grill; Frozen until real data is wired. Answer: "Own small grill and PR (Recommended)"
2. The work pane and workspace remember things (problem per set, the summary as a place, the arrangement). Should the spec say so? Options: Add a 'remembers' section (Recommended); Leave it to decisions. Answer: "Add a 'remembers' section (Recommended)"
3. Inputs are written by hand and can drift from the component's real props. Check them? Options: Check names against the props (Recommended); Leave as prose. Answer: "Check names against the props (Recommended)"
4. The data section names a call (like a server endpoint) that does not exist yet. When wiring to the server, how strict? Options: Checked against the API once wired (Recommended); Prose forever. Answer: "Checked against the API once wired (Recommended)"

### Batch 3

1. Home's leftover narrow-width code (360px states, narrow skeleton heights) dies with 'narrowest'. Strip it in this change? Options: Yes, in this change (Recommended); Separate cleanup PR. Answer: "Yes, in this change (Recommended)"
2. Home says some things twice (due tag beside the due date; the greeting's due line repeats the first Assignments row; 'this week' time in the stats and per course). Fix under say-it-once? Options: Separate small change, A/B'd (Recommended); Fix in this change; Leave them. Answer: "leave them, but justify them. the below greeting is so you instantly know when the next one is due without looking at assignments. For the this week time, since they are not on the same page and not viewable at the same time its ok"

Jack, mid-batch: "anything not needed or not useful to you that can be cut?"

### Batch 4

1. Which spec fields should go? Each repeats something the code or another field already holds. (multi) Options: Components list; Input type and default; Action shortcut key; Data 'waiting' and 'failed'. Answer: all four.
2. Skeletons: you picked one sentence per unit, but each state already needs a skeleton render, which the design page shows. Cut the sentence too? Options: Cut it, the render is the spec (Recommended); Keep one per unit. Answer: "Cut it, the render is the spec (Recommended)"
