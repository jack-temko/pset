# Professor's notes

## Status

**Planned** · phase 3, with [importing](importing-assignments.md). It
could go earlier on its own: typed text already carries notes ("3.24
(use matlab)"), which the parser accepts and then throws away.

## Information

### Why

Professors change the problem, and the app ignores them. The EECS 202
page says "4.25 (no PSpice or MulitSim)", and the guide for 4.25 ends
with a PSpice netlist. Notes in Jack's sources:

- **Parts to do**: "6 (do c)".
- **Restrictions**: "no PSpice or MultiSim", "use the method from the
  corresponding section".
- **Extras**: "also graph the solution", "hand in a printout of your
  program".
- **Changed givens**: "do it for 500 packets, each with 150 bits",
  "express your answer in terms of p, which you know to be 0.5 or
  greater", "find power to the 12-Ohm resistor!".
- **Where**: "all on page 24". This one is for the finder, not the guide.

### Decided (2026-09-25)

Notes are **instructions the guide follows**: stored with the question,
shown under its statement, and given to the writer as binding. "do c"
means only part c is walked through; a changed number replaces the
book's. Editable, like the figure reading.

### How

- A question gets a `notes` list, filled by the import (or the reference
  parser, from a typed "(...)") and editable on the question.
- The guide's brief puts them first, above the problem: "Your
  professor's instructions for this problem, which override the book:
  ...". A changed given is restated in the guide's opening so the
  student sees which numbers it used.
- A page hint goes to the finder as a cited page instead.

### Weight

Small: ~100 lines (a column, the brief, a line under the statement and
its editor), much of it shared with the figure reading's editing.

### Risks

- A note that doesn't apply to the book problem as found (a typo, or a
  problem the professor renumbered) can send the guide wrong. Showing
  the notes beside the statement is what catches that.
- Editing notes after a guide exists: rewrite it, as a corrected reading
  does.
