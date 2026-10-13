# Vision: grill

- status: approved
- date: 2026-10-13
- brief: what PSet is, who it is for, what it promises and the principles that follow, from scratch (D24 in `ideas/gallery-docs-grill.md`); judged from the student who uses it
- sources:
  - `README.md`, `design/` (all), `.agents/skills/pset-view/references/student-lens.md`
  - `web/src/App.tsx` (routes), `internal/` (packages)
  - `origin/courses:ideas/courses-grill.md` (summary, decisions, glossary)
  - prior art: none. Five lookups failed (Primer, Apple HIG, Material 3 returned no principles; Linear's method page is process advice)

## Summary

### In one line

A study tool for problem-set courses: it walks you through this week's work until you
can do it yourself, from your own course's materials.

### Decisions

| #   | Decision                                                                                                                                                             | Why                                                                                          | Beat                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| V1  | PSet is for Jack and students like him: university students in problem-set courses who have their course's PDFs and can run a local app                              | Narrow enough to design sharply; who gets releases                                           | Jack alone; any student                                                      |
| V2  | The one job: get this week's work done, understanding it. Reading and asking serve the work                                                                          | The name says it                                                                             | Understand the material; run the whole course                                |
| V3  | The centre is the course: it holds its materials and its work                                                                                                        | How a student's week is organised                                                            | The book; the work                                                           |
| V4  | Design for an ordinary student, maybe a bit tired. Not the worst case                                                                                                | Jack: "a more neutral stance for now"                                                        | The tired one as the worst case; focused; panicking                          |
| V5  | When the student is stuck: the smallest help first (hint, approach, solution), each only when asked                                                                  | Serves understanding without refusing help                                                   | Never the full answer; the worked solution at once                           |
| V6  | On being wrong: PSet shows its sources and marks what it wrote, and checks its own output at important phases, above all before costly stages                        | Jack: mistakes multiply                                                                      | Checking everything before showing; clean and confident                      |
| V7  | The course's materials come first. When they do not cover something, PSet answers from what the model knows, marked "not from your course"                           | Never a dead end, and the course stays first                                                 | Only what the student put in (first chosen); the web                         |
| V8  | PSet is not a notes app, a general chatbot or a memorisation tool. It is not a planner, but it shows due dates it was given or found                                 | One job                                                                                      | Becoming any of them                                                         |
| V9  | Eleven principles, below, become the first rules in the rulebook                                                                                                     | A vision that can be checked                                                                 | "One obvious next step" as a vision rule (left per screen)                   |
| V10 | The screens are rethought from the job and the course, not rebuilt as they are. Today's screens and the courses spec are evidence, not a plan                        | Nothing carried over by habit                                                                | The courses spec's screens; today's three restyled                           |
| V11 | Local on the student's own key for now, and open later: no principle is written about it and nothing may assume it forever                                           | Jack's choice                                                                                | Local as part of the vision; deciding it now                                 |
| V13 | A rule has no kind. "Always", "never" and "limit" are merged into one flat list, and every rule is worded as what to do; a rule with a number just states the number | Jack: "combine always and never, and just negate the wording", then "merge those too please" | Three kinds: always, never, limit (D12 of the gallery docs grill); two kinds |
| V12 | The principles are rules in the rulebook; the one line, the audience, the job and the "is not" list show as a short header on the Rules tab of `/design`             | One place, where units are judged                                                            | A Vision tab; a doc only                                                     |

| V14 | The feel is the mix: a quiet study room where the student reads (serif for the greeting, the problem and the help) and a precise tool where they act (ruled rows, mono figures, compact controls, one accent). Its colours and finish are not settled | Jack, on four built snapshots: "I like D, the mix. But not quite that color theme, and it looks a bit off" | A precise tool; a quiet study room; a friendly tutor |

### The artifact(s)

**The principles** (each becomes a rule with a permanent id; all worded as what to do):

| Id                    | Rule                                                                                           | How to check                                           |
| --------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `smallest-help-first` | Show only the help the student asked for: hint, then approach, then solution                   | No solution is visible before the student asked for it |
| `student-decides`     | Leave every choice to the student: skipping, revealing and removing happen the moment they ask | No action waits on PSet's permission                   |
| `generated-is-marked` | Mark anything PSet wrote as generated, and point it at the page it came from                   | No generated text without the mark and a source        |
| `course-first`        | Answer from the course's materials, and mark anything else "not from your course"              | Every answer cites the course or carries the mark      |
| `work-first`          | Make every screen's main action move the student's current work forward                        | Each view's main action is about the work              |
| `material-is-main`    | Give the course's pages and problems the space and the contrast; keep PSet's controls quiet    | What is largest and darkest on each screen             |
| `keep-the-place`      | Return the student to the same spot after a reload, Back or a followed link                    | Reload and Back in every state                         |
| `check-before-cost`   | Check a stage's output before the costly stages it feeds                                       | Each pipeline names its checkpoints                    |
| `honest-waits`        | Say what a wait is doing, and show a cost or a time only when it is known                      | No invented number; no spinner without a reason        |
| `dates-only-given`    | Show only due dates that were given or found in the work                                       | Every date traces to a source                          |
| `failure-says-what`   | Name what failed, why and the one thing to do next, in words that put no blame on the student  | Every error state has all three                        |

### Assumed

- A1: the ids above are mine; they are permanent once they land.
- A2: `check-before-cost` is a rule about the backend's pipelines, so it is cited by
  docs of those pipelines, not by units on `/design`.
- A3: the Rules tab header needs a small addition to the frozen spec format (a
  `vision.ts` of plain data). It is the first of the changes the freeze allows.
- A5: V13 changes the frozen format: the `kind` field leaves the `Rule` type in
  `web/src/design/rules.ts` and local rules in `spec.ts`, the Rules section of the unit
  page becomes one flat list, and the checks, `design/design-docs.md` and D12 of
  `ideas/gallery-docs-grill.md` follow. The positive wording is my reading of "negate
  the wording".
- A4: the student lens in the pset-view skill is rewritten to V4.

### Open

- The mix's colours and what makes snapshot D look "a bit off": the theme and
  foundations grill, which starts from V14 and the serif-to-read, tool-to-act rule.
- Which screens the job needs (V10): its own grill, after theme and foundations.
- Prior art: none was found; a second attempt is possible before the theme grill.

## Reversals

- `.agents/skills/pset-view/references/student-lens.md` ("hour 7 of a study marathon,
  1am"): replaced by V4. Rewritten when this grill lands.
- `README.md` ("A study app for textbooks you own as PDFs"): replaced by the one line
  and V3 when the product matches it; not edited now, since the app is still the old one.
- V7 reversed Jack's first answer (only what the student put in) after he named it as
  a worry.

## Disagreements

- Student: recommended designing for the tired student as the worst case. Jack chose
  a more neutral stance, maybe a bit tired (V4).
- Local: recommended making local and own-key part of the vision. Jack chose local
  now, open later (V11).
- One line: recommended the plain sentence. Jack chose the descriptive one.

## Frontier

Empty.

## Log

### Gate 0

Audit shown to Jack; no corrections. Prior art lookups failed and he was told.

### Batch 1, gate 1 (who it is for)

- Who is PSet for? **You, and students like you (Recommended).**
- What does a student open PSet to do? **Get this week's work done, understanding it
  (Recommended).**
- What is the centre of the product? **The course (Recommended).**
- Which student do we design for? The tired one, as the worst case (Recommended) / The
  focused one / The panicking one. **"lets go with a more neutral stance for now,
  maybe a bit tired"**

### Batch 2, gate 2 (the promise)

- When the student is stuck, what does PSet do? **Smallest help first, the answer on
  request (Recommended).**
- The models will sometimes be wrong. What is PSet's stance? Show its sources, mark
  what it wrote (Recommended) / Check before showing / Clean and confident. **"show its
  sources, marks what it wrote. checks on important phases, especially when costly
  stages lay ahead, and mistakes multiply"**
- What does PSet work from? **Only what the student put in (Recommended).**
- Which of these is PSet NOT? (multi) **"not a planner, but does include what it can
  when due dates are included or set", A notes app, A general chatbot, A memorisation
  tool.**

### Batch 3, gate 3 (principles)

- Help and honesty, which do you adopt? (multi) **Smallest help first, The student
  decides, Generated is marked and cited, Only the course's materials.** ("Something
  else" was ticked with no text; asked in batch 4: "Nothing, a mis-tick".)
- Work and attention? (multi: The work comes first, One obvious next step, Never lose
  the student's place, The material is the main thing) **The work comes first, The
  material is the main thing.**
- Models, time and dates? (multi) **Check before the costly step, Honest about waiting
  and cost, Dates only when given, A failure says what to do.**
- How should PSet feel? A precise tool (Recommended) / A quiet study room / A friendly
  tutor. **"is it possible to show me a static snap shot of say the home page, and the
  current homework view with the three of these? Don't spend too much effort on it,
  just enough to see the vibe. Then one more option, take some creative liberty, and
  design a mix of a precise tool and a quiet study room (big headings in serif, the
  into: welcome Jack, etc) and combine the two in a useful and creative way."**
  Snapshots being built at `/vibes` (temporary).

### Batch 4, gates 3 and 4

- "Something else" under help: **Nothing, a mis-tick.**
- Two principles left out; push back on "never lose the student's place". **Add 'never
  lose the place'.** ("One obvious next step" stays out, decided per screen.)
- Are the screens rebuilt as they are, or rethought from the job? **Rethought from the
  job (Recommended).**
- Local, own key, friends: part of the vision or open? Part of the vision
  (Recommended) / Local now, open later / Open now. **Local now, open later.**

### Batch 5, gate 4 and the tail

- Which sentence says what PSet is? (shown as previews) **"what is this question asking
  me? Where are the three sentences to choose from?"** The previews did not show; asked
  again in batch 6 with the sentences written out.
- Where does the vision live? **Principles as rules, vision atop the Rules tab
  (Recommended).**
- Does any of these worry you? (multi: Too narrow, Too strict on materials, The course
  as centre, None) **Too strict on materials.**

### Batch 6

- Which sentence says what PSet is? 1, Plain (Recommended) / 2, Short / 3, Descriptive.
  **3, Descriptive.**
- When the course's materials do not cover what the student needs? **Fall back, clearly
  marked (Recommended).**

### After batch 6

Jack, on the principles table: **"please combine always and never, and just negate the
wording"** (V13).

Jack, on keeping `rule` and `limit` apart: **"merge those too please"** (V13).

### Batch 7, the feel, on built snapshots

Snapshots at `/vibes/<a|b|c|d>/<home|homework>` (commit ea02a97, deleted before the
pull request).

- Which feel is PSet's starting point for the theme grill? D, the mix / A, a precise
  tool / B, a quiet study room / C, a friendly tutor. **"I like D, the mix. But not
  quite that color theme, and it looks a bit off. Probably because Sonnet wrote it. But
  lets go wit that."**
