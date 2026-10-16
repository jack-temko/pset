import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'progress-bar',
  kind: 'component',
  title: 'Progress bar',
  group: 'Basics',
  purpose:
    'How far a set is done: one continuous bar, the done share in blue, with the count in words beside it.',
  states: [
    {
      id: 'none-done',
      name: 'None done',
      when: 'A set not started: the bar is empty.',
    },
    {
      id: 'some-done',
      name: 'Some done',
      when: 'A set in progress: the done share of the bar is blue.',
    },
    {
      id: 'all-done',
      name: 'All done',
      when: 'Every problem is done: the fill turns grey.',
    },
    {
      id: 'one-problem',
      name: 'One problem',
      when: 'A set of one problem: the bar fills as it is done.',
    },
    {
      id: 'twelve',
      name: 'Twelve problems',
      when: 'A plain continuous example: the same one bar at any total.',
    },
    {
      id: 'thirty',
      name: 'Thirty problems',
      when: 'A smaller share of the same one bar, filling the room the count leaves.',
    },
  ],
  stress:
    'Twelve problems in a 96px container: the bar shrinks to its 16px floor; the count stays whole.',
  actions: [],
  inputs: [
    {
      name: 'done',
      type: 'number',
      default: 'none',
      does: 'How many problems are done; kept between 0 and total.',
    },
    {
      name: 'total',
      type: 'number',
      default: 'none',
      does: 'How many problems the set has.',
    },
  ],
  priority: {
    first: 'The count, "2 of 6", beside the bar.',
  },
  sizes: {
    narrowest: 80,
    gives: ['The bar shrinks to its 16px floor', 'The count never gives way'],
  },
  rules: {
    cite: ['colour-has-a-word', 'contrast-floors', 'figures-follow-text'],
    local: [
      {
        id: 'progress-has-words',
        rule: 'Show a progress bar with its value in words beside it.',
        check:
          'Every bar has "N of M" next to it. Settled afterwards, not asked: the builder\'s.',
        scope: 'progress-bar',
      },
    ],
  },
  log: 'web/src/units/progress-bar/log.md',
  decisions: [
    {
      id: 'progress-bar-d1',
      decision:
        'A segment per problem, done ones in blue, always with "2 of 6" beside it; above 12 problems, one continuous bar.',
      why: 'Primer: pair a progress bar with its value in text.',
      beat: 'One continuous bar; the count alone',
      date: '2026-10-13',
      supersededBy: 'progress-bar-d5',
    },
    {
      id: 'progress-bar-d2',
      decision:
        'When narrow, keep the count and shrink the bar: segments narrow to 4px, then one continuous bar takes over. The bar adapts to its own width.',
      why: 'Jack: the count "2 of 6" always shows beside the bar.',
      beat: 'Hide the count when narrow; drop the bar, keep the count',
      date: '2026-10-14',
    },
    {
      id: 'progress-bar-d3',
      decision:
        'The continuous bar is fluid: it fills the room the count leaves, from 16 up, instead of holding a fixed width.',
      why: 'Jack: "The progress bars need to be longer."',
      beat: 'A fixed 72px bar with slack left in its aside',
      date: '2026-10-14',
    },
    {
      id: 'progress-bar-d4',
      decision: 'The count is set in the body step, one step up from small.',
      why: 'Jack: "This needs to be larger".',
      beat: 'The count in the small step',
      date: '2026-10-14',
    },
    {
      id: 'progress-bar-d5',
      decision:
        'One continuous bar everywhere: the done share in blue, the rest in border, the count in words beside it.',
      why: 'Jack: "Lets go with continuous bars everywhere. I will add back segmented progress bars when the homework pane lands. They need to be wider."',
      beat: 'A segment per problem (progress-bar-d1, Jack 2026-10-13)',
      date: '2026-10-14',
    },
    {
      id: 'progress-bar-d6',
      decision:
        'The count sits in a box as wide as "99 of 99" in its own type step, right-aligned, so the bar is the same length on every row.',
      why: 'Jack: "Can we make sure that the progress bar and this text are in the same location for every row/ The length of the numbers affects the offset of the bar."',
      beat: 'A count as wide as its numbers',
      date: '2026-10-16',
    },
  ],
});
