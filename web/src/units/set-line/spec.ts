import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'set-line',
  kind: 'component',
  title: 'Set line',
  group: 'Lists',
  purpose:
    'One active set on one line: its name, how far along, the time left and when it is due. The line opens the set.',
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
      when: 'A started set the course gave no date: it sorts after the dated ones.',
      text: 'No date',
    },
  ],
  stress:
    'A 70 character set name in a 360px container: it truncates on one line.',
  components: [
    { unit: 'progress-bar', use: 'The set’s progress on each line.' },
    { unit: 'tag', use: 'The attention tag for a set due within 2 days.' },
  ],
  actions: [
    {
      id: 'open-set',
      label: 'The line',
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
      does: 'A local calendar date (see parseDueDate); without it the line says "No date".',
    },
    {
      name: 'href',
      type: 'string',
      default: 'none',
      does: 'Where the line goes.',
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
    narrowest: 360,
    gives: [
      'The time left goes below 600',
      'Then the progress bar shrinks itself: its segments narrow, then one continuous bar; its count always shows',
      'The set name truncates',
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
    local: [
      {
        id: 'set-line-one-line',
        rule: 'Keep a line on one line per cell; truncate, never wrap.',
        check: 'The stress state keeps the line 40 high.',
        scope: 'set-line',
      },
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
  ],
});
