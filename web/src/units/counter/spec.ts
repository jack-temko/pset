import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'counter',
  kind: 'component',
  title: 'Counter',
  group: 'Basics',
  purpose:
    'A small pill holding a number, set beside a title: how many things follow. Never clickable.',
  states: [
    { id: 'one-digit', name: 'One digit', when: 'A few things, such as 8.' },
    {
      id: 'three-digits',
      name: 'Three digits',
      when: 'Many things, such as 128: the pill grows with the number.',
    },
  ],
  stress:
    'The number "1,234" in a 32px container: it never truncates, and overflows the container rather than lie.',
  actions: [],
  inputs: [
    {
      name: 'children',
      type: 'ReactNode',
      default: 'none',
      does: 'The number, written as it should read.',
    },
  ],
  priority: { first: 'The number.' },
  sizes: {
    narrowest: 20,
    gives: ['Nothing: it may overflow its container, never truncate'],
  },
  rules: { cite: ['figures-follow-text', 'contrast-floors'] },
  log: 'web/src/units/counter/log.md',
  decisions: [
    {
      id: 'counter-d1',
      decision:
        "GitHub's Counter, as the old design had it: a pill 20 high, full radius, the small step with tabular numbers, on `pressed` in `fg`.",
      why: 'Jack: the heading "is bad too. I want to be more similar to my old design."',
      beat: 'A count in small grey text',
      date: '2026-10-14',
    },
  ],
});
