import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'work-row',
  kind: 'component',
  title: 'Work row',
  group: 'Lists',
  purpose:
    'One problem set on one line: its name and course, how far along, the time left and when it is due. The row opens the set.',
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
      id: 'no-date',
      name: 'No date',
      when: 'A started set the course gave no date: it sorts after the dated ones.',
      text: 'No date',
    },
    {
      id: 'list',
      name: 'A list of five',
      when: 'Home shows at most five rows, then "Show all": the columns line up down the list.',
    },
  ],
  stress:
    'A 70 character set name and a 50 character course name in a 360px container: both truncate on one line.',
  components: [
    { unit: 'progress-bar', use: 'The set’s progress in each row.' },
    { unit: 'tag', use: 'The attention tag for a set due within 2 days.' },
    {
      unit: 'section-heading',
      use: 'Titles the list of five in the examples.',
    },
    { unit: 'link', use: 'The "Show all" action in the examples.' },
  ],
  actions: [
    {
      id: 'open-set',
      label: 'The row',
      key: 'Enter',
      does: 'Opens the set in the workspace. The workspace is not a unit yet, so it has no target.',
    },
  ],
  inputs: [
    { name: 'set', type: 'string', default: 'none', does: 'The set’s name.' },
    {
      name: 'course',
      type: 'string',
      default: 'none',
      does: 'The course’s name, under the set’s.',
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
      does: 'When it is due; without it the row says "No date".',
    },
    {
      name: 'href',
      type: 'string',
      default: 'none',
      does: 'Where the row goes.',
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
      'The progress count goes below 440, leaving the segments',
      'The set and course names truncate',
    ],
  },
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
        id: 'work-row-one-line',
        rule: 'Keep a row on one line per cell; truncate, never wrap.',
        check: 'The stress state keeps the row 56 high.',
        scope: 'work-row',
      },
    ],
  },
  log: 'web/src/units/work-row/log.md',
  decisions: [
    {
      id: 'work-row-d1',
      decision:
        'Home lists sets in progress, sorted by due date, plus any set due within 2 days even if not started.',
      why: 'Jack; nothing urgent can hide.',
      beat: 'Up to 5 dated sets; only started sets (first said)',
      date: '2026-10-13',
    },
    {
      id: 'work-row-d2',
      decision:
        'A row shows the set, its course, its progress, the time left when known, and when it is due; a set due within 2 days carries an attention tag.',
      why: 'Everything needed to pick tonight’s work.',
      beat: 'Without the course; without the time',
      date: '2026-10-13',
    },
    {
      id: 'work-row-d3',
      decision: 'The whole row opens the set in the workspace.',
      why: 'The work comes first.',
      beat: 'Two small links',
      date: '2026-10-13',
    },
    {
      id: 'work-row-d4',
      decision: 'At most five rows, then a "Show all" link.',
      why: 'Home stays short.',
      beat: 'All of them; three',
      date: '2026-10-13',
    },
  ],
});
