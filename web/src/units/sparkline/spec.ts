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
      type: 'number[]',
      default: 'none',
      does: 'One value per day, oldest first; scaled so the highest reaches the top.',
    },
    {
      name: 'height',
      type: 'number',
      default: '44',
      does: 'How tall it is, in px: 44 on a tile, 28 beside a figure.',
    },
  ],
  priority: { first: 'The shape of the fortnight.' },
  sizes: {
    narrowest: 48,
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
  ],
});
