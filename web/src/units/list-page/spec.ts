import { defineSpec } from '@/design/spec';

const ASSUMED = 'Assumed, to confirm with Jack';

export default defineSpec({
  id: 'list-page',
  kind: 'view',
  title: 'List page',
  group: 'Screens',
  purpose:
    'The one page every list that passes five rows opens: a heading, a filter bar and the same list box holding every match, for a student looking for an old set or a thing PSet remembers.',
  exampleWidth: 'full',
  states: [
    {
      id: 'filtered',
      name: 'Pre-filtered from Show all',
      when: 'Opened from "Show all 6" under ECE 210’s Done: the course and state are already set, the path reads "Home / ECE 210 / Work", and the rows carry no course name.',
      text: 'Finished',
    },
    {
      id: 'all-courses',
      name: 'Across courses',
      when: 'Opened from Home’s Assignments: every course, to do, soonest due first; each row names its course.',
      text: 'All courses',
    },
    {
      id: 'no-matches',
      name: 'No matches',
      when: 'The search matches nothing: one quiet line with Clear filters; the switch still shows where the counts are.',
      text: 'No sets match',
    },
    {
      id: 'many',
      name: 'Hundreds of sets',
      when: 'Nearly three hundred finished sets: every one in one scroll, no pages and no Load more.',
      text: 'Done',
    },
    {
      id: 'memories',
      name: 'Memories',
      when: 'The same page for what PSet remembers: the header switch reads "Yours 12 · From Ask 8", rows are the text and when it was added.',
      text: 'From Ask',
    },
  ],
  stress:
    'Nearly three hundred sets, 95 character names and a 55 character course: names truncate, the list scrolls and the filter bar holds one line.',
  flows: [
    {
      id: 'find-an-old-set',
      name: 'Find an old set',
      steps: ['search', 'open-set'],
    },
    {
      id: 'narrow-by-course',
      name: 'Narrow to one course',
      steps: ['pick-course', 'open-set'],
    },
    {
      id: 'start-over',
      name: 'Start over after no match',
      steps: ['search', 'clear-filters'],
    },
  ],
  actions: [
    {
      id: 'search',
      label: 'Search sets',
      does: 'Narrows the list to names that contain what is typed, as it is typed.',
    },
    {
      id: 'pick-course',
      label: 'Course',
      does: 'Opens a menu of All courses and each course; the button shows the current one, and the path gains the course.',
    },
    {
      id: 'pick-state',
      label: 'State',
      does: 'Opens a menu of the list’s states; it moves the header switch, and the switch moves it.',
    },
    {
      id: 'pick-sort',
      label: 'Sort',
      does: 'Opens a menu of orders; the button shows the current one.',
    },
    {
      id: 'switch-state',
      label: 'To do, Done',
      does: 'The header switch: swaps the rows to that state, both counts always in view.',
    },
    {
      id: 'clear-filters',
      label: 'Clear filters',
      does: 'In the no-matches line: empties the search and sets the course back to All courses.',
    },
    {
      id: 'open-set',
      label: 'A set’s name',
      does: 'Opens the set in the workspace. The workspace is not wired to this view yet, so it has no target.',
    },
  ],
  data: [
    {
      reads:
        'Every set (name, course, due, questions done and total, time left, when finished) or every memory (text, course, source, when added)',
      call: 'sample',
    },
  ],
  inputs: [
    {
      name: 'page',
      does: 'The kind of list, work or memories, and every item in it.',
    },
    {
      name: 'initial',
      does: 'Where the filters start: what "Show all" came from.',
    },
    { name: 'today', does: 'The moment due dates count from.' },
    { name: 'homeHref', does: 'Where the wordmark and "Home" go.' },
    { name: 'settingsHref', does: 'Where Settings goes.' },
  ],
  priority: {
    first: 'The list: its switch with both counts, then the rows.',
    main: 'open-set',
  },
  sizes: {
    gives: [
      'Names truncate in rows',
      'The progress bar narrows before the due date does',
      'The search field narrows before the menus do',
    ],
  },
  rules: {
    cite: [
      'work-first',
      'honest-waits',
      'dates-only-given',
      'room-for-big-type',
      'one-primary',
      'say-it-once',
      'sentence-case',
      'student-decides',
    ],
  },
  log: 'web/src/units/list-page/log.md',
  decisions: [
    {
      id: 'list-page-d1',
      decision:
        'One page template for any kind of item that passes the cap: path, heading, filter bar, the list box. Work and Memories use it now.',
      why: 'Jack: "Any that pass the cap (Recommended)" (L4): one page to learn.',
      beat: 'Work and Memories only; Work only',
      date: '2026-11-04',
    },
    {
      id: 'list-page-d2',
      decision:
        'The page narrows with a search field that matches names and menus for Course, State and Sort, each showing its current value. No typed filters.',
      why: 'Jack: "Search field + menus (Recommended)" (L5): readable at a glance, nothing to learn.',
      beat: 'Typed filters ("is:done course:ECE210"); search only',
      date: '2026-11-04',
    },
    {
      id: 'list-page-d3',
      decision:
        'One scroll holds every match: no pages. Filters start from Show all’s list; the sample keeps them in state, as the design page’s address is taken.',
      why: 'Jack: "One scroll, all rows (Recommended)" (L6). The address is A2 of the grill, assumed; the sample keeping state is a harness limit.',
      beat: 'Pages of 25; Load 50 more',
      date: '2026-11-04',
    },
    {
      id: 'list-page-d4',
      decision:
        'A row is the summary’s own row (set, due tag, due date, progress bar), plus the course name on line two when the page spans courses.',
      why: 'Jack: "Same rows as summaries (Recommended)" (L10): cross-page uniformity.',
      beat: 'A table with sortable columns',
      date: '2026-11-04',
    },
    {
      id: 'list-page-d5',
      decision:
        'Sort defaults: work by due date while to do and newest finished once done; memories newest first. Choosing a state puts the sort back to its default.',
      why: `${ASSUMED} (A5 of the grill).`,
      beat: 'One fixed order',
      date: '2026-11-04',
    },
    {
      id: 'list-page-d6',
      decision:
        'The page is reached only from a list’s "Show all"; the top bar path ("Home / ECE 210 / Work") leads back. It has no entry of its own.',
      why: 'Jack: "Only via Show all (Recommended)" (L7).',
      beat: 'Permanent Work and Memories entries in the top bar',
      date: '2026-11-04',
    },
    {
      id: 'list-page-d7',
      decision:
        'The State menu and the header switch are one setting shown twice. Memories use the same pair: "Yours 12 · From Ask 8".',
      why: 'Jack: "It becomes the header switch (Recommended)" (L11), and L5’s menus. Both places is assumed; the menu may go.',
      beat: 'A kind menu on the page only',
      date: '2026-11-04',
    },
  ],
});
