import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'set-line',
  kind: 'component',
  title: 'Set line',
  group: 'Lists',
  purpose:
    'One active set as a list row, for the window pane: its name, when it is due, the count, the time left and a progress bar. The title opens the set.',
  states: [
    {
      id: 'with-time',
      name: 'In progress, with time left',
      when: 'A started set whose time left PSet knows.',
    },
    {
      id: 'without-time',
      name: 'In progress, without time left',
      when: 'A started set whose time left PSet does not know yet: the column stays empty.',
    },
    {
      id: 'due-soon',
      name: 'Due soon, not started',
      when: 'A set due within 2 days: an attention "Due soon" badge after the name, and the date at the right, even at 0 of 6.',
    },
    {
      id: 'later',
      name: 'Due later',
      when: 'A set due more than 6 days away: month and day, plain, with no badge.',
    },
    {
      id: 'overdue',
      name: 'Overdue',
      when: 'A set past its due date: a red "Overdue" badge after the name, and the date at the right.',
      text: 'Overdue',
    },
    {
      id: 'no-date',
      name: 'No date',
      when: 'A started set the course gave no date: no badge and no date are shown, and it sorts after the dated ones.',
    },
  ],
  stress:
    'A 70 character set name in a 360px container: the title and the meta truncate, the bar stays.',
  actions: [
    {
      id: 'open-set',
      label: 'The title',
      does: 'Opens the set in the workspace. The workspace is not a unit yet, so it has no target.',
    },
  ],
  inputs: [
    { name: 'set', does: 'The set’s name.' },
    {
      name: 'done',
      does: 'Problems done; with total they draw the progress bar.',
    },
    {
      name: 'total',
      does: 'Problems in the set.',
    },
    {
      name: 'minutesLeft',
      does: 'The time left, shown only when PSet knows it.',
    },
    {
      name: 'due',
      does: 'A local calendar date (see parseDueDate); without it no status is shown.',
    },
    { name: 'href', does: 'Where the title goes.' },
    {
      name: 'today',
      does: 'The day "within 2 days" counts from; for the design page and tests.',
    },
  ],
  priority: {
    first: 'The set’s name, then when it is due.',
    main: 'open-set',
  },
  sizes: {
    gives: [
      'Then the meta truncates, as a whole',
      'Then the set name truncates',
    ],
  },
  exampleWidth: 720,
  rules: {
    cite: [
      'work-first',
      'honest-waits',
      'dates-only-given',
      'colour-has-a-word',
      'contrast-floors',
      'figures-follow-text',
    ],
  },
  log: 'web/src/units/set-line/log.md',
  decisions: [
    {
      id: 'set-line-d1',
      decision:
        'A set is active if it is in progress, or due within 2 days even if not started.',
      why: 'Jack; nothing urgent can hide.',
      beat: 'Up to 5 dated sets; only started sets (first said)',
      date: '2026-10-13',
    },
    {
      id: 'set-line-d2',
      decision:
        'A line shows the set, its progress, the time left when known, and when it is due; a set due within 2 days carries an attention badge. No course name.',
      why: 'Everything needed to pick tonight’s work; the course row around it names the course.',
      beat: 'Without the time; with the course name',
      date: '2026-10-13',
      supersededBy: 'set-line-d7',
    },
    {
      id: 'set-line-d3',
      decision: 'The whole line opens the set in the workspace.',
      why: 'The work comes first.',
      beat: 'Two small links',
      date: '2026-10-13',
    },
    {
      id: 'set-line-d4',
      decision:
        'A set past its due date shows a red "Overdue" tag with an alert glyph, never a day.',
      why: 'Jack: overdue must not look like a day this week.',
      beat: '"Overdue Sat" in amber; the same as due soon',
      date: '2026-10-14',
      supersededBy: 'set-line-d7',
    },
    {
      id: 'set-line-d5',
      decision:
        'A due date is a weekday within 6 days ("Due Fri"), then month and day ("Due Oct 20"). The "Due soon" badge still applies within 2 days.',
      why: 'Jack: a weekday is clear this week and ambiguous after it.',
      beat: 'Always month and day; as built ("Due Mon 20")',
      date: '2026-10-14',
    },
    {
      id: 'set-line-d6',
      decision:
        'A set line is a two-line list row: title and due, then count and time left, the bar at the right. Narrow, the bar goes first.',
      why: 'Jack: "We need to package as tightly as possible, this will be used in the window pane for sets likely too."',
      beat: 'A one-line grid of columns',
      date: '2026-10-14',
      supersededBy: 'set-line-d8',
    },
    {
      id: 'set-line-d7',
      decision:
        'The due date always shows at the right as plain text; a "Due soon" or "Overdue" badge sits after the set name as a label.',
      why: 'Jack: "These look weird because it replaces the original text. Can we try to always have the due date, but have badges?"',
      beat: 'The badge in place of the date (set-line-d2, d4)',
      date: '2026-10-16',
    },
    {
      id: 'set-line-d8',
      decision:
        'A set line is a two-line list row: title and due, then time left, the bar at the right. The count is the bar; it is not repeated.',
      why: 'Desktop only: the bar never goes first, so the count has no place to stay (ideas/spec-format-grill.md, F10).',
      beat: 'The bar going first when narrow, with the count in the meta (set-line-d6)',
      date: '2026-10-22',
    },
  ],
});
