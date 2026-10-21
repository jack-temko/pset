import { defineSpec } from '@/design/spec';

const SKELETON =
  'A bar for the greeting line and a shorter one for the muted line.';

export default defineSpec({
  id: 'greeting',
  kind: 'component',
  title: 'Greeting',
  group: 'Home',
  purpose:
    'Home’s big line for the hour, picked from a few, and one muted line under it saying what is due next.',
  states: [
    {
      id: 'band-12am',
      name: '12am to 2am',
      when: 'Up late: the first of that stretch’s lines.',
      skeleton: SKELETON,
    },
    {
      id: 'band-3am',
      name: '3am to 5am',
      when: 'Early: a line of the 3am stretch.',
      skeleton: SKELETON,
    },
    {
      id: 'band-6am',
      name: '6am to 10am',
      when: 'Morning: a line of the 6am stretch.',
      skeleton: SKELETON,
    },
    {
      id: 'band-11am',
      name: '11am to 1pm',
      when: 'Midday: a line of the 11am stretch.',
      skeleton: SKELETON,
    },
    {
      id: 'band-2pm',
      name: '2pm to 4pm',
      when: 'Afternoon: a line of the 2pm stretch.',
      skeleton: SKELETON,
    },
    {
      id: 'band-5pm',
      name: '5pm to 8pm',
      when: 'Evening: a line of the 5pm stretch.',
      skeleton: SKELETON,
    },
    {
      id: 'band-9pm',
      name: '9pm to 11pm',
      when: 'Late: a line of the 9pm stretch.',
      skeleton: SKELETON,
    },
    {
      id: 'no-name',
      name: 'No name',
      when: 'The student has not given a name: the line drops the comma and the name.',
      skeleton: SKELETON,
    },
    {
      id: 'nothing-due',
      name: 'Nothing due',
      when: 'No unfinished set is due within 7 days, or none has a date.',
      text: 'Nothing due this week.',
      skeleton: SKELETON,
    },
    {
      id: 'overdue',
      name: 'Overdue first',
      when: 'An unfinished set is past due: it comes before any that is due later, and the line says "was due".',
      skeleton: SKELETON,
    },
  ],
  stress:
    'A 40 character name and a 70 character set title at 320px: both lines wrap and nothing overflows.',
  data: [
    {
      reads: 'The student’s name and sets with their due dates',
      call: 'None yet: sample data',
      waiting: 'A bar for each line.',
      failed: 'Not designed: Home has no failed state yet.',
    },
  ],
  actions: [],
  inputs: [
    {
      name: 'name',
      type: 'string',
      default: 'none',
      does: 'The student’s name; empty drops it from the line.',
    },
    {
      name: 'hour',
      type: 'number',
      default: 'none',
      does: 'The hour, 0 to 23; it chooses the stretch of lines.',
    },
    {
      name: 'pick',
      type: 'number',
      default: 'none',
      does: 'In [0, 1): which line of the stretch. A page holds one for its visit.',
    },
    {
      name: 'sets',
      type: '{ set: string; due?: Date; done: number; total: number }[]',
      default: 'none',
      does: 'The sets the muted line chooses from; a finished set or one without a date is skipped.',
    },
    {
      name: 'today',
      type: 'Date',
      default: 'none',
      does: 'The day "due Thu" and "this week" count from.',
    },
  ],
  priority: { first: 'The greeting line, then what is due.' },
  sizes: {
    narrowest: 280,
    gives: ['The lines wrap at any letter', 'Nothing truncates'],
  },
  components: [
    {
      unit: 'set-line',
      use: 'The wording of a due date, and the days until it.',
    },
  ],
  rules: {
    cite: [
      'serif-to-read',
      'room-for-big-type',
      'sentence-case',
      'dates-only-given',
    ],
  },
  log: 'web/src/units/greeting/log.md',
  decisions: [
    {
      id: 'greeting-d1',
      decision:
        'The big line is one of the generated lines for the hour (web/src/lib/greeting.ts), chosen by a pick the page holds for its visit.',
      why: 'Jack: "Name + one line, we will reuse the greetings that we generated for randomization." (home-info-grill D4)',
      beat: 'Name only; a new rotating line',
      date: '2026-10-16',
    },
    {
      id: 'greeting-d2',
      decision:
        'The muted line names the nearest due date among unfinished sets: "Problem set 4 is due Thu.", past due first ("was due Mon.").',
      why: 'Jack picked "What’s due next" (D5); past due first is Assumed.',
      beat: 'Count due this week; time this week',
      date: '2026-10-16',
    },
    {
      id: 'greeting-d3',
      decision:
        'With nothing due within 7 days the line says "Nothing due this week."',
      why: 'Jack picked it (D11).',
      beat: 'Next due however far; no line',
      date: '2026-10-16',
    },
    {
      id: 'greeting-d4',
      decision:
        'With no name the line drops the comma and the name, as greeting.ts does.',
      why: 'Assumed in home-info-grill.',
      beat: 'A generic name',
      date: '2026-10-16',
    },
  ],
});
