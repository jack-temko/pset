# List pattern: grill

- status: awaiting OK
- date: 2026-11-04
- brief: how every list in PSet shows more of itself (replacing Course's "Done (6)" fold, Home's dead "Show all" and Memory's inline expand), judged from a tired student checking what is due or looking for an old set
- sources:
  - `web/src/units/course/index.tsx` (the Done fold), `web/src/units/assignment-row/home.tsx` (Home's "Show all", `href="#"`), `web/src/units/list`, `web/src/units/fold`
  - the memory-mocks branch, `web/src/units/memory/index.tsx` (layout D, `MEMORY_CAP` 5, Show all / Show fewer, All / Yours / From Ask)
  - `ideas/course-view-grill.md` (C3: one Work list, Done folded), `ideas/settings-view-grill.md`
  - GitHub: Issues' Open / Closed header switch, the repo sidebar's "+ 31 contributors" links, one shared index page for issues, pull requests, repositories and people; Primer's progressive disclosure guidance ("used sparingly, only when it's necessary to truncate")
  - memory: desktop only; one active set per course is the common case

## Summary

### In one line

Every list is one box with an optional state switch in its header, at most 5 rows on a
summary screen, and a "Show all 14" row at its foot that opens one shared list page,
pre-filtered to where you came from.

### Decisions

| #   | Decision                                                                                                                                          | Why                                                                     | Beat                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------- |
| L1  | A list with states shows them as a switch in its header, "To do 1 · Done 6", which swaps the rows in the same box. It replaces Course's Done fold | Both counts always in view, Done one click away, the same on every list | A restyled fold; a separate Done list                |
| L2  | Summary screens show at most 5 rows; more opens the list page. Nothing expands inline                                                             | One rule everywhere, and a summary never grows                          | Expand inline everywhere; inline to ~20, then a page |
| L3  | The link is the last row inside the box, "Show all 14", with the count                                                                            | Where the eye ends after the rows; says how many wait                   | "Show all" at the header's right, as Home has now    |
| L4  | One list page template for any kind of item that passes the cap (in practice Work and Memories; courses and one course's materials rarely do)     | One page to learn, ready for any list that grows                        | Work and Memories only; Work only                    |
| L5  | The page narrows with a search field (matches names) and menus for Course, State and Sort, each showing its current value                         | Readable at a glance, nothing to learn                                  | Typed filters ("is:done course:ECE210"); search only |
| L6  | The page shows every match in one scroll: no pages, no Load more                                                                                  | Hundreds at most for a student; scrolling and find-in-page beat paging  | Pages of 25; Load 50 more                            |
| L7  | The page is reached only from a list's "Show all"; the top bar path ("Home / ECE 210 / Work") leads back                                          | No new navigation to learn                                              | Permanent Work and Memories entries in the top bar   |
| L8  | A list whose To do side is empty stays on To do with one quiet row, "Nothing to do"; Done keeps its count in the header                           | The box shows the same thing every visit                                | Switch to Done by itself                             |
| L9  | The cap applies to to-do rows too: 5, soonest due first, then "Show all 7"                                                                        | One rule; a heavy week is rare with one set per course                  | Never cap to-do                                      |
| L10 | Rows on the page are the summary's own rows, plus the course name when the page spans courses                                                     | Cross-page uniformity                                                   | A table with sortable columns                        |
| L11 | Memory's All / Yours / From Ask filter becomes the header switch, "Yours 12 · From Ask 8"                                                         | The same control in the same place on every list                        | A kind menu on the page only                         |

### The artifact(s)

**The list box**: header (title, the switch's counts when the list has states) · up to 5 rows · "Show all N" foot row when more exist. A list without states (Materials, Courses) has a plain header.

**The list page**: top bar path · heading ("Work", "Memories") · filter bar (search field, Course, State, Sort) · the same list box, every match, one scroll.

**Lists it changes**: Home's assignments and courses (Show all moves from the header to the foot, and goes somewhere), Course's Work (Done fold becomes the switch) and Materials, Memory D (inline Show all and its filter become the switch and the page).

**States**: summary under the cap, at the cap with Show all, To do empty, page with filters set from Show all, page with no matches ("No sets match", with Clear filters), page loading (the Loaded standard).

### Assumed

- A1: Memory D's "New" rows (from Ask, awaiting Keep) stay on top of the box and do not count toward the cap.
- A2: The page's filters live in its address, so Back restores them; opening it from Show all sets them from where you came.
- A3: The Settings folds (Models, Checks, Errors) stay folds: they fold away detail, not more of a list.
- A4: The switch shows only the states a list has; a list with one state has no switch.
- A5: Sort defaults: Work by due date (to do) and newest finished (done); Memories newest first.
- A6: Sample data only on `/design`; the page's real data waits for the wiring change.

### Open

None.

## Reversals

- C3 in `ideas/course-view-grill.md` (2026-10-30, "One list, Done folded"): the Done fold becomes the header switch (L1). Jack chose it as the replacement in this grill, asked as "What should replace it?".

## Disagreements

None.

## Frontier

None: the high-weight questions are answered; the rest is under Assumed.

## Log

Jack, 2026-11-03: "Also I don't love the Done expand button on the course page, how does github do segmented table section expanding? Maybe we have a list page similar to github for searching filters and viewing more items of a list. So courses show more, material show more, homework show more, etc, etc, opens up a page thats similar for all of them but like githubs issues page. Is this a good idea? Is there an inline version of this that would work well for all locations? Do some good research and come up with the best unifying option for this job"

After the research and recommendation: "start the grill on the details"

### Batch 1

- Course's Work list has finished sets folded under "Done (6)". What should replace it? Options: Switch in header (Recommended); Keep a fold, restyled; Separate Done list. Answer: "Switch in header (Recommended)"
- When a list has more items than fit, how do you see the rest? Options: Cap 5, Show all page (Recommended); Expand inline everywhere; Inline, then a page. Answer: "Cap 5, Show all page (Recommended)"
- Where does the "Show all" link sit on a capped list? Options: Foot, with a count (Recommended); Header right, as Home now. Answer: "Foot, with a count (Recommended)"

### Batch 2

- Which kinds of items get the shared list page? Options: Any that pass the cap (Recommended); Work and Memories only; Work only. Answer: "Any that pass the cap (Recommended)"
- How do you narrow the list on that page? Options: Search field + menus (Recommended); Typed filters; Search field only. Answer: "Search field + menus (Recommended)"
- A list page with hundreds of rows: how does it show them? Options: One scroll, all rows (Recommended); Pages of 25; Load more button. Answer: "One scroll, all rows (Recommended)"
- How do you get to a list page? Options: Only via Show all (Recommended); Also from the top bar. Answer: "Only via Show all (Recommended)"

### Batch 3

- A list whose To do side is empty (everything done). What does its box show? Options: Stay on To do, say so (Recommended); Switch to Done. Answer: "Stay on To do, say so (Recommended)"
- Does the 5-row cap also apply to to-do rows (say, 7 sets due on Home)? Options: Yes, one rule (Recommended); Never cap to-do. Answer: "Yes, one rule (Recommended)"
- How do rows look on the list page? Options: Same rows as summaries (Recommended); A table with columns. Answer: "Same rows as summaries (Recommended)"
- Memory D's All / Yours / From Ask filter: what becomes of it? Options: It becomes the header switch (Recommended); A menu on the page only. Answer: "It becomes the header switch (Recommended)"
