import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'bar-chart',
  kind: 'component',
  title: 'Bar chart',
  group: 'Home',
  purpose:
    'A week as vertical bars from one baseline, Monday to Sunday, today in the accent with its day in the full text colour.',
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
      when: 'No time yet: each past day is an empty track.',
    },
  ],
  stress:
    'Seven days in a 320px column with a day of 10 h: the bars and the two-letter days stay.',
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
      does: 'One per column: the day under it, its words in the tooltip, and whether it is today or still to come.',
    },
  ],
  priority: { first: 'Today’s bar, then the tallest.' },
  sizes: {
    gives: ['The columns narrow; a bar is 28 wide'],
  },
  rules: {
    cite: ['colour-has-a-word', 'figures-follow-text', 'sentence-case'],
  },
  log: 'web/src/units/bar-chart/log.md',
  decisions: [
    {
      id: 'bar-chart-d1',
      decision:
        'Today is the accent bar and its day is in the full text colour at weight 500, the others muted. Days read Mo, Tu: two letters at least.',
      why: 'Jack: "Make it so we can see at least two letters of the days of the week for bar labels, and I don\'t like the underline to show what day it is."',
      beat: 'Single letters; an underline or the word Today',
      date: '2026-10-21',
    },
    {
      id: 'bar-chart-d2',
      decision:
        'The bar chart has no failed state yet: it reads sample data, and how a failed read looks is not designed.',
      why: 'Not designed: noted when the spec format dropped the data waiting and failed fields (ideas/spec-format-grill.md, F9).',
      beat: 'A failed line in the data section',
      date: '2026-10-22',
    },
    {
      id: 'bar-chart-d3',
      decision:
        "Loading, the tracks and weekday labels are real, today's label in full ink, and the bars come with the data.",
      why: 'Step 6 of the loading skeleton plan (ideas/skeleton-plan.md): the chart loads as itself, so nothing beside it moves when the days come.',
      beat: 'BarChartSkeleton, seven stubs at made-up heights',
      date: '2026-11-14',
      supersededBy: 'bar-chart-d5',
    },
    {
      id: 'bar-chart-d4',
      decision:
        'When the days come, each bar grows up from the floor of its track to its height over 700ms; a later change slides the same way.',
      why: 'Jack: "can we make the bars (stat and progress) grow to their values as they load? And make the numbers tick up to their values like a stock ticker".',
      beat: 'The bars appearing at once',
      date: '2026-11-14',
      supersededBy: 'bar-chart-d5',
    },
    {
      id: 'bar-chart-d5',
      decision:
        'No loading form of its own: it draws whole once its screen has the data; a later change slides over 700ms. Arrival motion waits for D3.',
      why: 'Jack, 2026-11-16: "Hold the old screen" and "Only what has a caller" (ideas/skeleton-grill.md D1, D7): reads take 1 to 40 ms.',
      beat: 'Its own loading form (bar-chart-d3, bar-chart-d4)',
      date: '2026-11-16',
      supersededBy: 'bar-chart-d6',
    },
    {
      id: 'bar-chart-d6',
      decision:
        "On its screen's first open after PSet starts, each bar grows up from the floor over 700ms; after that bars draw at their height. A change slides.",
      why: 'Jack, 2026-11-16: "First open per session" (ideas/skeleton-grill.md D3); 2026-11-17: "fold the fade into step 6".',
      beat: 'Growing on every open; never growing',
      date: '2026-11-16',
    },
  ],
});
