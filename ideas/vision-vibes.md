# Vision grill: four vibes to look at (temporary)

Throwaway. Jack wants to see, not read, how PSet could feel. Static snapshots only,
"just enough to see the vibe". This file and `web/src/pages/vibes/` are deleted before
the pull request. Low effort: no data, no state, no loading, no tests beyond
`make check` passing. Light theme only.

## The job

A route `/vibes/<vibe>/<screen>` (lazy, outside `<Live>`, registered in
`web/src/App.tsx`), with a thin bar on top to switch vibe (A, B, C, D) and screen
(Home, Homework). Eight static pages at 1280 wide.

These are NOT built from the existing components or tokens: design is being redone
from scratch, so each vibe carries its own colours, type and shapes in a scoped
stylesheet or CSS variables on its root element. Fonts: only what the app already
bundles (Newsreader, Inter, JetBrains Mono) and system fonts. No new dependencies.

## The two screens (same content in every vibe)

**Home.** A greeting to Jack. Three courses (Circuits I, Signals and Systems,
Differential Equations), each showing its materials count and its work: for example
"Problem set 4, 2 of 6 done, due Friday" (a due date appears only where one was
given; one set has none). One clear way to continue the set in progress. A way to add
a course. A small line of this week's study time.

**Homework.** Two sides. Left: the material, a placeholder textbook page (a pale page
with grey text lines, a figure box, "p. 142"). Right: the work pane for Problem set 4:
progress "2 of 6", problem 4.27 with its statement ("For the circuit in Fig. 4.109,
find the current i through the 8 Ω resistor and the power it absorbs."), then help in
three steps, Hint, Approach, Solution, where Hint is open and the other two are
closed and say what they hold. The open hint is marked as generated and cites
"p. 142" as a link to the page. Actions: Next problem (main), Skip, Ask about this.

## The four vibes

- **A, a precise tool.** Like GitHub or a code editor: neutral greys on white, one
  blue, Inter throughout at a dense 14 to 15px, mono for figures and ids, 6px
  corners, hairline borders, lists and tables rather than cards, compact header. No
  decoration.
- **B, a quiet study room.** Warm paper ground, soft ink, Newsreader for titles and
  for the problem's text, Inter for controls, generous space, few borders, a single
  calm column on Home. The feel PSet has today, cleaned up.
- **C, a friendly tutor.** Rounder (12 to 16px corners), a warm accent, larger type,
  conversational copy ("Nice, two down. Four to go."), the help written as a tutor
  speaking, soft filled surfaces rather than borders.
- **D, the mix, with creative liberty.** Combine A and B in a useful way of your own
  devising. Starting points from Jack: big serif headings and a real greeting
  ("Welcome back, Jack"), with the study room where the student reads (the problem
  statement and the help in a serif reading measure) and the precise tool where the
  student acts (dense bordered rows for courses and work, mono figures for progress
  and dates, compact controls, one blue). Make it feel like one deliberate design,
  not half of each. This is the one to spend the most care on.

Each vibe must be clearly different from the others at a glance.

## Done

`make check` passes. One commit, "Vibes for the vision grill (temporary)". Report the
routes, what you did for D in three lines, and anything skipped. End your turn with
the report text itself.
