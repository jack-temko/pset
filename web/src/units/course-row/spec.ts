import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'course-row',
  kind: 'component',
  title: 'Course row',
  group: 'Lists',
  purpose:
    'One course as a two-line list row: its name, the nearest active set with its due, count and time left, and a progress bar.',
  states: [
    {
      id: 'due-soon',
      name: 'One active set, due soon',
      when: 'The nearest active set is due within 2 days: an attention "Due soon" badge after the course name, and the date at the right.',
    },
    {
      id: 'overdue',
      name: 'Overdue',
      when: 'The nearest active set is past due: a red "Overdue" badge after the course name, and the date at the right.',
    },
    {
      id: 'no-date',
      name: 'One active set, no date',
      when: 'The active set has no date: no badge and no date are shown.',
    },
    {
      id: 'two-active',
      name: 'Two active sets',
      when: 'The row shows the nearest and a muted "+1 more" link to the course.',
    },
    {
      id: 'nothing-active',
      name: 'Nothing active',
      when: 'No set is active: the meta line reads "Nothing active".',
      text: 'Nothing active',
    },
    {
      id: 'empty',
      name: 'Empty course',
      when: 'A course with nothing in it yet: the same "Nothing active" line.',
      text: 'Nothing active',
    },
    {
      id: 'list',
      name: 'Home: a list of five',
      when: 'Home: a section heading with a Counter and "Show all", then a list of five course rows.',
    },
  ],
  exampleWidth: 960,
  stress:
    'A 70 character course name and a 70 character set name at 320px: the bar is gone and the title and meta truncate.',
  components: [
    { unit: 'list-row', use: 'The row itself: title, status, meta and aside.' },
    {
      unit: 'progress-bar',
      use: 'The nearest set\u2019s progress, in the aside.',
    },
    {
      unit: 'set-line',
      use: 'The due date, its badge and the time-left wording.',
    },
    { unit: 'link', use: 'The set and "+1 more" links in the meta.' },
    { unit: 'list', use: 'Frames the five rows in the Home example.' },
    { unit: 'section-heading', use: 'Titles the list in the Home example.' },
  ],
  actions: [
    {
      id: 'open-course',
      label: 'The course name',
      key: 'Enter',
      does: 'Opens the course. The course screen is not a unit yet, so it has no target.',
    },
    {
      id: 'open-set',
      label: 'The set name in the meta',
      key: 'Enter',
      does: 'Opens the nearest active set in the workspace. The workspace is not a unit yet, so it has no target.',
    },
  ],
  inputs: [
    {
      name: 'name',
      type: 'string',
      default: 'none',
      does: 'The course\u2019s name.',
    },
    {
      name: 'href',
      type: 'string',
      default: 'none',
      does: 'Where the course name goes; also "+1 more".',
    },
    {
      name: 'active',
      type: 'set props[]',
      default: 'none',
      does: 'The active sets (set, done, total, minutesLeft, due, href); the nearest is shown.',
    },
    {
      name: 'today',
      type: 'Date',
      default: 'now',
      does: 'The day "within 2 days" counts from; for the design page and tests.',
    },
  ],
  priority: {
    first: 'The course\u2019s name, then its due.',
    main: 'open-set',
  },
  sizes: {
    narrowest: 320,
    gives: [
      'The aside goes below 440, and the count stays in the meta',
      'Above that, the aside is a fifth of the row (160 to 320), and the bar fills the room the count leaves',
      'Then the meta truncates, as a whole',
      'Then the course name truncates',
    ],
  },
  rules: {
    cite: [
      'course-first',
      'work-first',
      'links-go-buttons-do',
      'contrast-floors',
      'figures-follow-text',
      'sentence-case',
    ],
  },
  log: 'web/src/units/course-row/log.md',
  decisions: [
    {
      id: 'course-row-d1',
      decision:
        'A course row shows the course\u2019s name (opens the course), its materials and sets counts, and its active sets, each opening its set.',
      why: 'Usually one active set per course, so one list names each course once.',
      beat: 'A list of sets in progress plus a separate list of courses',
      date: '2026-10-13',
      supersededBy: 'course-row-d3',
    },
    {
      id: 'course-row-d2',
      decision:
        'Home sorts courses by their nearest active due date, then courses with no dated active set, then courses with nothing active; at most five, then "Show all".',
      why: 'Home stays short and the most urgent course comes first.',
      beat: 'All of them; three',
      date: '2026-10-13',
    },
    {
      id: 'course-row-d3',
      decision:
        'Proposed, to confirm: no materials or sets counts in the row; it shows the nearest active set, its due, count, time left and bar.',
      why: 'The orchestrator\u2019s proposal, pending Jack\u2019s OK: it reverses his earlier "Name, materials, sets", to package the row as tightly as a two-line row allows.',
      beat: 'Name, materials, sets (Jack, 2026-10-13)',
      date: '2026-10-14',
    },
    {
      id: 'course-row-d4',
      decision:
        'A course row is a two-line list row, GitHub issue style, built from the list row and nothing drawn by hand.',
      why: 'Jack: "Unfortunately the course row looks absolutely horrible. More GitHub-ey", and it had parts that were not components.',
      beat: 'One line; the two-column row with stacked set lines',
      date: '2026-10-14',
    },
    {
      id: 'course-row-d5',
      decision:
        'The aside is 160 wide, so the bar fills it beside the count instead of squeezing under it.',
      why: 'Jack: "The progress bars need to be longer." The width is the orchestrator\u2019s call, pending Jack\u2019s eye.',
      beat: 'A 120 aside, where the larger count ate the bar\u2019s room',
      date: '2026-10-14',
      supersededBy: 'course-row-d6',
    },
    {
      id: 'course-row-d6',
      decision:
        'The aside is a fifth of the row: 20cqw of the row container, floored at 160 and capped at 320, so the bar grows on wide rows.',
      why: 'Jack: "Todays bars are still to short in the horizontal direction. Especially when on a large screen."',
      beat: 'A fixed 160 aside (course-row-d5)',
      date: '2026-10-15',
    },
    {
      id: 'course-row-d7',
      decision:
        'The nearest set\u2019s due date is always shown at the right; a "Due soon" or "Overdue" badge sits after the course name, as set-line-d7 says.',
      why: 'Jack: "These look weird because it replaces the original text." He chose a badge after the course name, like a GitHub label.',
      beat: 'The badge in place of the date',
      date: '2026-10-16',
    },
  ],
});
