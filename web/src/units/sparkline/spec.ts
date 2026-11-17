import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'sparkline',
  kind: 'component',
  title: 'Sparkline',
  group: 'Home',
  purpose:
    'The last days of a figure as a small line with a soft area under it, the latest day marked with a dot. It has no axis and no numbers.',
  states: [
    {
      id: 'busy',
      name: 'A busy fortnight',
      when: 'Fourteen days with ups and downs.',
    },
    {
      id: 'flat',
      name: 'Nothing yet',
      when: 'Every day zero: a line along the bottom.',
    },
    {
      id: 'one-day',
      name: 'One day',
      when: 'A single value: the dot, with no line to draw.',
    },
  ],
  stress:
    'Sixty values in 96px: the line stays inside its box and the dot stays on the last value.',
  actions: [],
  inputs: [
    {
      name: 'values',
      does: 'One value per day, oldest first; scaled so the highest reaches the top.',
    },
    {
      name: 'height',
      does: 'How tall it is, in px: 44 on a tile, 28 beside a figure.',
    },
  ],
  priority: { first: 'The shape of the fortnight.' },
  sizes: {
    gives: ['It narrows with its container; the height stays as given'],
  },
  rules: { cite: ['colour-has-a-word'] },
  log: 'web/src/units/sparkline/log.md',
  decisions: [
    {
      id: 'sparkline-d1',
      decision:
        'A 2px line, a soft area and a dot on the latest day, scaled to its own highest value.',
      why: 'Jack, 2026-10-21: "include sparklines in that one too". Each line scales to its own range: the shape here, the size in the figure beside it.',
      beat: 'Bars; a shared scale across tiles',
      date: '2026-10-21',
    },
    {
      id: 'sparkline-d2',
      decision:
        'A flat, quiet line along the bottom, no dot, at the same height, while the days load.',
      why: 'Step 4 of the loading skeleton plan (ideas/skeleton-plan.md): each leaf designs its loading form once, so it loads the same everywhere.',
      beat: 'Each screen drawing its own bar for it',
      date: '2026-11-12',
      supersededBy: 'sparkline-d4',
    },
    {
      id: 'sparkline-d3',
      decision:
        'When the days come, the line rises from the flat loading line into its shape over 700ms, the area with it, and the dot rides up to the last day.',
      why: 'Jack: "Can we apply the same loading animation as the ticker + bars to the spark line?"',
      beat: 'The line appearing at once',
      date: '2026-11-14',
    },
    {
      id: 'sparkline-d4',
      decision:
        'No loading form of its own: its screen holds the previous one until the data is in, then this draws whole (loading D1, D7).',
      why: 'Jack, 2026-11-16: "Hold the old screen" and "Only what has a caller" (ideas/skeleton-grill.md D1, D7): reads take 1 to 40 ms.',
      beat: 'Its own loading form (sparkline-d2)',
      date: '2026-11-16',
    },
  ],
});
