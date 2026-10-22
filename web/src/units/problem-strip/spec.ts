import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'problem-strip',
  kind: 'component',
  title: 'Problem strip',
  group: 'Work',
  purpose:
    'The whole set as one rounded 8px bar, a segment per problem: done in the accent, failed in danger, the current one outlined in the accent. One click jumps; hover names it.',
  states: [
    {
      id: 'in-progress',
      name: 'In progress',
      when: 'Some segments in the accent (done), the rest in the track colour; the current one keeps its colour and has an accent outline.',
    },
    {
      id: 'failed',
      name: 'A problem not found',
      when: 'A problem that could not be found is in the danger colour; hover says "not found".',
    },
    {
      id: 'finding',
      name: 'A problem being found',
      when: 'A problem still being found pulses in the track colour; hover says "being found".',
    },
    {
      id: 'all-done',
      name: 'All done',
      when: 'Every segment in the accent and none outlined, as on the finish card.',
    },
  ],
  exampleWidth: 560,
  stress:
    '30 problems with 60 character titles: the segments get narrow, the bar never wraps and the hover names each in full.',
  actions: [
    {
      id: 'jump',
      label: 'A segment',
      key: 'Enter',
      does: 'Goes to that problem in one click.',
    },
  ],
  inputs: [
    {
      name: 'chips',
      type: 'Chip[]',
      default: 'none',
      does: 'Each problem’s id, label, short title and state: todo, done, failed or finding.',
    },
    {
      name: 'current',
      type: 'string',
      default: 'none',
      does: 'The id of the problem the student is on, outlined in the accent.',
    },
    {
      name: 'onJump',
      type: '(id) => void',
      default: 'none',
      does: 'Which segment was pressed.',
    },
  ],
  priority: {
    first: 'How far through the set, then which one is current.',
    main: 'jump',
  },
  sizes: {
    narrowest: 320,
    gives: ['The segments get narrower and the bar never wraps'],
  },
  components: [
    {
      unit: 'tooltip',
      use: 'Names a segment by its number, title and state on hover.',
    },
  ],
  rules: {
    cite: [
      'work-first',
      'colour-has-a-word',
      'contrast-floors',
      'honest-waits',
    ],
  },
  log: 'web/src/units/problem-strip/log.md',
  decisions: [
    {
      id: 'problem-strip-d1',
      decision:
        'One problem at a time, with a strip of numbered chips above it: done filled, current outlined, jump anywhere in one click.',
      why: 'Jack picked "One at a time + strip (Recommended)" (P1).',
      beat: 'One scrolling list; today’s counter menu',
      date: '2026-10-21',
      supersededBy: 'problem-strip-d3',
    },
    {
      id: 'problem-strip-d2',
      decision:
        'A chip that could not be found is in the danger colour, one still being found is dashed, and hover adds the word.',
      why: 'Assumed in the work pane grill: colour is never the only signal.',
      beat: 'Colour alone',
      date: '2026-10-21',
      supersededBy: 'problem-strip-d4',
    },
    {
      id: 'problem-strip-d3',
      decision:
        'The strip is segments, one per problem, in place of the boxes. Options B to E are gone.',
      why: 'Jack, 2026-10-21, after trying five: "Lets go with the segments". He had said: "Not a fan of the boxes with the numbers for questions."',
      beat: 'Boxes of numbers; plain numbers; picker; titled list; titled numbers',
      date: '2026-10-21',
    },
    {
      id: 'problem-strip-d4',
      decision:
        'No line under the segments: the problem\u2019s heading carries its number and title.',
      why: 'Jack: "We don\'t need the title twice".',
      beat: '"Problem 4 of 8 · RC step response" under the bar',
      date: '2026-10-21',
    },
    {
      id: 'problem-strip-d5',
      decision:
        'The current segment keeps its state colour and has an accent outline, 2px, offset 2px so it shows on a done segment. No caret, no lighter tint.',
      why: 'Jack: "Not a fan of the white out line for the active problem." Then: "I just wanted either a different outline color, or it to change color."',
      beat: 'A white outline; a caret; a lighter tint',
      date: '2026-10-21',
    },
    {
      id: 'problem-strip-d6',
      decision:
        'Like Primer\u2019s ProgressBar: a rounded 8px track, segments 2px apart, hover brightens and names it; with many problems the segments narrow and never wrap.',
      why: 'Jack: "Can we make this more github-y? Not a fan of the current option", and, on the rest of the segments, "Keep the GitHub restyle tho".',
      beat: 'Separate square segments 4px apart',
      date: '2026-10-21',
    },
  ],
});
