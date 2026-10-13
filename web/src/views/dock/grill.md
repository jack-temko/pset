# The dock: grill

- status: built
- date: 2026-10-13
- brief: the first dock, track 1 of `ideas/courses.md`: the split screen a course's work happens in, judged from the tired student's point of view (hour 7, 1am, Night theme, glancing between a material and the work)
- sources:
  - `ideas/courses-grill.md` (D15, D19 to D21, A5 to A8) and `ideas/courses.md` (track 1)
  - Explore report of 2026-10-11 on today's workspace frame (`web/src/pages/workspace/index.tsx`, `web/src/lib/panes.ts`, `web/src/components/resize-handle`, `web/src/components/underline-nav`, the `/views` harness)
  - `design/workspace.md`, `design/design-system.md`

Jack ended the grill early on 2026-10-13 by giving the design himself and saying to start. What he did not decide is under Assumed, for him to overrule when he tries it.

## Summary

### In one line

For the student in the middle of a problem, the dock shows the thing they opened on the right and whatever they need beside it on the left, in a split they can resize, so that looking something up never costs them their place.

### Decisions

| #   | Decision                                                                                                                                           | Why                                        | Beat                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| D1  | The first dock is a split screen like today's workspace, built from what exists. The full dock of `ideas/courses-grill.md` (D15) is reached slowly | Jack: "a slow migration to the new design" | Building the arrangeable dock at once                       |
| D2  | Opening something from the course overview opens the split with the **right pane locked** to that thing. The URL names that thing and nothing else | Jack's design                              | Tabs in both panes; the URL carrying every open tab         |
| D3  | The **left pane starts empty**. The student adds tabs to it and switches between them                                                              | Jack's design                              | PSet filling the left pane when something opens (D20 there) |
| D4  | Something else from the course is opened with a **+ on the left pane's tabs**                                                                      | No width spent until it is needed          | A course sidebar; opening only from the overview            |
| D5  | The split is freely resizable, and there is **no Focus toggle**                                                                                    | Jack: "No toggle"; the seam is enough      | Widen or Maximize on each pane                              |

D2 and D3 amend D19 and D20 of `ideas/courses-grill.md` for this first dock: only the left pane holds tabs, and PSet does not arrange it.

### Inventory

| Element          | Shows, does, links                                                                                        | Must, should, never | Why                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------- |
| Right pane       | The view of the thing opened. A slim header with its kind and title, the height of the tab strip. No tabs | Must                | D2                                            |
| Left tab strip   | One tab per thing opened there: kind, title, a close. The shown tab is marked. A + at the end             | Must                | D3, D4                                        |
| The +            | A menu of the course's materials and sets, grouped by kind. Picking one opens it as a tab and shows it    | Must                | D4                                            |
| Left pane, empty | One line saying nothing is open here, and the same list the + shows, so the first thing is one click      | Must                | D3: the state every visit starts in           |
| The seam         | Drag, arrow keys, Home and End, Enter or double-click to reset: today's resize handle                     | Must                | D5                                            |
| Leaving          | The course's name in the top bar goes back to the overview. Not part of the dock: a prop the screen wires | Must                | The right pane cannot be closed               |
| A Focus toggle   |                                                                                                           | Never               | D5                                            |
| Drag and drop    | Moving a tab, swapping panes                                                                              | Never, for now      | Rearranging waits for milestone 2 (D30 there) |
| Ask              |                                                                                                           | Never               | Ask is a floating dialog, track 4 (D21 there) |

### States

| State           | What shows                                                                                             | How to reach it                   |
| --------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Just opened     | Right: the thing. Left: empty, with the list to open from                                              | Open anything from the overview   |
| One tab         | Left: its view under a strip of one tab and the +                                                      | Pick from the empty list or the + |
| Several tabs    | The shown tab marked; the others keep their place (scroll, zoom) while hidden                          | Add more with the +               |
| Many tabs       | Tabs shrink to a floor and their titles cut short with a tooltip; past that the strip scrolls sideways | Open more than fit                |
| Last tab closed | Left returns to empty                                                                                  | Close the only tab                |
| Already open    | Picking something that is open shows its tab; the thing on the right is not offered                    | Pick it again from the +          |
| A link followed | A page named in the right pane's view opens that material as a left tab, at that page                  | Click the link in the right view  |
| At a limit      | A pane stops at its narrowest width; the seam does not move further                                    | Drag or arrow to the end          |
| Reloaded        | The same thing on the right (from the URL), the split where it was left                                | Reload                            |

