# Dock

purpose: the split a course's work happens in: the thing opened locked on the right, a left pane of tabs for whatever is needed beside it
where: the course's workspace screen, the whole area under the top bar; code in `web/src/views/dock/`, parts in `components/split` and `components/pane-tabs`; today's spec for the frame is `design/workspace.md` (still three panes and a Focus toggle, corrected when the real workspace becomes the dock)
mission: For the student in the middle of a problem, the dock shows the thing they opened on the right and whatever they need beside it on the left, in a split they can resize, so that looking something up never costs them their place. It is not for arranging panes (drag and drop waits for milestone 2), not for Ask (a floating dialog, track 4) and not for choosing a course.
budget: a material beside the work in 1 click from just opened (2 tab stops from the course name); switching tabs 1 click; closing a tab 1 click; the seam 0 clicks by arrow keys (1 tab stop); a hidden tab keeps its scroll; the frame never scrolls.

## inventory

| element        | shows / does / links                                                                                              | must, should or never | why                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------- |
| Right pane     | The view of the thing opened, under a slim header (kind, title) the height of the tab strip. No tabs, no close    | must                  | D2                               |
| Left tab strip | One tab per thing opened there: kind glyph, title, a close. The shown tab marked. A + at the end                  | must                  | D3, D4                           |
| The +          | A menu of the course's materials and sets grouped by kind. Picking one opens it as a tab and shows it             | must                  | D4                               |
| Left, empty    | One line saying nothing is open, and the same list, so the first thing is one click                               | must                  | D3                               |
| The seam       | Drag, arrow keys, Home and End, Enter or double-click to reset: `ResizeHandle`                                    | must                  | D5                               |
| Leaving        | The course's name in the top bar goes back to the overview. Drawn by the screen (here the stage), not by the dock | must                  | the right pane cannot be closed  |
| A Focus toggle |                                                                                                                   | never                 | D5                               |
| Drag and drop  | Moving a tab, swapping panes                                                                                      | never, for now        | waits for milestone 2 (D30)      |
| Ask            |                                                                                                                   | never                 | a floating dialog, track 4 (D21) |

## student

Hour 7, 1am, Night, glancing between a material and the work. Opens a set from the overview, wants the page the problem names beside it, one click. Will not arrange anything, will not read a paragraph, cannot aim at a small target.

## flow

1. Opens something from the overview: it is on the right, the left says nothing is open and lists the course's things.
2. Picks a material from the list (or the +, or a link in the right view): it opens on the left, shown.
3. Reads, clicks a link in either view: the other thing opens on the left at that page; a thing already open is shown, never opened twice.
4. Switches tabs with one click; hidden tabs keep their place. Closes a tab with its X; the last one closed returns the left to empty.
5. Moves the seam by drag or arrows; each pane stops at 360px.

Exits: the course's name in the top bar (the screen's), logged here as a handoff. Re-entry after a break: the thing on the right is the URL's, the split is where it was left (saved per course in this browser); the left pane's tabs are held while the dock is mounted (A5).

## anatomy

```
DockStage                       the course's name (leaving) over the dock, at a screen's width
  Dock                          the state: tabs, shown, the right pane's place; open and close
    Split                       two panes and the ResizeHandle, the ratio saved per course
      left:  PaneTabs           strip: tabs (kind glyph, title, X), the + (Menu with MenuLabel, MenuItem)
             tab bodies         one per tab, all mounted, hidden ones invisible and inert
             Empty              one line and the list, when there are no tabs
      right: PaneHeader         kind and title
             the thing's view   drawn by render(thing, place, open)
```

## states

