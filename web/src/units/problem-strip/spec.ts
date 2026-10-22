import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'problem-strip',
  kind: 'component',
  title: 'Problem strip',
  group: 'Work',
  purpose:
    'The whole set as one rounded 8px bar, a segment per problem, coloured by its state. One click jumps; hover names the problem and its state.',
  states: [
    {
      id: 'in-progress',
      name: 'In progress',
      when: 'One problem in each state; the current one has a 2px line under its segment, in its colour, 3px below the track.',
    },
    {
      id: 'each-state',
      name: 'Underline in each state',
      when: 'Six bars, the current segment moving through done, started, not started, working, queued and failed, each line in its segment\u2019s colour.',
    },
    {
      id: 'all-done',
      name: 'All done',
      when: 'Every segment green and none underlined, as on the finish card.',
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
    {
      id: 'summary',
      label: 'The flag at the end',
      key: 'Enter',
      does: 'Opens the summary. The summary is not in this unit, so it has no target.',
    },
  ],
  inputs: [
    {
      name: 'chips',
      type: 'Chip[]',
      default: 'none',
      does: 'Each problem’s id, label, title, state (done, started, todo, working, queued or failed) and the state in words.',
    },
    {
      name: 'summary, allDone, onSummary',
      type: 'boolean, boolean, () => void',
      default: 'false',
      does: 'A flag button ends the bar and opens the summary; while it shows, the flag is underlined, green when all are done.',
    },
    {
      name: 'current',
      type: 'string',
      default: 'none',
      does: 'The id of the problem the student is on, marked.',
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
      supersededBy: 'problem-strip-d9',
    },
    {
      id: 'problem-strip-d6',
      decision:
        'Like Primer\u2019s ProgressBar: a rounded 8px track, segments 2px apart, hover brightens and names it; with many problems the segments narrow and never wrap.',
      why: 'Jack: "Can we make this more github-y? Not a fan of the current option", and, on the rest of the segments, "Keep the GitHub restyle tho".',
      beat: 'Separate square segments 4px apart',
      date: '2026-10-21',
    },
    {
      id: 'problem-strip-d7',
      decision:
        'The current segment is marked three ways to compare, none touching a neighbour: a line under it, 4px taller, an inset outline.',
      why: 'Jack: "Try some other options to show the active question including underlining the segment. The outline overlaps the next bar slighlty."',
      beat: 'An outer outline offset 2px',
      date: '2026-10-21',
      supersededBy: 'problem-strip-d9',
    },
    {
      id: 'problem-strip-d8',
      decision:
        'Colour is state: done green, started accent, not started the track, working yellow and pulsing, queued yellow 40%, failed red. The tooltip says it.',
      why: 'Jack: "Also have the colors of the bar represent the state of the question, error in progress, queue, searching etc. Just pick a small representative set"',
      beat: 'Accent for done, danger for failed, nothing else',
      date: '2026-10-21',
    },
    {
      id: 'problem-strip-d9',
      decision:
        'The current segment has a 2px line under it, its segment\u2019s colour (muted text when not started), 3px below the track. Taller and inset are gone.',
      why: 'Jack: "go with the underline, drop the others", then "Can we make the line the same color as the segment".',
      beat: 'A white outline, an offset outline, a taller segment, an inset outline',
      date: '2026-10-21',
    },
    {
      id: 'problem-strip-d10',
      decision:
        'A queued segment stays faint but its underline is the full yellow. A flag button ends the bar and opens the summary, underlined while it shows.',
      why: 'Jack: "yes, make the queued line full yellow." The flag is the "last stop after the segments".',
      beat: 'A faint underline on a faint segment',
      date: '2026-10-21',
    },
    {
      id: 'problem-strip-d11',
      decision:
        'The flag has a segment\u2019s slot: a 12px icon centred on the track and its underline at the segments\u2019 y, 3px below the track, clear of the icon.',
      why: 'Jack: "The underline overlaps the icon and looks weird."',
      beat: 'A 14px icon with its line at the slot\u2019s edge',
      date: '2026-10-21',
    },
  ],
});
