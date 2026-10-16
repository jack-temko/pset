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

## Round of 2026-10-15, annotations

Jack: **"Todays bars are still to short in the horizontal direction. Especially when on
a large screen."**

The aside is no longer a fixed 160: it is a fifth of the row, `clamp(160px, 20cqw,
320px)` through the list row's aside width, so a wide row carries a wide bar and the
count keeps its 160 of room at the floor. The set line's 120 aside stays as it is: its
page did not overflow, and its pane is narrow anyway. The due tag also moved level with
the bar, centred in the row (see the list row's log).

## The fork in the bar (2026-10-14)

The bar is one continuous bar everywhere now, no segments and no switch above 12 (see
the progress bar's log). Segmented bars return with the work pane, wider than this.

## The badge in place of the date (2026-10-16)

Jack on the course list, annotating with Agentation (2026-10-16): **"These look weird because it replaces the original text. Can we try to always have the due date, but have badges for overdue and due soon? Where is a good place to put them?"** Then: **"With the date always shown, where does the 'Due soon' or 'Overdue' badge go?"** Options: After the course name, like a GitHub label (Recommended) / Just before the date, on the right / In the grey line, after the set name. Answer: **After the course name, like a GitHub label (Recommended).**

The course row passes the set line’s badge to the list row’s label slot, after the course name; its status is the plain date.

## Materials and sets as icon stats (2026-10-16)

Jack, on "The course row no longer shows '7 materials, 3 sets' (they would move to the course screen). Is that OK?" Options: Yes, drop them from the row (Recommended) / Keep them in the grey line. His answer: **"Can we display this with some muted icons and digits somewhere? Kinda how github does the line diffs"**

First built as two muted stats at the end of line two: materials with `FileText`, sets with `ListChecks` (lucide's closest to a document and a checklist), each a 12px glyph and a number, its label ("7 materials", "3 sets", singular at 1) in a tooltip. Zero shows "0". A course with nothing active reserves the aside's width too, so the stats line up down the list.

Jack, on where they go: **"have them be to the right of the course name"**

So the stats sit on line one: the course name, then the stats, then the "Due soon" or "Overdue" label. The earlier placement at the end of line two, and the aside-width spacer it needed on a course with nothing active, are gone.

Jack, on which counts and where: **"drop the material count, leave the set count, move it to be on the set line, after everthing, separated by the dot"**

So there is no materials count in the row. The sets count (`ListChecks`) is the last item of line two, after the set, the time left and "+N more", joined by " · ", as a muted icon and number with its "3 sets" tooltip (singular at 1; zero shows 0). On a "Nothing active" row it follows that line. Line one is the course name and its label again.

Jack, next: **"Don't show "No active set" or whatever if there is none, just empty. And drop the dot it looks weird with the icon"**

So a course with nothing active has no words: its line two holds only the sets count, or nothing, and the row keeps its height (the list row always draws line two, at least 20 high). The state is renamed `no-active`. A stat is set apart by a 12px gap, not a " · ".

## Two lists: the course row goes lean (2026-10-16)

Jack, reshaping Home (2026-10-16): **"I want to separate them, sorry for making this hard on you. I want two lists on my home screen, plus some info on top (e.g. github style heatmap for work, stat tile, big greeting, this will be done later). The two lists are for assignments and courses. The assignment list will display recently opened, and due soon. With a limit and gate to show more. Due soon at the top. The courses list with just show courses. First from a students perspective, what should be show on each of these two types of list items? Then we will design them."**

Then four answers:

- "This reverses S13 (written 2026-10-14: Home is one list of courses, each holding its active set). New Home: info on top (later), then an assignments list, then a courses list. Reverse S13?" Yes, reverse it (Recommended) / No, keep one list. **Yes, reverse it (Recommended).**
- "Which extras does an assignment item show, beyond name, course, due, progress and time left? Pick any." Last opened / Next problem / Neither. **Last opened.**
- "What does a course item show besides its name?" Sets still to do, as a muted count (Recommended) / Name only / Sets and materials counts. **Sets still to do, as a muted count (Recommended).**
- "Which assignments are in the list, and how many before 'Show all'?" Due within 7 days or opened in the last 7, cap 5 (Recommended) / Every unfinished set, cap 5 / Due within 7 days or opened in the last 7, cap 3. **Due within 7 days or opened in the last 7, cap 5 (Recommended).**

So the course row is one 44 high line: the name, then a muted `ListChecks` count of sets still to do ("3 sets to do", singular at 1, 0 shown). The nearest active set, its due, count, time left, bar, badge and "+N more" move to the assignment row; `nearest.ts` and the sort by nearest due are gone. Decision course-row-d11 supersedes the active-set decisions, the sort and the stats.

## Two lines again (2026-10-16)

Jack, on the lean course row looking empty ("What, if anything, goes on the right of a course row?" Time this week (Recommended) / Next due date / Last opened / Leave it lean): **"can we make it two lines? the lower line should be the material count + last opened, time this week is aside"**

Then: **"sets to do can move down too"**

So the course row is a two-line list row again, 56 high like the assignment rows. Line one is the name alone. Line two is the sets-to-do count (`ListChecks`), the materials count (`FileText`), each 12px apart, then after the same gap "Opened yesterday" (the assignment row's `openedAgo` wording, and "Opened Oct 3" beyond a week; nothing when never opened). The aside is "2 h 10 m this week", muted and right-aligned in the same width as the assignment rows' aside. The one-line `single` mode is removed from the list row, as nothing uses it.

## Words instead of icons, no last opened (2026-10-16)

Jack, on the course row: **"drop the "open yesterday" line, change the icons to text, e.g. 3 sets * 5 materials"**, then the question "In '3 sets · 5 materials', is 3 the sets still to do, or all the course's sets?" Still to do, worded '3 to do' (Recommended) / Still to do, worded '3 sets' / All the course's sets. **Still to do, worded '3 to do' (Recommended).**

So line one is the name alone, line two is plain muted text, "3 to do · 5 materials" ("1 material", "0 to do", "0 materials"), joined by " · ", and the aside is the time this week. There are no icons and no tooltips; `openedAt` and the opened wording are gone from the course row (the assignment row keeps its own).

Jack, a last wording change: **"add "sets" so its "sets to do""**

Line two reads "3 sets to do · 5 materials" ("1 set to do", "0 sets to do").