| state           | shows                                                                           | scenario          |
| --------------- | ------------------------------------------------------------------------------- | ----------------- |
| Just opened     | Right: the thing. Left: empty with the list                                     | `just-opened`     |
| One tab         | Left: its view under a strip of one tab and the +                               | `one-tab`         |
| Several tabs    | The shown tab marked; the others keep their scroll while hidden                 | `several-tabs`    |
| Many tabs       | Tabs at a floor of 192px, titles cut with a tooltip, the strip scrolls sideways | `many-tabs`       |
| Last tab closed | Left returns to empty                                                           | `last-tab-closed` |
| Already open    | Picking an open thing shows its tab; the right's thing is not offered           | `already-open`    |
| A link followed | A page named in a view opens that material on the left at that page             | `link-followed`   |
| At a limit      | A pane at 360px; the seam does not move further                                 | `at-a-limit`      |
| Reloaded        | The same right thing (the scenario's, standing for the URL), the saved split    | `reloaded`        |

## actions

- Pick from the list or the +: opens a tab, shows it. Open already: shows it (and goes to the place, if one was given).
- A link in a view: calls `open(thing, { page })`: opens or shows that tab at the page; if the thing is the right pane's, the right view goes to the page.
- Tab: shows it. X or Delete on a focused tab: closes it, the neighbour is shown.
- Seam: drag, arrows (Shift for 64), Home and End, Enter or double-click for halves; saved when a move ends.

## handoffs

out: the course's name -> Course overview -> the course -> the screen wires it; the dock never navigates
in: the overview or Home opens a thing -> its id (the URL) -> that thing on the right, the left empty

## data

reads: none: the stage gives the dock sample things (`sample.ts`); the stand-in views read the same file
writes: `localStorage` `pset-split:<course>`: the left pane's share of the width
events: none

## why

- **A split, the right pane locked, the left starting empty** (Jack, 2026-10-13, D35 of `ideas/courses-grill.md`): built from what exists; the arrangeable dock waits. Beat: tabs in both panes, arranged by PSet.
- **No Focus toggle** (Jack: "No toggle"): the seam is enough. Reverses the Focus toggle for the dock only; today's workspace keeps it.
- **The dock does not know what a view is**: it takes the thing, the course's things and `render`, and gives each view one call, `open(thing, place)` (A6). Replaces the homework view's private wire into the scan.
- **Hidden tabs stay mounted, invisible and inert, not `display: none`**: `display: none` loses a pane's scroll position; `visibility: hidden` keeps it, and `inert` keeps it out of the tab order.
- **The + sits pinned beside the strip**, not after the last tab, so it never scrolls away with many tabs. It is at the strip's end either way.
- **Only the shown tab's X is a tab stop**, so ten tabs are not twenty stops. Delete closes a focused tab.
- **A thing is open once** (A2) and **every left tab closes** (A1). The left pane may be empty (A3 asks later whether it should be narrow).
- **Leaving is the screen's**: the course's name in the top bar. The dock has no prop for it; the stage draws the name and logs the handoff.
- **A new `Split` and `PaneTabs` rather than reusing `UnderlineNav` and the workspace's `usePanes`**: those have no close, no kind, no shrinking, and size three panes of one screen. They stay as they are until the workspace becomes the dock.

## friction

| id  | where                                  | what goes wrong                                                                                                      | severity | fix                                                                       | status | shown in       |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------- | ------ | -------------- |
| F1  | many tabs                              | At 192px a title is cut to about a dozen characters; two lectures can look alike until the tooltip                   | medium   | none yet: it is the strip's nature; a Focus-free "list all" is the + menu | open   | `many-tabs`    |
| F2  | left, empty                            | The empty pane takes half the split for a list (A3)                                                                  | low      | ask Jack after he tries it                                                | open   | `just-opened`  |
| F3  | tab X                                  | Only the shown tab has a close in the tab order; a hidden tab is closed by its X with the pointer, or by Delete      | low      | keep unless a keyboard user asks for more                                 | open   | `several-tabs` |
| F4  | a link into the right pane's own thing | A view on the left linking to the right pane's thing moves the right view to the page, with no sign on the tab strip | low      | judge in the real views (tracks 2 and 3)                                  | open   | none           |

## wants

None: the dock reads no API. The course's things come from the screen (track 7), the thing on the right from the URL.

## open

- A3: whether the empty left pane should be narrow until the first tab opens, after Jack tries it.
- A5: the left pane's tabs are held while the dock is mounted; remembering them when the student leaves and comes back waits for the real workspace.
- The tab strip's close and the + are 28 and 32px in a 40px strip: Jack to say whether they are aim-able enough at hour 7.

## links

`web/src/views/dock/grill.md`, `ideas/courses-grill.md` (D15, D19 to D21, D35, A5 to A8), `design/design-system.md`, components: Split, PaneTabs, PaneHeader, Menu (MenuLabel, `icon`), ResizeHandle, Tooltip, Button.
