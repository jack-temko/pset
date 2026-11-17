import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'bone',
  kind: 'component',
  title: 'Bone',
  group: 'Basics',
  purpose:
    'The one loading bar: a line of the text style it sits in, so it never sizes a box. Only a part slow by nature draws one (loading D1, D7).',
  states: [
    {
      id: 'in-text',
      name: 'In every type step',
      when: 'A bar in each text style, beside the same text: the line keeps its exact height.',
      text: 'Heading',
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
  ],
  stress:
    'A 60ch bar in a 120px slot: it stops at the slot’s edge, as text would truncate.',
  actions: [],
  inputs: [
    { name: 'ch', does: 'The width in ch.' },
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
        rule: 'Draw a loading bar only with Bone or BoneBlock; never a span with its own height or animate-pulse.',
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
      supersededBy: 'bone-d6',
    },
    {
      id: 'bone-d3',
      decision:
        'Widths are in ch, from three-width rhythms picked by row, so a title bar is the same on every screen and never random.',
      why: 'skeleton-plan: the same thing loads the same way everywhere.',
      beat: 'Random or percent widths per screen',
      date: '2026-11-09',
      supersededBy: 'bone-d6',
    },
    {
      id: 'bone-d4',
      decision:
        'Text that may wrap loads as one bar line in its own element (FillBlock); when it comes, the block grows smoothly to its height over 200ms and the text fades in.',
      why: 'Step 6, S8 reversed: Jack, "lets go with 2, but it smoothly grows if needed. and smoothly replaces the text. Make it effortless".',
      beat: "Remembering each text's line count (S8); one line, then a jump",
      date: '2026-11-14',
      supersededBy: 'bone-d6',
    },
    {
      id: 'bone-d5',
      decision:
        'Ticker, for figures: digits roll up from 0 when a number first shows and from the old digit when it changes, in 700ms; one-digit numbers and counts never roll.',
      why: 'Jack: "can we make the bars (stat and progress) grow to their values as they load? And make the numbers tick up to their values like a stock ticker".',
      beat: 'A count-up through every value; rolling counts and single digits too (Jack: "Individual digits don’t need to roll")',
      date: '2026-11-14',
      supersededBy: 'bone-d7',
    },
    {
      id: 'bone-d6',
      decision:
        'Bone and BoneBlock only, for a part slow by nature. Fill, FillBlock and the row rhythms go with the loading forms that used them.',
      why: 'Jack, 2026-11-16: "Only what has a caller" (ideas/skeleton-grill.md D7). Bars show after the grace and pulse, as bone-d2 said.',
      beat: 'Keeping Fill, FillBlock and the rhythms for later',
      date: '2026-11-16',
    },
    {
      id: 'bone-d7',
      decision:
        'Ticker moves out to web/src/design/ticker.tsx with the arrival code; the bone unit is Bone and BoneBlock. Bars pulse down to 0.7, not 0.5 (D4).',
      why: 'Jack, 2026-11-16: "Take my numbers" (D4); A5: Ticker is not a bar.',
      beat: 'Ticker in the bone unit; a pulse down to 0.5',
      date: '2026-11-16',
    },
  ],
});
