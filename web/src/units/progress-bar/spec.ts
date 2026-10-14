import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'progress-bar',
  kind: 'component',
  title: 'Progress bar',
  group: 'Basics',
  purpose:
    'How far a set is done: a segment per problem, with the count in words beside it. Past twelve problems, one bar.',
  states: [
    {
      id: 'none-done',
      name: 'None done',
      when: 'A set not started: every segment is empty.',
    },
    {
      id: 'some-done',
      name: 'Some done',
      when: 'A set in progress: the done segments are blue.',
    },
    {
      id: 'all-done',
      name: 'All done',
      when: 'Every problem is done: every segment turns grey.',
    },
    {
      id: 'one-problem',
      name: 'One problem',
      when: 'A set of one problem: a single segment.',
    },
    {
      id: 'twelve',
      name: 'Twelve problems',
      when: 'The most that is still drawn as segments.',
    },
    {
      id: 'thirty',
      name: 'Thirty problems',
      when: 'More than twelve: one continuous bar, 72 wide.',
    },
  ],
  stress:
    'Thirty problems in a 96px container: the count stays whole and the bar shrinks.',
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
    narrowest: 64,
    gives: [
      'The bar shrinks, segments first narrower, then the continuous bar',
      'The count never shrinks',
    ],
  },
  rules: {
    cite: ['colour-has-a-word', 'contrast-floors', 'figures-follow-text'],
    local: [
      {
        id: 'progress-has-words',
        rule: 'Show a progress bar with its value in words beside it.',
        check: 'Every progress bar on the page has "N of M" next to it.',
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
    },
  ],
});
