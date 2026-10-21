import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'problem-strip',
  kind: 'component',
  title: 'Problem strip',
  group: 'Work',
  purpose:
    'The whole set as one line of numbered chips: done filled, current outlined, failed in the danger colour. One click jumps to a problem; hover names it.',
  states: [
    {
      id: 'in-progress',
      name: 'In progress',
      when: 'Some done (filled), the current one outlined, the rest plain.',
    },
    {
      id: 'failed',
      name: 'A problem not found',
      when: 'The chip of a problem that could not be found is in the danger colour; hover says "not found".',
    },
    {
      id: 'finding',
      name: 'A problem being found',
      when: 'The chip of a problem still being found is dashed; hover says "being found".',
    },
    {
      id: 'all-done',
      name: 'All done',
      when: 'Every chip filled, none outlined, as on the finish card.',
    },
  ],
  exampleWidth: 560,
  stress:
    '30 chips with labels of 60 characters: the strip wraps to more rows and the hover names each in full.',
  actions: [
    {
      id: 'jump',
      label: 'A chip',
      key: 'Enter',
      does: 'Goes to that problem in one click.',
    },
  ],
  inputs: [
    {
      name: 'chips',
      type: 'Chip[]',
      default: 'none',
      does: 'Each problem’s id, its label and its state: todo, done, failed or finding.',
    },
    {
      name: 'current',
      type: 'string',
      default: 'none',
      does: 'The id of the problem the student is on, outlined.',
    },
    {
      name: 'onJump',
      type: '(id) => void',
      default: 'none',
      does: 'Which chip was pressed.',
    },
  ],
  priority: {
    first: 'Which one is current, then how many are done.',
    main: 'jump',
  },
  sizes: {
    narrowest: 320,
    gives: ['The strip wraps to more rows'],
  },
  components: [
    { unit: 'tooltip', use: 'Names a chip by its label and state on hover.' },
  ],
  rules: {
    cite: [
      'work-first',
      'colour-has-a-word',
      'contrast-floors',
      'honest-waits',
    ],
  },
  log: 'web/src/units/problem-strip/log.md',
  decisions: [
    {
      id: 'problem-strip-d1',
      decision:
        'One problem at a time, with a strip of numbered chips above it: done filled, current outlined, jump anywhere in one click.',
      why: 'Jack picked "One at a time + strip (Recommended)" (P1).',
      beat: 'One scrolling list; today’s counter menu',
      date: '2026-10-21',
    },
    {
      id: 'problem-strip-d2',
      decision:
        'A chip that could not be found is in the danger colour, one still being found is dashed, and hover adds the word.',
      why: 'Assumed in the work pane grill: colour is never the only signal.',
      beat: 'Colour alone',
      date: '2026-10-21',
    },
  ],
});
