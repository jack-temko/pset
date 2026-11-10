import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'bone',
  kind: 'component',
  title: 'Bone',
  group: 'Basics',
  purpose:
    'The one loading bar: a line of the text style it sits in, so it never sizes a box. Every skeleton is bones in the real layout.',
  states: [
    {
      id: 'in-text',
      name: 'In every type step',
      when: 'A bar in each text style, beside the same text: the line keeps its exact height.',
      text: 'Heading',
    },
    {
      id: 'rhythm',
      name: 'Rows in a rhythm',
      when: 'Five list rows: title and meta widths cycle through three, so rows differ but a row always draws the same.',
    },
    {
      id: 'pill',
      name: 'A pill',
      when: 'A tag or a counter while it loads: a full-height rounded bar.',
    },
    {
      id: 'block',
      name: 'A block',
      when: 'For what is not text (a chart, a page): fills the box its parent made.',
    },
    {
      id: 'still',
      name: 'Still',
      when: 'No pulse: a wait that is work in progress, where the shimmer says PSet is working.',
    },
    {
      id: 'fill',
      name: 'Fill, loaded',
      when: 'A value in the place a bar held: the same line, the same box.',
      text: 'Problem set 4',
    },
  ],
  stress:
    'A 60ch bar in a 120px slot: it stops at the slot’s edge, as text would truncate.',
  actions: [],
  inputs: [
    { name: 'ch', does: 'The width in ch, or three widths picked by row.' },
    { name: 'row', does: 'Which width of the rhythm this row draws.' },
    { name: 'pill', does: 'The shape of a tag or a counter.' },
    { name: 'still', does: 'No pulse, for work in progress.' },
  ],
  priority: {
    first: 'Where the text will be, at its line’s height.',
  },
  sizes: {
    gives: ['Its width never passes its slot'],
  },
  rules: {
    cite: ['honest-waits', 'keep-the-place'],
    local: [
      {
        id: 'bone-only',
        rule: 'Draw a loading bar only with Bone, Fill or BoneBlock; never a span with its own height or animate-pulse.',
        check:
          'Search the units for animate-pulse: only the bone unit draws a bar.',
        scope: 'bone',
      },
    ],
  },
  log: 'web/src/units/bone/log.md',
  decisions: [
    {
      id: 'bone-d1',
      decision:
        'A bar is one line of the text it sits in (1lh tall, drawn by ::before), so it has no height of its own and cannot change a box.',
      why: 'skeleton-grill: one layout, a bar has no size of its own. Measured: the line box stays exactly the text’s.',
      beat: 'Bars with pixel heights, in hand-measured slabs',
      date: '2026-11-09',
    },
    {
      id: 'bone-d2',
      decision:
        'Bars show after a 300ms grace and fade in over 150ms, then pulse slowly, all together; a value that replaces a bar the student saw fades in.',
      why: 'Jack: "Slow pulse, all together (Recommended)" (skeleton-grill S3); the grace from loading-standard D2.',
      beat: 'The shimmer sweep; bars at once',
      date: '2026-11-09',
    },
    {
      id: 'bone-d3',
      decision:
        'Widths are in ch, from three-width rhythms picked by row, so a title bar is the same on every screen and never random.',
      why: 'skeleton-plan: the same thing loads the same way everywhere.',
      beat: 'Random or percent widths per screen',
      date: '2026-11-09',
    },
  ],
});
