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
    {
      id: 'meter-d2',
      decision: 'The empty track alone while the share loads.',
      why: 'Step 4 of the loading skeleton plan (ideas/skeleton-plan.md): each leaf designs its loading form once, so it loads the same everywhere.',
      beat: 'Each screen drawing its own bar for it',
      date: '2026-11-12',
      supersededBy: 'meter-d4',
    },
    {
      id: 'meter-d3',
      decision:
        'When the share comes, the fill grows from the empty track to its value over 700ms; a later change slides the same way.',
      why: 'Jack: "can we make the bars (stat and progress) grow to their values as they load? And make the numbers tick up to their values like a stock ticker".',
      beat: 'The fill appearing at once',
      date: '2026-11-14',
      supersededBy: 'meter-d4',
    },
    {
      id: 'meter-d4',
      decision:
        'No loading form of its own: it draws whole once its screen has the data; a later change slides over 700ms. Arrival motion waits for D3.',
      why: 'Jack, 2026-11-16: "Hold the old screen" and "Only what has a caller" (ideas/skeleton-grill.md D1, D7): reads take 1 to 40 ms.',
      beat: 'Its own loading form (meter-d2, meter-d3)',
      date: '2026-11-16',
      supersededBy: 'meter-d5',
    },
    {
      id: 'meter-d5',
      decision:
        "On its screen's first open after PSet starts, the fill grows from empty to its value over 700ms; after that it draws at its value. A change slides.",
      why: 'Jack, 2026-11-16: "First open per session" (ideas/skeleton-grill.md D3); 2026-11-17: "fold the fade into step 6".',
      beat: 'Growing on every open; never growing',
      date: '2026-11-16',
    },
  ],
});
