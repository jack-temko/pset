# Fable review design calls: grill

- status: awaiting OK
- date: 2026-11-09
- brief: the eight design calls from the Fable 5.2 UI review of /design, judged from the tired student's point of view
- sources: Fable's review (pasted by Jack, 2026-11-09); the spec.ts and log.md of course, home, work, settings, memory, list, tabs, confirm, material, ask; jack-temko/pset#65 (the review's bugs and small wins)

## Summary

### In one line

The work comes first on Course and Home, each kind of moment (undo, confirm) has one shape, and Settings and the workspace say less and line up.

### Decisions

| #      | Decision                                                                                                                                                                                                                                     | Why                                                                                                                 | Beat                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| D1     | Course reads: name and line, Assignments, Materials, the stats box, memories.                                                                                                                                                                | The one active assignment was below the fold under a 250px box.                                                     | The box first, as on Home; a smaller box first |
| ~~D2~~ | ~~Home reads: greeting, Assignments, Courses, the stats box.~~ Reopened: see D12.                                                                                                                                                            |                                                                                                                     |                                                |
| D12    | Home keeps the stats box first: greeting, the box, Assignments, Courses. Only Course puts the work first.                                                                                                                                    | Jack, after seeing it built: "I want the stats at the top on just the home, I just like it too much."               | Assignments first on Home too (D2)             |
| D3     | The work pane's header is one unboxed line, 44px (`--ds-row`): due tag, "Due Thu", time left muted, the menu at the right. No assignment name. Always one line.                                                                              | "Problem set 4" showed three times in 130px; the boxed line shrank when time left went, moving everything under it. | One line keeping the name; as is               |
| D4     | Undo is the row in place in every list: the row becomes "Forgot ... · Undo" (Memory joins Course) for 10 s. The work pane's floating box stays, the removed problem having no row, but lasts 10 s. Ask's Remembered row is already in place. | One shape where the thing was.                                                                                      | One toast everywhere; the four shapes          |
| D5     | Every confirm is the Confirm popover under its button, the action first and Cancel rightmost: Ask's Clear opens it; Material's boxing reads Done, Cancel.                                                                                    | One shape per level of asking (friction-matches-loss).                                                              | Only the order fixed; no change                |
| D6     | Settings checks: "Working" is muted text, only "Failing" is a tag; tags sit at the row's right edge with the fix to their left, 12 apart; the Health line uses Error notice's line when a check fails.                                       | With no key, the only alarm was one small tag among four "Working" pills.                                           | Pills kept, Health line only; as is            |
| D7     | Settings' Save is primary only while the key field holds an unsaved edit; otherwise outlined.                                                                                                                                                | The page's one blue thing should be the next thing to do.                                                           | Always primary                                 |
| D8     | The "Reset everything" row's button is outlined; the solid red is the danger dialog's final button only.                                                                                                                                     | Nothing shouts until it is meant.                                                                                   | A solid red row button                         |
| D9     | "Clear all" sits at the right end of the "Recent errors (3)" line; the version reads "PSet 0.2.1".                                                                                                                                           | As the Adds sit across from their headings on Course (course-d27); the name as written everywhere.                  | Clear all under the list; "pset"               |
| D10    | In the workspace the top bar, the first tab's label and the pane's content start at 24px; a tab is its label and its x, down to a smaller minimum.                                                                                           | Three left edges (40, 12, 24) and a 60px gap in a short tab.                                                        | One edge with the 112px minimum; no change     |
| D11    | Loading lists (item 7) go to the skeleton grill, with Fable's version as its first input: the real List frame with two bars a row at the last known count, titles and headings drawn real, the crumb from the link that was clicked.         | It is that grill's question: each component owns its skeleton.                                                      | Deciding it here                               |

### The artifact(s)

The order of the two pages, top to bottom:

