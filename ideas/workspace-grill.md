# Workspace: grill

- status: approved ("build it", 2026-10-21)
- date: 2026-10-21
- branch: `workspace`
- brief: the workspace screen as a pane view: its top bar, sides, tabs, split and
  how things open, building on S5 to S9 and A1 to A6 of `ideas/screens-grill.md`.
  The insides of the work, material and Ask panes are their own grills.
- prior art: GitHub Primer underline nav and page layout; VS Code editor groups and
  tabs (sources listed in `ideas/screens-grill.md`).

## Summary

The workspace is two sides under a plain top bar. Each side has GitHub-style
underline tabs; anything (a set, a material, Ask) can sit in either side, be dragged
across, or be closed, and a side whose last tab closes folds away.

| #   | Decision                                                                                                                                                                                              | Why                                                                                                                                                                                                                             | Beat                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| W1  | The top bar is the path only: "PSet / Circuits I / Problem set 4", and Settings. Progress lives in the work pane                                                                                      | Jack's pick                                                                                                                                                                                                                     | Path plus the set's progress; no top bar                               |
| W2  | Each side's tabs are GitHub underline tabs: text, an accent underline on the open one, a close x on hover, a + at the end. Reaffirms S6                                                               | Jack's pick; matches the GitHub look                                                                                                                                                                                            | Boxed editor tabs; a picker instead of tabs                            |
| W3  | The sides split half and half by default, draggable, remembered per course (S8)                                                                                                                       | Jack's pick                                                                                                                                                                                                                     | Material wider; work wider                                             |
| W4  | When a side's last tab closes it folds away and the other takes the full width; "Open beside" in the tab row brings a second side back (confirms A1)                                                  | Jack's pick: no empty boxes                                                                                                                                                                                                     | An empty side listing what to open                                     |
| W5  | "Ask about this" opens Ask as a tab on the side not holding the work, the problem attached. Reaffirms S9                                                                                              | Jack's pick; the same tabs as everything else                                                                                                                                                                                   | Under the work; a floating panel                                       |
| W6  | A material can be open twice, each tab at its own page. Replaces A2                                                                                                                                   | Jack's pick: an example page beside a problem page                                                                                                                                                                              | Open once only                                                         |
| W7  | A tab moves to the other side by dragging it or by "Move to other side" in its menu; "Swap sides" swaps both                                                                                          | Jack's pick                                                                                                                                                                                                                     | A menu only                                                            |
| W8  | No code for narrow windows: PSet is desktop only. Replaces A3                                                                                                                                         | Jack: "remember, we do NOT support mobile or small screens. We do NOT need to include any code or styling related to that."                                                                                                     | A "needs a wider window" notice; one side with a switch; stacked sides |
| W9  | Opening a set puts its material on the left at the current problem's page and the set on the right. Reaffirms S7                                                                                      | Jack's pick: nothing to set up                                                                                                                                                                                                  | As you left it; the set alone                                          |
| W10 | A side's + menu offers everything in the course: its materials, its other sets, and Ask                                                                                                               | Jack's pick: one place to open anything                                                                                                                                                                                         | Materials and Ask only                                                 |
| W11 | A material's tab reads its name and page: "Griffiths · p. 112"                                                                                                                                        | Jack's pick: two tabs of one book tell themselves apart                                                                                                                                                                         | Name only                                                              |
| W12 | No keyboard shortcuts for now                                                                                                                                                                         | Jack: "None for now"                                                                                                                                                                                                            | An editor-style set; the basics                                        |
| W13 | Too many tabs: they shrink to a minimum, then the row scrolls sideways with a fade at the edge                                                                                                        | Jack's pick                                                                                                                                                                                                                     | A "more" menu                                                          |
| W14 | A page link turns the book's tab that is showing (open on either side); if none is showing, its tab on the side opposite the work; if none, it opens one there. Never a duplicate when one is visible | Jack: "the visible one, or the one on the other side"                                                                                                                                                                           | The other side's tab first; always a new tab                           |
| W15 | The divider is a 1px hairline that turns accent while hovered or dragged; double-click resets half and half                                                                                           | Jack's pick                                                                                                                                                                                                                     | A visible grip                                                         |
| W16 | While a tab is dragged, either half of the window takes the drop: dropped on a half, the tab goes to that side, and a folded side's half reopens it. Refines W7 and the folded-edge drop              | Coordinator's note (Jack's own words not passed to the builder)                                                                                                                                                                 | A thin strip at the folded edge                                        |
| W17 | Each tab has one icon, its close x, always shown: dim on inactive tabs, full muted on hover, the text colour on the open tab. The tab menu opens on right click; no menu button. Refines W2           | Jack: "On the workspace, the two icon buttons on each tab dissapear when not selected or not hovered, and leaves a weird gap. How does vscode do it? Either make them always show dimly or something, or find a different way." | Icons on hover only; VS Code's reserved empty slot                     |

### Assumed

- Each side loads on its own, with its own skeleton; the tab row shows at once.
- A side is at least 360px; dragging stops there.
- A tab's menu: Move to other side, Swap sides, Close, Close others.
- Dragging a tab onto a folded side's edge opens the second side with it.
- Printing a worksheet stays an action in the work pane (A4).
- The address keeps what is open (A6): both sides' tabs, the open tab on each, the
  split, each material tab's page.

## Log

Jack, before the grill: **"Nope, lets start the grill. Reopen anything you think we might need to to ensure cohesivity and good UI/UX"**. Reopened: S6 (tabs), S7 (opening a set), S9 (Ask), A2 (open once), A3 (narrow).

Batch 1: top bar **Path only**; tabs (S6 reopened) **GitHub underline tabs (Recommended)**; split **Half and half (Recommended)**; empty side **Side folds away (Recommended)**.

Batch 2: Ask (S9 reopened) **A tab on the other side (Recommended)**; twice **Yes, at different pages (Recommended)**; move tabs **Drag, or a tab menu (Recommended)**; narrow **Don't design it**.

Jack, 2026-10-21, on W8 after the build began: **"remember, we do NOT support mobile or small screens. We do NOT need to include any code or styling related to that."**

Batch 3: open a set (S7 reopened) **Material left, set right (Recommended)**; + menu **Materials, sets, Ask (Recommended)**; tab label **Name and page (Recommended)**; keys **None for now**.

Batch 4: overflow **Shrink, then scroll (Recommended)**; page link **"the visible one, or the one on the other side"**; divider **Hairline, accent on hover (Recommended)**.

Jack, 2026-10-21, on the built tabs (W17): **"On the workspace, the two icon buttons on each tab dissapear when not selected or not hovered, and leaves a weird gap. How does vscode do it? Either make them always show dimly or something, or find a different way."**
