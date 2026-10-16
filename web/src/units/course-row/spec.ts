import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'course-row',
  kind: 'component',
  title: 'Course row',
  group: 'Lists',
  purpose:
    'One course as a two-line list row: its name; its sets to do, materials and last opened; and the time this week as its aside. Assignments are their own list.',
  states: [
    {
      id: 'to-do',
      name: 'Sets to do',
      when: 'A course with sets still to do: the count on line two, with its materials and when it was opened.',
    },
    {
      id: 'one',
      name: 'One of each',
      when: 'One set to do and one material: the tooltips read "1 set to do" and "1 material", singular.',
    },
    {
      id: 'none',
      name: 'None to do',
      when: 'Every set is done, or there are none: the counts show 0, and 0 m this week.',
    },
    {
      id: 'never-opened',
      name: 'Never opened',
      when: 'The student has not opened the course: line two has no "Opened" text.',
    },
    {
      id: 'list',
      name: 'Home: assignments and courses',
      when: 'Home: an Assignments list of five rows, 40 below it a Courses list of five rows, each list under a section heading with a Counter and "Show all".',
    },
  ],
  exampleWidth: 960,
  stress:
    'A 70 character course name at 320px: the aside is gone, the name truncates and line two truncates.',
  components: [
    {
      unit: 'list-row',
      use: 'The row itself: title, meta stats and the aside.',
    },
    {
      unit: 'set-line',
      use: 'The minutes wording, "2 h 10 m".',
    },
    {
      unit: 'assignment-row',
      use: 'The Assignments list above it in the Home example.',
    },
  ],
  actions: [
    {
      id: 'open-course',
      label: 'The course name',
      key: 'Enter',
      does: 'Opens the course. The course screen is not a unit yet, so it has no target.',
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
      does: 'Where the course name goes.',
    },
    {
      name: 'todo',
      type: 'number',
      default: 'none',
      does: 'Sets still to do: a muted icon and number on line two, zero as 0.',
    },
    {
      name: 'materials',
      type: 'number',
      default: 'none',
      does: 'Materials in the course: a muted icon and number on line two, zero as 0.',
    },
    {
      name: 'openedAt',
      type: 'Date',
      default: 'none',
      does: 'When the student last opened it, as "Opened yesterday"; nothing when never.',
    },
    {
      name: 'weekMinutes',
      type: 'number',
      default: 'none',
      does: 'Minutes spent this week: "2 h 10 m this week" in the aside, "0 m this week" for none.',
    },
    {
      name: 'today',
      type: 'Date',
      default: 'now',
      does: 'The moment "Opened 2 h ago" counts from; for the design page and tests.',
    },
  ],
  priority: {
    first: 'The course\u2019s name.',
    main: 'open-course',
  },
  sizes: {
    narrowest: 280,
    gives: [
      'The time this week goes below 440',
      'Then line two truncates, as a whole',
      'Then the course name truncates',
    ],
  },
  rules: {
    cite: [
      'course-first',
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
      supersededBy: 'course-row-d11',
    },
    {
      id: 'course-row-d3',
      decision:
        'No materials or sets counts in the row; it shows the nearest active set, its due, count, time left and bar.',
      why: 'The orchestrator\u2019s proposal to package the row tightly; Jack then asked for the counts back as icon stats.',
      beat: 'Name, materials, sets (Jack, 2026-10-13)',
      date: '2026-10-14',
      supersededBy: 'course-row-d8',
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
    {
      id: 'course-row-d8',
      decision:
        'The materials and sets counts show as muted icon stats at the right of the course name.',
      why: 'Jack: "Can we display this with some muted icons and digits somewhere? Kinda how github does the line diffs"',
      beat: 'Dropping them from the row; "materials, sets" in words',
      date: '2026-10-16',
      supersededBy: 'course-row-d9',
    },
    {
      id: 'course-row-d9',
      decision:
        'The sets count shows last on the set line as a muted icon and number; no materials count.',
      why: 'Jack: drop the material count, keep the set count on the set line.',
      beat: 'Both counts after the course name (course-row-d8)',
      date: '2026-10-16',
      supersededBy: 'course-row-d11',
    },
    {
      id: 'course-row-d10',
      decision:
        'A course with nothing active shows no words; the sets count stands alone, after a gap, not a dot.',
      why: 'Jack: just empty; the dot looks weird with the icon.',
      beat: '"Nothing active" and a dot before the count',
      date: '2026-10-16',
      supersededBy: 'course-row-d11',
    },
    {
      id: 'course-row-d11',
      decision:
        'A course row is one 44 high line: the name, then a muted ListChecks count of sets still to do. No sets, badge, bar or date.',
      why: 'Jack: separate assignments and courses (S14); a course shows "Sets still to do, as a muted count".',
      beat: 'The nearest active set in the row; sort by due; two counts (d2 to d10)',
      date: '2026-10-16',
      supersededBy: 'course-row-d12',
    },
    {
      id: 'course-row-d12',
      decision:
        'A course row has two lines: the name; sets to do, materials count and last opened; with the time this week as its aside.',
      why: 'Jack: the one-line row looked empty.',
      beat: 'One line with the to-do count only (course-row-d11)',
      date: '2026-10-16',
    },
  ],
});
