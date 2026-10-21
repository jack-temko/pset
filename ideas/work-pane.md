# The work pane

Status: In progress, branch `work-pane` (worktree `../pset-work-pane`, from `design`).
Spec: `ideas/work-pane-grill.md` (P1 to P16 and Assumed). Jack, 2026-10-21: **"work
pane spec is gtg"**, then **"Build along side."** The workspace is being built at the
same time on `workspace`; this pane is built standalone and swapped into the
workspace in a follow-up once both have merged.

## What to build

On `/design`, as units with typed `spec.ts`, `examples.tsx` and `log.md`, like
`web/src/units/home`. Sample data only (a set of about 8 problems with labels,
pages, statements with inline and display math, a figure or two, professor's notes,
parts (a) to (d) with some skipped, hint, walkthrough and answer text); no Go work.
Reuse existing units (set-line, progress-bar, tag, button, link, tooltip, list).
Desktop only: no narrow-width code, states or checks.

1. **`problem-strip` (component).** Numbered chips (P1): done filled, current
   outlined, failed in the danger colour, hover shows the label; one click jumps.
2. **`help-row` (component).** A closed row that opens (P13): Hint, Walkthrough,
   Answer; any open at once; a writing state ("Writing the walkthrough · about
   20 s", P10).
3. **`problem` (component).** The note above (P15), label and page link "3.1 #7 ·
   p. 112" (P14, the link fires a page-link action), statement with math (use the
   app's KaTeX helper `web/src/lib/math.ts` if it fits; doc runs as today's wire
   type), figures under the text (click to enlarge), parts with skipped ones dimmed
   and marked "Skipped", no help (P7), the three help rows, then Mark done, Ask about
   this and Next (P2, P4), and one menu for the rest (edit, move, notes, check
   figure, wrong problem, remove). States: ready, being found, writing help,
   failed first time, failed second time (P16).
4. **`finish-card` (component).** "All 8 done · 2 h 10 m", Turn in, Back to the
   course (P12).
5. **`work` (pane).** The set line (P5), the strip, the current problem, the
   finish card; the set menu (Add problems, Box one on the page, Edit, Print
   worksheet, Turn in / Take back with the unfinished warning (P9), Delete);
   Remove with "Removed 4.62 · Undo" (P8); the current problem remembered (in the
   design page's state for now). Fires actions the workspace will handle: open page
   (with the problem's box, P11), ask about (problem id, P6). States: in progress,
   all done, loading (skeleton), a problem still being found, a failed problem,
   turned in, stress (long labels, long statements, 30 problems in the strip).
   A flow: open the set, read the hint, mark done, Next, skip to 5 via the strip,
   finish, turn in.

## Rules

The rulebook and checks; outline-only boxes; sentence case; no em dashes; no
accessibility-only work (Jack's contrast, focus and keyboard-use rules stand).
Decisions in each unit's spec with Jack's words verbatim in `log.md`.

## Done when

`make check` green; every unit and the pane render on `/design` at 1280 and 1920
(Full), loaded, loading and stress, and you looked at the screenshots; the flow runs
end to end in Playwright.
