# The view grill: the brief handed to `grill`

`pset-view redesign` loads the `grill` skill and gives it this brief. Everything view-
specific about a grill lives here; the interviewing itself is `grill`'s.

## The brief

```
topic:     <view name>: redesign
output:    web/src/views/<name>/grill.md   (archive an existing one to grills/<date>.md)
viewpoint: the tired student: hour 7, 1am, Night theme, glancing between the scan and
           this view, low patience, low working memory
locked:    design/design-system.md; the view's screen spec in design/ (dated decisions);
           the guardrail list in pset-view/SKILL.md; the view's spec.md `why`
stages:    gates 0 to 4 below
```

A locked decision that an answer would contradict becomes a reversal question, asked
as "this reverses <decision>, written <date> in <file>. Reverse it?". If approved, the
reversal goes in `grill.md`, the view's `why`, and the design doc that held it.

## Gate 0: Frame (alone, no questions)

Read and drive the view; do not design. The audit brief, shown in one message, holds:

- **Today's inventory:** everything the view shows and every action it offers, listed.
- **The flow as it is:** the happy path in steps, with counts: clicks, decisions, typing,
  tab stops to the main action.
- **States reachable** in the scenarios, each photographed (both themes).
- **The friction log** (from the spec, and anything new the lenses in `student-lens.md`
  turn up).
- **Handoffs** out and in, and whether Back works.
- **Data:** what it reads, writes and listens for.
- **What is locked**, with where it is written.
- **What you could not determine.**

The user corrects facts, nothing more. Exit: the user has seen the brief.

## Gate 1: Purpose and inventory

Seeds (ask only what the audit did not settle):

- The mission, in one sentence: "For the student <moment>, this view lets them <job> so
  that <outcome>." What is the moment? What are they doing just before and just after?
- What must this view **show**, what **should** it show, what must it **never** show?
  (The never-show list is as important as the rest.)
- What must it let them **do**? Which single action is primary?
- What must it **link** to and receive from (handoffs), and what travels?
- What can be **removed** outright? What is here only out of habit?
- What is this view **not** for?

Artifact: the mission sentence, and the **inventory table**: element | shows / does /
links | must, should or never | why. Exit: every high-weight seed answered and the
inventory confirmed. In a redesign whose purpose is clearly unchanged, this gate is a
quick confirm of the mission and the inventory, not a full interview.

## Gate 2: Flow and layout

Before asking, **simulate the student** (below) on each candidate layout, and drop the
ones that fail. Seeds:

- The flow's steps and their count budget (clicks, decisions, tab stops).
- The hierarchy: what is seen first; where the primary action sits; what is always
  visible, on focus, one click away, or gone.
- Placement within the panel width (440px; 800px in Focus), and how the view uses the
  height.
- How state is seen at a glance (what is done, waiting, failed).
- Where each handoff sits and how Back returns.
- Two or three genuinely different layouts, **as ASCII wireframes in the option
  previews**, for each key state.
- Density: how much fits before it is too much.

Artifact: a wireframe per key state and the flow with its counts. Exit: the wireframes
are confirmed.

## Gate 3: Behavior and states

Seeds: progressive disclosure (what is veiled and how it opens); the empty, loading,
slow, failed and interrupted states; feedback and motion (calm, reduced motion); the
keyboard order and shortcuts; Night; what persists across a handoff, a tab switch and a
reload; undo versus confirm; copy for every message; which components are reused, which
are extended, which are new.

Artifact: the **state table** (state | what shows | how to reach it) and the component
list. Exit: every state of the flow is named and decided.

## Gate 4: Data, backend and acceptance

Seeds: what it reads, writes and listens for; the backend wants (fields, endpoints,
events) and what each costs; anything to migrate; the scenarios the harness needs; the
**budget** as numbers (clicks, decisions, tab stops, seconds to the main action); risks.

Also run the **cross-view consistency check** here, before asking:

- The same concept is named and placed the same way as in the other views and screens.
- Every handoff's target exists, accepts what it is sent, and can send the student back.
- A handoff that needs the neighbouring view to change is written down as a want for
  that view, not assumed.

Artifact: the **data table**, the **wants**, and the **acceptance list** (scenarios and
budget numbers). Exit: the acceptance list is confirmed.

## The student walkthrough simulation

Before a wireframe goes to the user, walk it as the tired student. For each candidate:
name the moment they arrive; take the main flow step by step (what they see, what they
decide, what they tap); count clicks, decisions, typing and tab stops; then try the
awkward cases: they are half asleep and mis-tap; the guide is still being written; the
model failed; they came back from Ask; they reloaded. Report where they get stuck or
confused, in a line each. Drop a candidate that fails a hard case, and say why. Show the
user the ones that survive, with the counts.

## The post-build review round

After the build and the checks: photograph the real view (both themes, every key
scenario, viewport about 1500 tall, clipped to the panel and its log). Show the photos.
Then a short grill (at most two batches): what feels off, what to cut, what is missing,
with your recommended fix on each. Record the answers in `grill.md` under the dated
heading **Post-build**, as decisions or as assumed. Small fixes become a `tweak`; a
large one reopens the gate it belongs to.

## Mapping onto the grill file

`grill.md` follows `grill/references/grill-file.md`. Its Summary's "In one line" is the
mission sentence; its artifacts are the inventory table, the wireframes, the state
table and the data and acceptance tables. The Q&A log is verbatim. `status` moves
grilling, awaiting OK, approved, built.