| Course                                | Home (D12)                    |
| ------------------------------------- | ----------------------------- |
| Path, name, the line under it         | Path, greeting                |
| Assignments (switch, cap 5, Show all) | The stats box                 |
| Materials                             | Assignments (cap 5, Show all) |
| The stats box                         | Courses                       |
| Memories fold (hidden at none)        |                               |

### Assumed

- A1: The Settings Save that turns primary goes back to outlined once the key is saved.
- A2: The tab minimum in D10 is the label's width plus the x and 12px either side; the row still scrolls with a fade when tabs run out of room (tabs-d3 otherwise stands).
- A3: The work pane header keeps its due tag colours and its menu items as they are.

### Open

- Item 7, loading lists: the skeleton grill, after this build lands.

## Reversals

- **course-d23's place in the page** (course/spec.ts, 2026-10-22, "same as home, we need to keep cross page uniformity where possible"): the box stays Home's own but comes after the lists on Course; Home keeps it first (D12). Approved as D1.
- **work-d8, "keeps the name"** (work/spec.ts, 2026-10-21): the header drops the name. Approved as D3.
- **settings-d21's left-aligned tags** (settings/spec.ts, 2026-11-05): tags move to the row's right edge, and "Working" stops being a tag. Approved as D6.
- **memory-d2's undo line and work-d2's six seconds**: the row in place and 10 s. Approved as D4.
- **ask-d7's inline confirm** (assumed there, A5): the Confirm popover. Approved as D5.
- **tabs-d3's 112px minimum**: smaller. Approved as D10.

## Disagreements

None.

## Frontier

Empty.

## Log

### Batch 1

- Course (item 2): should Assignments come above the stats box? Options: Assignments first (Recommended) / Keep the box first / Box first, but smaller. **"Assignments first (Recommended)"**
- Work pane header (item 4): drop the name from the header? Options: One line, no name (Recommended) / One line, keep the name / Keep it as is. **"One line, no name (Recommended)"**
- Undo (item 10): make it one? Options: Row in place, 10 s (Recommended) / One toast everywhere / Keep the four. **"Row in place, 10 s (Recommended)"**
- Confirms (item 19): make them one shape? Options: Confirm popover, act first (Recommended) / Only fix the button order / Leave both. **"Confirm popover, act first (Recommended)"**

### Batch 2

- Now that Course puts Assignments first, should Home do the same? Options: Yes, Assignments first on Home (Recommended) / No, Home keeps the box first. **"what are your honest opinions on this?"** Answered: move it, Home being the weaker case; the case for keeping it (Home as the overview, the greeting naming the next assignment) given in full; the greeting is plain text, so the work still needs a scroll. Asked again in batch 3.
- Settings checks (item 8)? Options: Working as plain text, Failing loud (Recommended) / Keep pills, add the Health line / Keep as is. **"Working as plain text, Failing loud (Recommended)"**
- Settings Save (item 11)? Options: Blue only with an edit (Recommended) / Always blue. **"Blue only with an edit (Recommended)"**
- Settings Reset (item 11)? Options: Plain button, red in the dialog (Recommended) / Keep it red. **"Plain button, red in the dialog (Recommended)"**

### Batch 3

- Home order? Options: Assignments first on Home too (Recommended) / Keep the box first on Home / Box first, greeting links. **"Assignments first on Home too (Recommended)"**
- Workspace edges (item 14)? Options: One 24px edge, tabs fit (Recommended) / One edge only / Leave it. **"One 24px edge, tabs fit (Recommended)"**
- Loading lists (item 7): now or in the skeleton grill? Options: In the skeleton grill (Recommended) / Decide now: Fable's version. **"In the skeleton grill (Recommended)"**
- Settings tidy-ups (item 11)? Options: Take both (Recommended) / Only the name / Neither. **"Take both (Recommended)"**

### After the build

- Jack, on seeing Home with the lists first: **"I want the stats at the top on just the home, I just like it too much"**. D2 reopened; D12 keeps the box first on Home.
