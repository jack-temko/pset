# The student lens

The persona: hour 7 of a study marathon, 1am, Night theme, glancing between a
textbook scan and the panel, low patience, low working memory. Everything below
is a question asked of the view in that state. Each lens produces friction rows;
a lens that finds nothing says so in the run's notes and produces no row.

## Before the lenses: walk the flow

Write it down before judging it: the trigger (what brought them here), their
goal, and the happy path as numbered steps, each with what they see, what they
decide and what they do. Then count, on the path as it is now: clicks, decisions,
typing. Those counts are checked against the spec's `budget` and are the numbers
a redesign has to beat. Note the exits and the re-entry after a break.

## The ten lenses

1. **Glance test.** Eyes half shut for two seconds: what is this, what state is it
   in, what is the one next action? One primary action per region. If two things
   compete, one of them is wrong.
2. **Visibility ladder.** Every element sits on one rung: always visible, on focus
   or hover, one click away, or gone. The default is gone. An element earns a
   higher rung by being needed on the common path, not by being possible.
3. **Only what is valid now.** No disabled buttons for states that cannot be
   reached; the actions offered follow the state. A control that does nothing yet
   is noise.
4. **Decision load.** Count the choices on screen at once. Prefer recognition to
   recall. The common path takes defaults and no typing.
5. **Stuck.** Dead ends. Empty states that do not say what to do. Waits with no
   sign of progress or time left. Errors that do not say whether the work is safe
   or what to try. Irreversible acts (undo beats confirm when it can be undone).
6. **Confused.** Jargon. Internal states leaking into the UI ("located", "pending").
   Unlabelled icons. Look-alike actions. State changes with no feedback.
7. **Tired-body ergonomics.** No precision aiming (targets at least the control
   height, and not crowded); no hover-only affordances; the whole flow works from
   the keyboard with a sensible tab order (count the tab stops to the main
   action), Enter to confirm, Esc to back out; scroll position, drafts and the
   current place survive a reload or a tab switch; Night is the primary theme and
   must read, not just pass; motion is calm and honours reduced motion.
8. **Re-entry.** After a break, does the view say where you left off and what is
   next, without opening anything?
9. **Trust.** When the model is slow or wrong, is the student ever blamed? Can they
   see the source behind an answer, and correct it?
10. **Handoffs.** Everywhere the student's next need is another view: is there a
    door to it, does the context travel so they never retype or re-find it, and
    does Back put them exactly where they were (place, selection, draft, scroll)?
    A handoff that drops the student into a cold view, or strands them there, is
    a finding. Check it in the harness's handoff log, out and back.

## Reading a view honestly

- Drive it, do not just read it: the scenarios exist so the awkward states are
  reachable (`slow`, `failed`, `mid-flow-reload`, `return-after-break`).
- Do the main flow **keyboard only** once, and **in Night**, before writing the
  log. A view that passes in Paper at a mouse's pace often fails there.
- Judge at 1280 wide. Below 1024 the app shows a gate; it is desktop only.
- Look for what is missing as much as what is wrong: no way to see the set at a
  glance, no place in line, no "where was I".

## The friction log

One table in the spec, kept across runs: fixed rows are marked, unfixed rows carry
to the next run. A row is:

| id | where | what goes wrong for a tired student | severity | fix | status |
|---|---|---|---|---|---|

- **id**: `F<n>`, never reused.
- **where**: the element or moment, findable in a scenario.
- **what goes wrong**: the consequence for the student in one sentence, not the
  implementation ("the open set is lost on a tab switch", not "the component
  unmounts").
- **severity**: `blocker` (they lose work, place or trust), `friction` (they lose
  time or attention every time), `polish` (rough, but they get through).
- **fix**: the change, small enough to name in a line.
- **status**: `open`, `fixed (branch)`, `raise with Jack` (it contradicts a locked
  decision), `dropped (why)`.

Every row names a scenario that shows it. A finding that cannot be shown in a
scenario needs a scenario first.

## What to propose, in order

Remove it. Then merge it into something already there. Then move it down the
ladder (into a menu, behind a click, on focus). Then make it clearer. Only then
add something, and then reuse a component before making one. A view that got
simpler is the goal; a view with more controls needs a reason written in `why`.
