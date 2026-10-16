# Assignment row: log

Jack, reshaping Home (2026-10-16): **"I want to separate them, sorry for making this hard on you. I want two lists on my home screen, plus some info on top (e.g. github style heatmap for work, stat tile, big greeting, this will be done later). The two lists are for assignments and courses. The assignment list will display recently opened, and due soon. With a limit and gate to show more. Due soon at the top. The courses list with just show courses. First from a students perspective, what should be show on each of these two types of list items? Then we will design them."**

Then four answers:

- "This reverses S13 (written 2026-10-14: Home is one list of courses, each holding its active set). New Home: info on top (later), then an assignments list, then a courses list. Reverse S13?" Yes, reverse it (Recommended) / No, keep one list. **Yes, reverse it (Recommended).**
- "Which extras does an assignment item show, beyond name, course, due, progress and time left? Pick any." Last opened / Next problem / Neither. **Last opened.**
- "What does a course item show besides its name?" Sets still to do, as a muted count (Recommended) / Name only / Sets and materials counts. **Sets still to do, as a muted count (Recommended).**
- "Which assignments are in the list, and how many before 'Show all'?" Due within 7 days or opened in the last 7, cap 5 (Recommended) / Every unfinished set, cap 5 / Due within 7 days or opened in the last 7, cap 3. **Due within 7 days or opened in the last 7, cap 5 (Recommended).**

What the assignment row shows, from the student's side: the set (opens where they left off) with its Due soon or Overdue label, the course, the time left when known, "Opened 2 h ago" when it is listed for having been opened, the due date, and the progress bar. It is the old course row's set line moved into its own list. The inclusion rule and the cap are `listAssignments` in `listed.ts`: due within 7 days (past ones too) or opened in the last 7, the due ones first by date, then the opened ones newest first, five shown, the rest counted for "Show all". A set that is both is shown as due.
