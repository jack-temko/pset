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

## The badge in place of the date (2026-10-16)

Jack on the course list, annotating with Agentation (2026-10-16): **"These look weird because it replaces the original text. Can we try to always have the due date, but have badges for overdue and due soon? Where is a good place to put them?"** Then: **"With the date always shown, where does the 'Due soon' or 'Overdue' badge go?"** Options: After the course name, like a GitHub label (Recommended) / Just before the date, on the right / In the grey line, after the set name. Answer: **After the course name, like a GitHub label (Recommended).**

The list row gains a `label` slot right after the title on line one, 8 apart, centred on the title; the title truncates first. The status is whatever the caller gives.

## The hover target (2026-10-16)

Jack, same pass, on the course name "Linear algebra" and the "Nothing active" line: **"The hover target for these links should not expand across the entire row, just cover the text."**

The row had a hover wash over its whole width, so the course name looked clickable everywhere. Only its links are clickable now, so the row takes no hover ground, and a title link is as wide as its text (`w-fit`), never a full-width block. The row would keep a wash only if the whole row were one link; it never is.

## Stats (2026-10-16)

Jack, on "The course row no longer shows '7 materials, 3 sets' (they would move to the course screen). Is that OK?" Options: Yes, drop them from the row (Recommended) / Keep them in the grey line. His answer: **"Can we display this with some muted icons and digits somewhere? Kinda how github does the line diffs"**

First built as a `stats` slot: `{icon, value, label}` items at the right end of line two, right-aligned under the status, like GitHub's counts and line diffs. Each is a 12px lucide glyph then the number, 4 apart, 12 between stats, in the small step with tabular numbers and `fg-muted`, in a tooltip with its label. They sit in a fixed 96 wide column, so they align down a list, and go below 440 before the meta truncates. With stats, the status takes line one of that column, level with the title, instead of centring in the row.

Jack, on where they go: **"have them be to the right of the course name"**

The stats moved to line one, right after the title and before the label, 8 apart each. They go below 440, before the label does; the title still truncates first. They no longer share a column, since each follows its own title. The status is centred in the row again.

Jack, on which counts and where: **"drop the material count, leave the set count, move it to be on the set line, after everthing, separated by the dot"**

The separate `stats` slot is removed, since nothing else uses it: a count is now a meta item, `MetaStat` (`list-row/stat.tsx`: a 12px icon and number with its words in a tooltip). The meta line still truncates as a whole, so the count, being last, goes first when it narrows.
