import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'assignment-row',
  kind: 'component',
  title: 'Assignment row',
  group: 'Lists',
  purpose:
    'One assignment as a two-line list row, for Home: the set and its due label, the course, time left and when it was last opened, the due date and a progress bar.',
  states: [
    {
      id: 'due-soon',
      name: 'Due soon',
      when: 'Due within 2 days: an attention "Due soon" label after the set name, and the date at the right.',
    },
    {
      id: 'overdue',
      name: 'Overdue',
      when: 'Past its date: a red "Overdue" label, and the date at the right.',
    },
    {
      id: 'later',
      name: 'Due later',
      when: 'Due within 7 days but not soon: the plain date, no label.',
    },
    {
      id: 'opened',
      name: 'Opened recently, no near date',
      when: 'Listed because it was opened in the last 7 days: line two ends "Opened 2 h ago".',
    },
    {
      id: 'no-time',
      name: 'No time estimate',
      when: 'PSet does not know the time left yet: that item is simply absent.',
    },
    {
      id: 'list',
      name: 'Home: assignments and courses',
      when: 'Home: an Assignments list of five rows, due soon first, then a Courses list of five lean rows.',
    },
  ],
  exampleWidth: 960,
  stress:
    'A 70 character set name and a 40 character course name at 320px: the bar is gone and the title and meta truncate.',
  components: [
    { unit: 'list-row', use: 'The row: title, label, status, meta and aside.' },
    { unit: 'progress-bar', use: 'The set\u2019s progress, in the aside.' },
    {
      unit: 'set-line',
      use: 'The due date, its label and the time-left wording.',
    },
    { unit: 'link', use: 'The course name in the meta.' },
    { unit: 'list', use: 'Frames the five rows in the Home example.' },
    { unit: 'section-heading', use: 'Titles each list in the Home example.' },
    {
      unit: 'course-row',
      use: 'The Courses list below it in the Home example.',
    },
  ],
  actions: [
    {
      id: 'open-set',
      label: 'The set name',
      key: 'Enter',
      does: 'Opens the set in the workspace, where the student left off. The workspace is not a unit yet, so it has no target.',
    },
    {
      id: 'open-course',
      label: 'The course name in the meta',
      key: 'Enter',
      does: 'Opens the course. The course screen is not a unit yet, so it has no target.',
    },
  ],
  inputs: [
    {
      name: 'set, href',
      type: 'string',
      default: 'none',
      does: 'The set\u2019s name and where it opens.',
    },
    {
      name: 'course, courseHref',
      type: 'string',
      default: 'none',
      does: 'The course\u2019s name and where it opens.',
    },
    {
      name: 'done, total',
      type: 'number',
      default: 'none',
      does: 'Problems done and in the set; they draw the progress bar.',
    },
    {
      name: 'minutesLeft',
      type: 'number',
      default: 'none',
      does: 'The time left, shown only when PSet knows it.',
    },
    {
      name: 'due',
      type: 'Date',
      default: 'none',
      does: 'A local calendar date (see parseDueDate); without it no date or label shows.',
    },
    {
      name: 'reason',
      type: "'due' | 'opened'",
      default: 'none',
      does: 'Why it is listed; only an `opened` one says when it was opened.',
    },
    {
      name: 'openedAt',
      type: 'Date',
      default: 'none',
      does: 'When the student last opened it; read for an `opened` one.',
    },
    {
      name: 'today',
      type: 'Date',
      default: 'now',
      does: 'The moment "within 2 days" and "Opened 2 h ago" count from; for the design page and tests.',
    },
  ],
  priority: {
    first: 'The set\u2019s name, then when it is due.',
    main: 'open-set',
  },
  sizes: {
    narrowest: 320,
    gives: [
      'The progress bar goes below 440, and the count stays in the meta',
      'Then the meta truncates, as a whole',
      'Then the set name truncates',
    ],
  },
  rules: {
    cite: [
      'work-first',
      'honest-waits',
      'dates-only-given',
      'colour-has-a-word',
      'links-go-buttons-do',
      'contrast-floors',
      'figures-follow-text',
      'sentence-case',
    ],
  },
  log: 'web/src/units/assignment-row/log.md',
  decisions: [
    {
      id: 'assignment-row-d1',
      decision:
        'Home has two lists: Assignments, then Courses, with an info area above them later. An assignment names its set, course, due, progress and time left.',
      why: 'Jack: "I want two lists on my home screen ... The two lists are for assignments and courses." He said yes to reversing S13.',
      beat: 'One list of courses, each holding its active set (S13)',
      date: '2026-10-16',
    },
    {
      id: 'assignment-row-d2',
      decision:
        'An assignment that is listed because it was opened also shows "Opened 2 h ago" at the end of line two; one listed for its date does not.',
      why: 'Jack picked "Last opened" as the extra an assignment shows.',
      beat: 'Next problem; neither',
      date: '2026-10-16',
    },
    {
      id: 'assignment-row-d3',
      decision:
        'The list holds sets due within 7 days (past ones too) or opened in the last 7 days, due soon at the top, then the recently opened.',
      why: 'Jack picked "Due within 7 days or opened in the last 7, cap 5" and asked for due soon at the top.',
      beat: 'Every unfinished set',
      date: '2026-10-16',
    },
    {
      id: 'assignment-row-d4',
      decision:
        'At most 5 assignments show, then "Show all"; the rule and the cap live in listAssignments.',
      why: 'Jack: "With a limit and gate to show more." He picked cap 5 over cap 3.',
      beat: 'A cap of 3',
      date: '2026-10-16',
    },
    {
      id: 'assignment-row-d5',
      decision:
        'The due date always shows at the right; a "Due soon" or "Overdue" label sits after the set name, as on the set line.',
      why: 'Jack, 2026-10-16: the badge replaced the date, and he chose a label after the name (set-line-d7).',
      beat: 'The label in place of the date',
      date: '2026-10-16',
    },
  ],
});
