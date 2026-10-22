# The work pane inside the workspace

Status: In progress, branch `workspace-work-pane` (worktree `../pset-workspace-work`,
from `design`). Follows #49 (the workspace, with stand-in panes) and #50 (the work
pane, standalone).

## What to build

1. **Swap the stand-in.** The workspace's work tab renders the real `work` pane
   instead of `pane-stub`'s work stand-in, wired through the pane's callbacks:
   - `onOpenPage(page, problemId)` turns a material tab as W14 says (the showing
     tab of that book on either side; else its tab on the side opposite the work;
     else a new tab there), and briefly outlines the problem's box in the material
     stand-in (P11).
   - `onAsk(problemId)` opens Ask on the side not holding the work with that
     problem attached (W5), as the stand-in's "Ask about this" does today.
   - `onBackToCourse` is a no-op line on the design page (the course screen isn't a
     unit yet).
   - The pane's remembered place uses the workspace's memory per set (S8), so
     switching tabs and back keeps the problem.
   Remove the work stand-in once nothing uses it; the material and Ask stand-ins
   stay until their own panes are designed.
2. **One menu.** The workspace's `menu` and the work pane's `action-menu` do the
   same job: keep one component (the better of the two, your call, say which), move
   both callers to it, delete the other.
3. **The + matches the close x.** Jack, 2026-10-21: **"For the workspace the plus
   button size should be the same size as the close button on the tabs"**. The +
   at the end of a tab row has exactly the close x's icon size and hit area.
   Record it as a decision in the tabs spec with his quote.
4. The workspace's states and flow use the real pane (opening a set, page links,
   Ask about this, the summary), and its skeleton for the work side is the work
   pane's own.

Sample data only; desktop only (1280 and 1920 Full); no narrow code.

## Done when

`make check` green; the workspace flow runs end to end in Playwright with the real
pane (open a set, mark done, follow a page link, ask about a problem, open the
summary, drag the work tab across and back); screenshots looked at; the + and x
measured equal.
