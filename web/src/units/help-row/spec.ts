import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'help-row',
  kind: 'component',
  title: 'Help row',
  group: 'Work',
  purpose:
    'One step of help (Hint, Walkthrough or Answer) as a closed row that opens in place, or says it is still being written and how long it should take.',
  states: [
    {
      id: 'closed',
      name: 'Closed',
      when: 'The default: a chevron and the step’s name.',
    },
    {
      id: 'open',
      name: 'Open',
      when: 'The student opened it: the help text sits under the row, in the serif. Any number of rows can be open at once.',
    },
    {
      id: 'writing',
      name: 'Being written',
      when: 'The step is not written yet: a spinner and the wait, and the row does not open.',
      text: 'Writing the walkthrough · about 20 s',
    },
  ],
  exampleWidth: 560,
  stress:
    'A walkthrough of 30 lines with a 70 character unbroken word, open: it wraps and nothing overflows.',
  actions: [
    {
      id: 'toggle',
      label: 'The row',
      key: 'Enter',
      does: 'Opens the row, or closes it when open. A row that is being written ignores the press.',
    },
  ],
  inputs: [
    {
      name: 'title',
      type: 'string',
      default: 'none',
      does: 'The step: Hint, Walkthrough or Answer.',
    },
    {
      name: 'state',
      type: "'ready' | 'writing'",
      default: 'ready',
      does: 'Writing swaps the title for the wait.',
    },
    {
      name: 'seconds',
      type: 'number',
      default: '20',
      does: 'How long the writing should take, said as "about 20 s".',
    },
    {
      name: 'open, onToggle',
      type: 'boolean, () => void',
      default: 'closed',
      does: 'Whether the text shows, and what a press asks for.',
    },
  ],
  priority: { first: 'The step’s name.', main: 'toggle' },
  sizes: {
    narrowest: 320,
    gives: ['The title truncates', 'The text wraps, long words break'],
  },
  components: [],
  rules: {
    cite: [
      'smallest-help-first',
      'student-decides',
      'honest-waits',
      'serif-to-read',
      'sentence-case',
    ],
  },
  log: 'web/src/units/help-row/log.md',
  decisions: [
    {
      id: 'help-row-d1',
      decision:
        'Help steps are closed rows under the problem, and any can be open at once.',
      why: 'Jack picked "Rows under the problem (Recommended)" (P13).',
      beat: 'Tabs, one open at a time',
      date: '2026-10-21',
    },
    {
      id: 'help-row-d2',
      decision:
        'A step still being written shows "Writing the walkthrough · about 20 s" on its own row and does not open.',
      why: 'Jack picked "Problem first, help says when (Recommended)" (P10).',
      beat: 'One waiting line for everything',
      date: '2026-10-21',
    },
  ],
});
