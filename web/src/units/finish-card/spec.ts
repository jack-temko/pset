import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'finish-card',
  kind: 'component',
  title: 'Finish card',
  group: 'Work',
  purpose:
    'A short moment of closure after the last problem is marked done: how many and how long, then Turn in and Back to the course.',
  states: [
    {
      id: 'done',
      name: 'All done',
      when: 'Every problem is done and the set is not turned in.',
      text: 'All 8 done · 2 h 10 m',
    },
    {
      id: 'no-time',
      name: 'Time not known',
      when: 'PSet has no time for the set: the time is left out, not shown as 0.',
      text: 'All 8 done',
    },
    {
      id: 'turned-in',
      name: 'Turned in',
      when: 'The set is handed in: a "Turned in" tag, and Take back where Turn in was.',
    },
  ],
  exampleWidth: 560,
  stress:
    'A set of 999 problems taking 99 h 59 m: the line wraps and nothing overflows.',
  actions: [
    {
      id: 'turn-in',
      label: 'Turn in',
      key: 'Enter',
      does: 'Hands the set in.',
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
      name: 'count',
      type: 'number',
      default: 'none',
      does: 'Problems in the set.',
    },
    {
      name: 'minutes',
      type: 'number',
      default: 'none',
      does: 'Time spent on the set; said only when known.',
    },
    {
      name: 'turnedIn',
      type: 'boolean',
      default: 'false',
      does: 'Swaps Turn in for Take back.',
    },
  ],
  priority: {
    first: 'How many are done and how long it took.',
    main: 'turn-in',
  },
  sizes: {
    narrowest: 320,
    gives: ['The buttons wrap under the line'],
  },
  components: [
    { unit: 'button', use: 'Turn in and Take back.' },
    { unit: 'link', use: 'Back to the course.' },
    { unit: 'set-line', use: 'minutesText, for the time spent.' },
    { unit: 'tag', use: 'The "Turned in" tag.' },
  ],
  rules: {
    cite: ['work-first', 'one-primary', 'links-go-buttons-do', 'sentence-case'],
  },
  log: 'web/src/units/finish-card/log.md',
  decisions: [
    {
      id: 'finish-card-d1',
      decision:
        'Marking the last problem done shows a short finish card: "All 8 done · 2 h 10 m", Turn in, Back to the course.',
      why: 'Jack picked "A short finish card (Recommended)": a moment of closure, one place to hand in (P12).',
      beat: 'Nothing special',
      date: '2026-10-21',
    },
    {
      id: 'finish-card-d2',
      decision: 'Once the set is turned in, Take back sits where Turn in was.',
      why: 'Jack picked "Warn, and Take back (Recommended)" (P9).',
      beat: 'Only when all done; no Turn in',
      date: '2026-10-21',
    },
  ],
});
