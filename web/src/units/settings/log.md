# Settings: log

Built from `ideas/settings-view-grill.md`, a reverse grill: Claude wrote the questions (G1 to G12) and picked every answer; Jack answered them on 2026-10-30 and the build follows his answers. The word-for-word log is in that file. What he changed:

- G1: he asked "what do you think about the width and height? How long should the settings page be until we separate it by page? Should we have side nav?" and chose "Yes, four groups, one page (Recommended)": 1012 wide, four groups, a name and a line on the left and the control on the right, no side nav, about 1.5 screens.
- G2: "Try to collapse the categories slightly. Organize in the way you think best". The four groups: You, Model, PSet, Reset.
- G9: he asked "how does github do this? I know they have two types of verisions, where one is the conformation box where you type the name of the repo. Whats the best option for destructive actions in pset? One type? more than one type?" and chose "Three levels (Recommended)": Undo, a small confirm, a typed dialog. This made the `danger-dialog` unit and the rule `friction-matches-loss`.
- G3, G4, G5, G6, G7, G8, G11 and the path and heading: his recommended answers, no change.

Decisions that say "assumed" are the ones he was not asked (the words, loading).

## 2026-11-04: fields centred, their state in the hint line

Jack's annotations: "The way the button and the text on the left is aligned is the way I want, how can we make this text box in the middle vertically of the two lines of text?" and, on the key, "I'd rather center this vertically and find a different way to show the state. Same issue as the Name." Asked where the state goes, he chose "In the hint line (Recommended)". The Name and key fields now sit centred like Check for updates; "Saved" and "The key works." replace the hint for 2 s in green, and a failure replaces it in red until the key is edited (settings-d18).

2026-11-04, Jack asked what the rules were for outlined buttons (the Remove buttons, the row menus and the menu beside the course name) and chose "Rows and heading quiet (Recommended)": a control repeated on every row, or a menu beside a heading, is quiet (no outline, a hover tint); an outline stays on standalone actions. New rule quiet-when-repeated.
