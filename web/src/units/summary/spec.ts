import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'summary',
  kind: 'component',
  title: 'Summary',
  group: 'Work',
  purpose:
    'The last stop of a set, plain with no box: how far it is, total time and finish, the bars, the longest, Turn in or Take back and Back to the course.',
  states: [
    {
      id: 'finished',
      name: 'Finished',
      when: 'Every problem done: "All 8 done", one muted line of total time and finish, the bars, the longest, Turn in.',
      text: 'All 8 done',
    },
    {
      id: 'unfinished',
      name: 'Not finished',
      when: 'Some problems left: "5 of 8 done", total time, the bars, the longest and Turn in.',
      text: '5 of 8 done',
    },
    {
      id: 'turned-in',
      name: 'Turned in',
      when: 'Handed in: "Turned in Oct 14", how many were done under it, and Take back where Turn in was.',
      text: 'Turned in Oct 14',
    },
    {
      id: 'no-time',
      name: 'No time yet',
      when: 'No time is known: the figures line, the bars and the longest are left out, not shown as 0.',
    },
  ],
  exampleWidth: 640,
  stress:
    '30 problems taking 99 h, a 70 character title for the longest and a set of 999 done: the bars thin out, the line wraps and nothing overflows.',
  actions: [
    {
      id: 'turn-in',
      label: 'Turn in',
      key: 'Enter',
      does: 'Hands the set in; the pane asks first when problems are left.',
    },
    {
      id: 'take-back',
      label: 'Take back',
      key: 'Enter',
      does: 'Takes a turned-in set back, so it can be worked on again.',
    },
    {
      id: 'back',
      label: 'Back to the course',
      key: 'Enter',
      does: 'Opens the course. The course screen is not a unit yet, so it has no target.',
    },
  ],
  inputs: [
    {
      name: 'problems',
      type: 'SummaryProblem[]',
      default: 'none',
      does: 'Each problem\u2019s label, title, state and minutes spent.',
    },
    {
      name: 'due, finished, turnedIn',
      type: 'Date',
      default: 'none',
      does: 'The due date (only to say how early or late it was finished), when the last problem was done, and when it was turned in.',
    },
  ],
  priority: {
    first: 'How many are done, then how long it took.',
    main: 'turn-in',
  },
  sizes: {
    narrowest: 320,
    gives: [
      'The box is as wide as the pane\u2019s column',
      'Long values wrap in their row',
    ],
  },
  components: [
    { unit: 'button', use: 'Turn in and Take back.' },
    { unit: 'link', use: 'Back to the course.' },
    { unit: 'problem-strip', use: 'The segment colours, for the bars.' },
    { unit: 'set-line', use: 'Time and day wording.' },
    { unit: 'tooltip', use: 'Names a bar by its problem and time.' },
  ],
  rules: {
    cite: [
      'work-first',
      'one-primary',
      'colour-has-a-word',
      'say-it-once',
      'links-go-buttons-do',
      'sentence-case',
    ],
  },
  log: 'web/src/units/summary/log.md',
  decisions: [
    {
      id: 'summary-d1',
      decision:
        'The finish card becomes a summary for unfinished, finished and turned-in sets alike.',
      why: 'Jack: "Also the finished page doesnt look the best. Can we include some light stats?"',
      beat: 'The finish card',
      date: '2026-10-21',
    },
    {
      id: 'summary-d2',
      decision:
        'Total time; finished against the due date (or when due); time per problem as bars in segment colours, the longest named. Nothing about help.',
      why: 'Jack: "all the most useful information shown in a nice way. not cluttered. no help stats"',
      beat: 'Help used; a table of every problem',
      date: '2026-10-21',
    },
    {
      id: 'summary-d3',
      decision:
        'Turn in is here, with Take back once turned in; Back to the course sits beside it.',
      why: 'Jack: "On the summary, plus the set menu".',
      beat: 'Turn in only in the menu',
      date: '2026-10-21',
    },
    {
      id: 'summary-d4',
      decision:
        'The longest problem\u2019s bar stays full colour and the others are dimmed a little, so the line naming it points at something.',
      why: 'Coordinator, 2026-10-21, so the "Longest:" line has a bar to point at.',
      beat: 'All bars alike',
      date: '2026-10-21',
    },
    {
      id: 'summary-d5',
      decision:
        'A box like a list: heading and Turn in or Take back in the header, icon rows, the bars last; Back to the course is a link under it.',
      why: 'Jack: "Can we show these a bit more github-y".',
      beat: 'Centred figures and buttons with no box',
      date: '2026-10-21',
      supersededBy: 'summary-d8',
    },
    {
      id: 'summary-d6',
      decision:
        'The summary shows no due date: the set line has it. Each fact is shown once on a screen.',
      why: 'Jack: "Shown in two spots. This should be a rule, avoid duplication where possible"',
      beat: 'Due on the summary and in the set line',
      date: '2026-10-21',
    },
    {
      id: 'summary-d7',
      decision:
        'Four looks to compare, all with the same content: A the box, B like Home\u2019s stats box, C plain, D tiles.',
      why: 'Jack: "almost too github-y now. lest A/B some options".',
      beat: 'One look',
      date: '2026-10-21',
      supersededBy: 'summary-d8',
    },
    {
      id: 'summary-d8',
      decision:
        'The summary is plain, with no box: heading, one muted line of figures, the bars, the longest and the actions, centred. The box, Home and tiles looks are gone.',
      why: 'Jack: "lets go with C."',
      beat: 'The GitHub box; Home\u2019s stats box; tiles',
      date: '2026-10-21',
    },
  ],
});
