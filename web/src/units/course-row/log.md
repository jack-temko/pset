# Course row: log

The grill of 2026-10-13, word for word (the questions that concern the course row).

- Course row on Home: what is clickable? The row opens the set; the course name opens
  the course (Recommended) / The row opens the course / Nothing but two links. **"the
  row opens the course, and just the course, but there will be a list of the few that
  are due soon"**
- Course row: which columns? Course, current set, progress, due (Recommended) / Add
  the materials count / Course and due only. **"depends if its the due soon list or
  the course list"**
- A course row shows: Name, unfinished sets, next due (Recommended) / Name only / Name,
  materials, sets. **Name, materials, sets.**
- How many rows can the list hold? Five, then a 'Show all' link (Recommended) / All of
  them / Three. **Five, then a 'Show all' link (Recommended).**
- Home's two lists will mostly name the same courses twice. Keep both lists? One list:
  a course row that holds its active set (Recommended) / Keep both lists, as decided /
  Only the 'In progress' list. **One list: a course row that holds its active set
  (Recommended).** (Jack first said: **"Something to note about my own usage. I most
  often only ever have one active assignment in each course."**)

## The row is rebuilt (2026-10-14)

Jack looked at the course row on his phone: **"Unfortunately the course row looks
absolutely horrible. More GitHub-ey And it has components that don't exist. We need to
package as tightly as possible, this will be used in the window pane for sets likely
too."** He confirmed what "components that don't exist" means: **Parts drawn by hand,
not from units** (the rules between rows, the hover, the counts line, "Nothing active"
and the list's frame styled inside the course row).

- How tight is a course row? Two lines, GitHub issue style (Recommended) / One line /
  Show me both. **Two lines, GitHub issue style (Recommended).**

## Proposed, to confirm (the orchestrator, not asked)

The row no longer shows the materials and sets counts (they go to the course screen),
which reverses Jack's "Name, materials, sets" above. Pending his OK.

## Round of 2026-10-14, annotations

Jack, on the bars in this row's aside: **"The progress bars need to be longer."**, and
on the "0 of 6" beside one: **"This needs to be larger"**.

The bar unit takes both (see the progress bar's log): its continuous shape now fills
the room the count leaves in the aside instead of holding a fixed 72px, and its count
is set one type step up. The segmented shape also gets its 2px gaps back, which a
theme lockdown had silently dropped.

The wider bar needed more room than a 120 aside gives once the count is larger, so the
course row's aside is 160 and the bar fills it beside the count. The width is the
orchestrator's call, pending Jack's eye; the list row's own default and the set line's
aside stay 120.
