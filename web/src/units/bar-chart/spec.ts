import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'bar-chart',
  kind: 'component',
  title: 'Bar chart',
  group: 'Home',
  purpose:
    'A week as vertical bars from one baseline, Monday to Sunday, today in the accent with its day in the full text colour, with the figure over each bar.',
  states: [
    {
      id: 'midweek',
      name: 'Midweek',
      when: 'Days so far as bars, today in the accent, the days to come as bare tracks.',
    },
    {
      id: 'full-week',
      name: 'A full week',
      when: 'All seven days have gone; none is future. Today, Sunday, is the accent bar.',
    },
    {
      id: 'quiet',
      name: 'A quiet week',
      when: 'No time yet: each past day is an empty track and no figure shows.',
    },
  ],
  stress:
    'Seven days at 280px with figures of "10 h 45 m": at under 360px the figures are hidden, the bars and days stay.',
  actions: [],
  data: [
    {
      reads: 'Minutes studied on each day of this week',
      call: 'sample',
    },
  ],
  inputs: [
    {
      name: 'bars',
      does: 'One per column: the day under it, its figure, the words over it and in its tooltip, and whether it is today or still to come.',
    },
  ],
  priority: { first: 'Today’s bar, then the tallest.' },
  sizes: {
    gives: [
      'The figures over the bars hide under 360px',
      'Under 420px the days shrink to their first two letters, never fewer',
      'The columns narrow; a bar is 28 to 56 wide, by the chart\u2019s width',
    ],
  },
  rules: {
    cite: ['colour-has-a-word', 'figures-follow-text', 'sentence-case'],
  },
  log: 'web/src/units/bar-chart/log.md',
  decisions: [
    {
      id: 'bar-chart-d1',
      decision:
        'Today is the accent bar and its day is in the full text colour at weight 500, the others muted. Days read Mon, or Mo when narrow: two letters at least.',
      why: 'Jack: "Make it so we can see at least two letters of the days of the week for bar labels, and I don\'t like the underline to show what day it is."',
      beat: 'Single letters; an underline or the word Today',
      date: '2026-10-21',
    },
  ],
});
