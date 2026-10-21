# The workspace, the pane view

Status: In progress, branch `workspace` (worktree `../pset-workspace`, from `design`).
Spec: `ideas/workspace-grill.md` (W1 to W15 and Assumed), on top of S5 to S9 and A1
to A6 of `ideas/screens-grill.md`. Jack, 2026-10-21: **"build it"**.

## What to build

On `/design`, as units with typed `spec.ts`, `examples.tsx` and `log.md`, like
`web/src/units/home` and the components it uses. Sample data only; no Go work.

1. **`tabs` (component).** GitHub underline tabs (W2): text tabs, an accent
   underline on the open one, a close x on hover (and on the open tab), a + at the
   end that opens a menu (W10: the course's materials, its other sets, Ask; a menu
   component if none exists, built small). Too many tabs: shrink to a minimum
   width, then the row scrolls sideways with a fade at the edge (W13). A tab's menu
   (right click and a small chevron or the context menu): Move to other side, Swap
   sides, Close, Close others. Tab labels: a set's name; a material's name and page,
   "Griffiths p. 112" with the page dim, no dot (W11); "Ask".
2. **`divider` (component).** A 1px hairline between the sides that turns the accent
   while hovered or dragged, double-click resets to half and half (W15); a side never
   narrower than 360px.
3. **`side` (pane).** A tab row over one pane. Holds any of: a set, a material, Ask.
   Each side loads on its own with its own skeleton; the tab row shows at once.
4. **Placeholder panes** (one unit, `pane-stub`, or three tiny ones): a stand-in for
   the work pane (set name, a few problem stubs, each with a page link and "Ask about
   this"), the material pane (the material's name and a page number, with a page
   shaped block), and Ask (the attached problem and an empty input). They exist only
   so the workspace can be driven; their real designs are later grills. Mark them
   clearly as stand-ins in their specs.
5. **`workspace` (view).** The top bar with the path only (W1: "PSet / Circuits I /
   Problem set 4", Settings). Two sides, half and half by default (W3); the state
   (both sides' tabs, the open tab on each, the split, each material tab's page) in
   one model that the address would hold (A6) and that is remembered per course
   (S8; for now in memory or the design page's state, no server).
   Behaviour, all of it working in the design page:
   - Opening a set: its material on the left at the current problem's page, the set
     on the right (W9).
   - A side whose last tab closes folds away; the other takes the full width; it
     returns only by dragging a tab onto either half of the window (W4, W16).
     No "Open beside" control.
   - Tabs drag between sides, or "Move to other side"; "Swap sides" (W7).
   - A material may be open twice, each at its own page (W6).
   - A page link in the work turns the book's showing tab (either side); if none is
     showing, its tab on the side opposite the work; if none, opens one there (W14).
   - "Ask about this" opens Ask as a tab on the side not holding the work, the
     problem attached (W5).
   - No keyboard shortcuts (W12). No code for narrow windows (W8, Jack: "remember,
     we do NOT support mobile or small screens. We do NOT need to include any code
     or styling related to that."): no notice, no breakpoints, no small-width states;
     360px stays only as the divider's drag stop.
     States for the design page: opening a set; two materials and a set; one side
     folded; the same book twice; Ask open; many tabs (overflow); loading (each side's
     skeleton); stress (long course, set and material names).
     A flow on the design page, like Home's: open a set, follow a page link, ask
     about a problem, close the material side, drag a tab back.

Earlier docs to update: in `ideas/screens-grill.md`, mark A2 replaced by W6 and A3
replaced by W8, and note S6, S7, S9 reaffirmed by W2, W9, W5.

## Rules

The rulebook and checks; outline-only boxes like the lists; sentence case; no em
dashes; no accessibility-only work (Jack's contrast, focus and keyboard-use rules
stand). Decisions in each unit's spec with Jack's words verbatim in `log.md`.

## Done when

`make check` green; every unit and the view render on `/design` at 1280 and 1920
(Full) with no overflow, loaded, loading and stress, and you looked at the
screenshots; the flow runs end to end; drag, fold, reopen, swap and page links all
work by hand in the browser (Playwright).
