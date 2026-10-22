import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'summary',
  kind: 'component',
  title: 'Summary',
  group: 'Work',
  purpose:
    'The last stop of a set: how far it is and how it went in a few figures, then Turn in or Take back and Back to the course. It stands alone, centred.',
  states: [
    {
      id: 'unfinished',
      name: 'Not finished',
      when: 'Some problems left: "5 of 8 done", total time, when it is due, time per problem, Turn in.',
      text: '5 of 8 done',
    },
    {
      id: 'finished',
      name: 'Finished',
      when: 'Every problem done: "All 8 done", total time, "Finished Tue · 2 days early", time per problem, Turn in.',
      text: 'All 8 done',
    },
    {
      id: 'turned-in',
      name: 'Turned in',
      when: 'Handed in: "Turned in Oct 14", a line under it with how many were done, and Take back where Turn in was.',
      text: 'Turned in Oct 14',
    },
    {
      id: 'no-time',
      name: 'No time yet',
      when: 'No time is known: the time figure and the bars are left out, not shown as 0.',
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
      does: 'The due date, when the last problem was done, and when it was turned in.',
    },
    {
      name: 'today',
      type: 'Date',
      default: 'now',
      does: 'The moment "Due Thu" counts from; for the design page and tests.',
    },
  ],
  priority: {
    first: 'How many are done, then how long it took.',
    main: 'turn-in',
  },
  sizes: {
    narrowest: 320,
    gives: ['The content is at most 520 wide, centred', 'The buttons wrap'],
  },
  components: [
    { unit: 'button', use: 'Turn in and Take back.' },
    { unit: 'link', use: 'Back to the course.' },
    { unit: 'problem-strip', use: 'The segment colours, for the bars.' },
    { unit: 'set-line', use: 'Time and due-date wording.' },
    { unit: 'tooltip', use: 'Names a bar by its problem and time.' },
  ],
  rules: {
    cite: [
      'work-first',
      'one-primary',
      'colour-has-a-word',
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
  ],
});
