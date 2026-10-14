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
      when: 'A set due within 2 days: the attention tag carries the day, even at 0 of 6.',
    },
    {
      id: 'later',
      name: 'Due later',
      when: 'A set due more than 6 days away: month and day, plain.',
    },
    {
      id: 'overdue',
      name: 'Overdue',
      when: 'A set past its due date: a red "Overdue" tag.',
      text: 'Overdue',
    },
    {
      id: 'no-date',
      name: 'No date',
      when: 'A started set the course gave no date: no status is shown, and it sorts after the dated ones.',
    },
  ],
  stress:
    'A 70 character set name in a 360px container: the bar is gone, the title and the meta truncate, the count stays.',
  components: [
    {
      unit: 'list-row',
      use: 'The row: title, status, meta and the progress aside.',
    },
    { unit: 'progress-bar', use: 'The set\u2019s progress, in the aside.' },
    { unit: 'tag', use: 'The attention and danger tags for the due status.' },
  ],
  actions: [
    {
      id: 'open-set',
      label: 'The title',
      key: 'Enter',
      does: 'Opens the set in the workspace. The workspace is not a unit yet, so it has no target.',
    },
  ],
  inputs: [
    { name: 'set', type: 'string', default: 'none', does: 'The set’s name.' },
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
      does: 'A local calendar date (see parseDueDate); without it no status is shown.',
    },
    {
      name: 'href',
      type: 'string',
      default: 'none',
      does: 'Where the title goes.',
    },
    {
      name: 'today',
      type: 'Date',
      default: 'now',
      does: 'The day "within 2 days" counts from; for the design page and tests.',
    },
  ],
  priority: {
    first: 'The set’s name, then when it is due.',
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
        'A line shows the set, its progress, the time left when known, and when it is due; a set due within 2 days carries an attention tag. No course name.',
      why: 'Everything needed to pick tonight’s work; the course row around it names the course.',
      beat: 'Without the time; with the course name',
      date: '2026-10-13',
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
    },
    {
      id: 'set-line-d5',
      decision:
        'A due date is a weekday within 6 days ("Due Fri"), then month and day ("Due Oct 20"). The attention tag still applies within 2 days.',
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
    },
  ],
});
