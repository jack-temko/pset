# List row: log

Jack, 2026-10-14, about the course row: **"Unfortunately the course row looks absolutely
horrible. More GitHub-ey And it has components that don't exist. We need to package as
tightly as possible, this will be used in the window pane for sets likely too."**

- How tight is a course row? Two lines, GitHub issue style (Recommended) / One line /
  Show me both. **Two lines, GitHub issue style (Recommended).**

## Settled afterwards (the orchestrator, not asked)

The row's shape: line one the title and a status, line two the meta joined by " · ",
an aside at the right with a width passed in. Hover is the `hover` ground; only the
title is a link, so no link wraps another.

## Round of 2026-10-14, annotations

Jack, on the due tags on a row's first line: **"These need to be centered vertically"**.

Measured, the status already shares the title's centre: line one is a 24px box with
both centred in it, whatever the status is (a 24px tag or small text). What read as
off was elsewhere on the page: the counter pill beside the section heading drew with
no padding and hung off the line (see the counter's and section heading's logs). The
status's centring is now the typed decision, not an accident: centred on line one,
against the middle of the title.

## Round of 2026-10-15, annotations

Jack again, on the same due tags: **"These need to be centered vertically in the row
please. Take a look at GitHub and how they do badges like that in rows."**

Re-measured first. On the title's line they already centred (title text centre 359.5,
tag 360, plain due text 421 against its title's 421): the fix above had landed. What
did not centred was the row: the tag sat at line-one height, its centre 360 against
its row's centre 425.5, while the progress column at the same right edge centred in
the row. GitHub's issue rows were measured for the pattern: their labels ride centred
on the title's line, but the badge-like column at a row's right edge (avatar and
comment count) centres in the whole row (badge centre 514 against row centre 514.5).
Primer's Label page carries no inline-alignment guidance (checked 2026-10-14); the
pattern is GitHub's own issue rows.

So the status left line one and became a child of the row itself, beside the aside,
centred vertically in the row like it. Line one is the title alone.
