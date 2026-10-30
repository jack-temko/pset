# Settings view: reverse grill

- status: approved (Jack answered every question on 2026-10-30; the build follows his answers)
- date: 2026-10-22
- brief: Settings (`/settings`), rebuilt from scratch in the new design, judged from a student who opens it rarely: to paste a key, switch to Night, update, or see why something broke. A reverse grill: Claude wrote the questions and picked every answer; Jack answered them and the build changes only where his answer differed
- sources:
  - `web/src/pages/settings/index.tsx`, `errors.tsx`, `updates.tsx` on `dev` (sections: You, Connections, Health, Errors, Updates, Appearance, Reset, the about line)
  - `ideas/screens-grill.md` (A5: health, errors, updates, the key and appearance stay in Settings)
  - `ideas/error-catalog-grill.md` (every error has an id, a reason and a fix; kept and listed in Settings)
  - `ideas/theme-grill.md` (Paper and Night)
  - `pset-haiku-usability/.dev/lab/findings.md` #5 (no cost total anywhere)
  - memory: desktop only

## Summary

### In one line

One page 1012 wide in four groups, You, Model, PSet and Reset, each row a name and
a one-line explanation on the left and its control on the right, about a screen and
a half tall.

### Decisions (every one now confirmed by Jack; CHANGE marks where his answer differed from the pick)

| #   | Question                  | Decided                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Why                                                                    | Other options                      |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------- |
| G1  | Layout                    | CHANGE. 1012 wide (Home's page width), four groups on one page, no side nav; each row a name and one line on the left and the control on the right (GitHub and macOS settings style), about 1.5 screens tall. Jack asked "what do you think about the width and height? How long should the settings page be until we separate it by page? Should we have side nav?" and chose "Yes, four groups, one page (Recommended)"                                                                                                                                                                                                                                                                                                                             | Under about two screens, one page beats a nav; Home's width matches    | 720 column; a side nav             |
| G2  | Order                     | CHANGE. You (name, appearance), Model (key with Test and Save, models folded, usage and cost), PSet (version and updates, health with recent errors folded, data folder), Reset (clear study history, reset everything). Jack: "Try to collapse the categories slightly. Organize in the way you think best"                                                                                                                                                                                                                                                                                                                                                                                                                                          | Seven sections become four                                             | Seven sections                     |
| G3  | Model key                 | Field, Test, Save, models folded. Confirmed by Jack: "Field, Test, Save, models folded (Recommended)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | The key is the task; the model list is curiosity                       | Model list always shown            |
| G4  | Health and Errors         | One Health row: a quiet line, the checks folded, recent errors folded with their ids. Confirmed by Jack: "Quiet line, checks folded (Recommended)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Both answer "is something wrong"                                       | Two sections                       |
| G5  | A cost total (finding #5) | Month, per course, all time. Confirmed by Jack: "Month, per course, all time (Recommended)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Nowhere shows a total today                                            | Per course only on the course page |
| G6  | Appearance                | Paper, Night and System as a three-part switch, applied at once. Confirmed by Jack: "Three-part switch (Recommended)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | As today, it works                                                     | A toggle; a dropdown               |
| G7  | Updates                   | The version, a Check for updates button, and the update in place. Confirmed by Jack: "Check button, update in place (Recommended)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | As today                                                               | Automatic updates                  |
| G8  | Saving                    | Fields save when you leave them. Confirmed by Jack: "Save on leave (Recommended)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Fewer buttons                                                          | A Save per section                 |
| G9  | Destructive actions       | CHANGE. Three levels (rule `friction-matches-loss`): undoable things (delete a set, remove a material, forget a memory) happen at once with Undo; clearing one kind of data (study history, kept errors) asks in a small confirm beside the button that counts what goes; irreversible wide things (delete a course, reset everything) open a dialog that counts what goes and asks the student to type the course name (or "reset") before its red button enables. Jack asked "how does github do this? I know they have two types of verisions, where one is the conformation box where you type the name of the repo. Whats the best option for destructive actions in pset? One type? more than one type?" and chose "Three levels (Recommended)" | The more a thing loses, the more it asks, so the small asks stay small | One confirm for all; always typed  |
| G10 | Words                     | Course words, not "book" (not asked, stays)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | The courses vocabulary                                                 | Keep "book"                        |
| G11 | Health all fine           | One quiet line with the checks folded under it. Confirmed by Jack: "Quiet line, checks folded (Recommended)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | The common case is quiet                                               | Always list the five checks        |
| G12 | Loading                   | The Loaded standard (not asked, stays)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | No jumps                                                               | Spinner                            |
| G13 | Data folder and heading   | The data folder stays at the foot of the PSet group and the page heading stays with the path. Confirmed by Jack: "Keep both (Recommended)"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Path is navigation, heading is identity                                | Drop either                        |

### The artifact(s)

**Top to bottom**: top bar (path "Home / Settings") · heading · You (name, appearance) · Model (key, models folded, usage) · PSet (version and updates, health with errors folded, data folder) · Reset (clear study history, reset everything).

**States**: all fine, no key yet (the key section first with a line "PSet needs a key to read and guide"), a key that failed its test, an update available, updating, a health check failing with Fix, errors kept, loading, failed to load.

### Assumed

Only what Jack was not asked (G10, G12). Sample data only; the existing endpoints stay as they are and wiring comes later.

### Open

None.

## Reversals

None.

## Disagreements

None yet.

## Frontier

None: every question is answered.

## Log

Jack answered on 2026-10-30, in batches. His words, verbatim.

### Batch 1 (layout and order)

- Layout (G1): Jack asked "what do you think about the width and height? How long should the settings page be until we separate it by page? Should we have side nav?" and then chose "Yes, four groups, one page (Recommended)": 1012 wide (Home's page width), four groups, You (name, appearance), Model (key with Test and Save, models folded, usage and cost), PSet (version and updates, health with recent errors folded, data folder), Reset (clear study history, reset everything). Each row: name and a one-line explanation on the left, the control on the right. No side nav. About 1.5 screens tall.
- Order (G2): "Try to collapse the categories slightly. Organize in the way you think best"

### Batch 2 (the key, health, usage, saving)

- Model key (G3): "Field, Test, Save, models folded (Recommended)"
- Health (G4, G11): "Quiet line, checks folded (Recommended)"
- Usage (G5): "Month, per course, all time (Recommended)"
- Saving (G8): "Save on leave (Recommended)"

### Batch 3 (appearance, updates, heading and path)

- Appearance (G6): "Three-part switch (Recommended)"
- Updates (G7): "Check button, update in place (Recommended)"
- Path and heading: "Keep both (Recommended)"

### Batch 4 (destructive actions)

- Danger (G9): Jack asked "how does github do this? I know they have two types of verisions, where one is the conformation box where you type the name of the repo. Whats the best option for destructive actions in pset? One type? more than one type?" and then chose "Three levels (Recommended)":
  1. Undoable (delete a set, remove a material, forget a memory): no confirm, happens at once with Undo (as built on Course).
  2. Loses one kind of data (clear study history, clear errors): the small confirm beside the button counting what goes (the existing `confirm` component, popover).
  3. Irreversible and wide (delete a course, reset everything): a dialog that counts what goes; the student types the course name (or "reset") before the red button enables. A new component, `danger-dialog`.
     He also asked for a rule, `friction-matches-loss`: the more a destructive action loses, the more it asks.