### Acceptance

- On `/views/dock`, in Paper and Night at 1280 and 1440: every state above is reachable from a scenario.
- From just opened, a material is beside the work in one click. Switching tabs is one click. Closing a tab is one click.
- The seam works by pointer and by keyboard, and both panes scroll on their own; the frame never scrolls.
- A hidden tab keeps its scroll position when shown again.
- The dock never navigates: leaving, and anything else that exits, is a prop the stage logs.
- New or changed components are on `/components` with their READMEs.
- `make check-fast` passes.

### Assumed

- A1: Every left tab can be closed. The right pane cannot: the way out is the course's name in the top bar. Jack: no preference.
- A2: A thing is open once. Jack: no preference.
- A3: The empty left pane takes its half of the split, as Jack described it. Whether it should be narrow until the first tab is opened is asked after he has tried it.
- A4: The split's ratio is remembered per course in the browser, defaults to equal halves, and each pane stops at 360, today's narrowest panel.
- A5: The left pane's tabs are remembered for the visit. Remembering them per course across visits waits for the real workspace.
- A6: A view asks the dock to open something through one call the dock gives it (the thing, and where in it). This replaces today's private wire from the homework view into the scan.
- A7: This track builds the dock with stand-in views on sample data. The real material views are track 2 and the set view is track 3.
- A8: The mission sentence above is mine; Jack did not correct it.

### Open

- A3, after Jack tries it.
- `design/workspace.md` still describes three panes and the Focus toggle. It is corrected when the real workspace changes (tracks 7 and 13), not by this track, which adds a view on `/views` only.

## Reversals

- **The Focus toggle** ("Focus widens the panel to 800 by collapsing the rail", `design/workspace.md`, 2026-09-26). Reversed for the dock on 2026-10-11 by Jack's answer "No toggle". Today's workspace keeps it until it is replaced.
- **"The panel is always open"** (`design/workspace.md`, 2026-09-30). Asked as a reversal on 2026-10-11; Jack had no preference. His design of 2026-10-13 settles the part that matters: the right pane is always open, the left pane can be empty.

## Disagreements

None.

## Frontier

Empty.

## Log

### Gate 0, 2026-10-11

The audit of today's frame was shown to Jack with a proposed mission. He corrected no fact.

### Batch 1, gate 1, 2026-10-11

- Q1. Inside the workspace, how do you open something else from the course (another material, another set)? Options: A + on each pane's tabs (Recommended) / A course sidebar / Only from the overview. Answer: "A + on each pane's tabs (Recommended)".
- Q2. This reverses the Focus toggle (2026-09-26, design/workspace.md). What replaces it in the dock? Options: Widen, on each pane (Recommended) / Maximize, on each pane / No toggle. Answer: "No toggle".
- Q3. This reverses "the panel is always open" (2026-09-30). When you close the last tab in a pane, what happens? Options: The pane closes (Recommended) / The pane stays, empty / Keep it always open. Answer: "[No preference]".
- Q4. Can the same thing be open twice (the textbook in both panes, at two pages)? Options: No, once (Recommended) / Yes, a material can be open twice. Answer: "[No preference]".

### Jack's message, 2026-10-13

"Lets start with the dock, more as a split screen view like we have now. We can build it with what we have now, and make a slow migration to the new design. When we have a course overview, you can see everything you open. When you click something, it opens in a split screen view, with the left pane empty state, and the right pane locked to whatever you opened. thats also what the url serves. then on the left pane you can add tabs, and switch between them, freely resize the split. Lets start with that"
