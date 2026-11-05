import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'meter',
  kind: 'component',
  title: 'Meter',
  group: 'Basics',
  purpose:
    'A thin bar showing one share of a whole, such as a course’s part of the month’s cost. Drawn only: the figure is written beside it.',
  states: [
    { id: 'half', name: 'Half', when: 'A share of half.' },
    {
      id: 'empty',
      name: 'Nothing',
      when: 'A share of nothing: only the track shows.',
    },
    { id: 'full', name: 'The whole', when: 'The share is the whole.' },
  ],
  stress:
    'A value above the whole and a whole of zero: the bar stops at full and shows empty.',
  actions: [],
  inputs: [
    { name: 'value', does: 'The share.' },
    { name: 'max', does: 'The whole, in the same unit.' },
  ],
  priority: { first: 'The fill.' },
  sizes: { gives: ['It fills the width it is given'] },
  rules: { cite: ['figures-follow-text'] },
  decisions: [
    {
      id: 'meter-d1',
      decision:
        'A meter is the progress bar without its count: 4 high, the accent fill on the border track.',
      why: 'Confirmed by Jack: "Month, per course, all time (Recommended)" (G5): usage per course needs a thin bar, and the progress bar shows "x of y".',
      beat: 'Reusing the progress bar with a hidden count',
      date: '2026-10-22',
    },
  ],
});
