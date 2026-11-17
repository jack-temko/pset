# Actions, conditions and your place: grill

- status: awaiting OK
- date: 2026-11-17
- brief: three layers that sit on the change log and the step runner of `ideas/backend-courses-grill.md`: one catalog of what a student can do, health as live conditions, and the student's place kept on the server; judged from an ordinary student doing this week's work
- sources:
  - `internal/settings/health.go` on `dev` (four checks, run when asked)
  - `origin/design:web/src/lib/panes.ts`, `theme.ts`, `last-count.ts`, `eta.ts` (browser storage, one file each)
  - key handling across `origin/design:web/src` (per component; no palette)
  - `ideas/backend-courses-grill.md`, `ideas/errors-grill.md`, `origin/design:ideas/screens-grill.md` (S8), `ask-pane-grill.md` (K4)

## Summary

### In one line

Everything a student can do is one declared action (with a key, a palette entry, an
undo and what it needs), everything PSet depends on is a live condition, and where the
student was is kept on the server by one rule.

### Decisions

| #   | Decision                                                                                                                                                                                                   | Why                                             | Beat                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| C1  | Every action has a shortcut, and Ctrl+K opens a palette that lists and runs them, showing each key                                                                                                         | The catalog's visible payoff; it teaches keys   | Shortcuts only; neither yet                          |
| C2  | Shortcuts are single keys when the cursor is not in a text box (J and K between problems, D for done, H for the hint)                                                                                      | Fast for working down a set; Undo covers a slip | Always with Ctrl; a table Jack edits first           |
| C3  | The palette also goes to things by name: a course, a set, a problem number, a material's title. Names only                                                                                                 | A fast way across courses                       | Actions only; searching inside materials             |
| C4  | Ask runs an action it is asked for and shows a row, "Marked 1 to 3 done. Undo", as a remembered preference does. Only actions that can be undone and cost nothing; anything else it proposes with a button | Consistent with K4; Undo makes it safe          | Propose and confirm; Ask does not act                |
| C5  | A missing condition is said at the action it blocks, before the student tries: "Add a material" says PSet cannot read PDFs yet, with the fix. Nowhere else                                                 | Found out before choosing a file and waiting    | Only when it fails; a checklist and a notice on Home |
| C6  | Two tabs each go their own way: a tab reads the place once, when it opens                                                                                                                                  | Two tabs can show two things                    | Tabs that follow each other                          |
| C7  | Ctrl+Z on something not on screen undoes it where it is and says so: "Renamed back to Problem set 4. Show." The student is not moved                                                                       | Undo never pulls you out of a problem           | Going there; only what is on screen                  |

### The artifacts

**An action, as declared** (one entry each, in the package that owns it, generated to
TypeScript like the error catalog):

| Field    | Holds                                                                |
| -------- | -------------------------------------------------------------------- |
| id       | dotted, as errors are: `question.done`, `set.rename`, `material.add` |
| name     | what the palette and the button's hint call it                       |
| takes    | its typed input                                                      |
| key      | its shortcut, if it has one                                          |
| needs    | the conditions that must hold (a key, the PDF reader)                |
| undoable | whether its changes can be written back                              |
| costs    | whether it starts work that spends                                   |

From that one entry: its route, its undo, its key, its palette row, whether Ask may
run it (undoable and costing nothing) or only propose it, and the reason shown when
it is blocked.

**A condition**: an id, whether it holds, since when, and its fix (itself an action).
Conditions are resources on the change log. The first set: the key, credit, the
provider answering, the PDF and scan readers installed, the data folder writable,
the database sound, disk space, embeddings if they stay. One source for the Settings
health list, the "waiting on you" notices and what healing watches.

**The rule for what is remembered**

> PSet remembers where you were, how you laid it out, and what you had not sent. It
> never remembers what you were filtering by.

| Remembered, per thing                                                    | Not remembered                                                                            |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Where: the problem of a set, the page of a material, the line of a guide | Searches, filters, sorts and switches: a list always opens the same way                   |
| Layout: a course's sides, tabs and split; a material's zoom              | Anything open over the page: a menu, a dialog, the palette, a Details fold                |
| Unsent: a question typed into Ask, a half-typed note, a set being added  | The theme and loading shapes stay in the browser: they are about drawing, not the student |

Each belongs to one thing and goes when that thing goes. A new kind of state is placed
by asking which of the three it is; if none, it is not remembered.

### Assumed

- A1 (delegated, "pick a good strong rule ... and stick to it"): the rule and table above.
- A2: conditions are learned from what happens (a call that succeeds or fails, a key saved), checked at start and when Settings opens. The provider is not polled.
- A3: a health check's Fix is an action like any other.
- A4: a place is on the change log so a new tab finds it, but it is not an action: Ctrl+Z never moves you back a page.
- A5: how long each step took, kept in the browser today to guess the time left, comes from the `steps` table instead.
- A6: I draft the key for each action; the palette is the list to correct them in. Two actions never share a key on one screen, and a test checks.
- A7: an action applies on the page at once and rolls back if the server refuses, as today.

### Open

- The palette as a unit on `/design`: its own short design pass (how it lists, what it shows when empty, how a blocked action reads).
- The key for each action: drafted when the catalog is written.

## Reversals

None. Searching inside materials from the palette was offered and not taken, so
"search the book" stays on hold (`ideas/on-hold.md`).

## Disagreements

None.

## Frontier

Empty.

## Log

### Gate 0

Audit shown 2026-11-17: no list of actions and no palette, keys handled per component; four health checks run when asked; the arrangement, theme, loading shapes and step times each in browser storage through their own file. No facts corrected.

### Batch 1

- Actions UI. Options: Shortcuts and a palette (Recommended) / Shortcuts only / Neither yet. Answer: "Shortcuts and a palette (Recommended)".
- Ask acts. Options: Does it, with Undo (Recommended) / Proposes, you confirm / Ask does not act. Answer: "Does it, with Undo (Recommended)".
- Conditions. Options: At the action it blocks (Recommended) / Only when it fails / Up front, once. Answer: "At the action it blocks (Recommended)".
- Key style. Options: Single keys when not typing (Recommended) / Always with Ctrl / You decide per action. Answer: "Single keys when not typing (Recommended)".

### Batch 2

- Remembered (several could be chosen). Options: Zoom per material / An unsent Ask question / List choices / Scroll inside a guide. Answer: "This is for you to decide. Pick a good strong rule on when to remember, and stick to it."
- Palette. Options: Yes, by name (Recommended) / Actions only / Names and inside materials. Answer: "Yes, by name (Recommended)".
- Two tabs. Options: Each its own (Recommended) / They follow each other. Answer: "Each its own (Recommended)".
- Undo where. Options: Stay, and say it (Recommended) / Take me there / Only what is on screen. Answer: "Stay, and say it (Recommended)".
