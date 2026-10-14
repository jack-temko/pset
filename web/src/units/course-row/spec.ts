import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'course-row',
  kind: 'component',
  title: 'Course row',
  group: 'Lists',
  purpose:
    'One course: its name, what it holds, and its active sets, usually one. The name opens the course; each set line opens its set.',
  states: [
    {
      id: 'due-soon',
      name: 'One active set, due soon',
      when: 'The course has one active set, due within 2 days: the attention tag.',
    },
    {
      id: 'no-date',
      name: 'One active set, no date',
      when: 'The course has one active set with no date.',
    },
    {
      id: 'two-active',
      name: 'Two active sets',
      when: 'Two sets are active: their lines stack.',
    },
    {
      id: 'nothing-active',
      name: 'Nothing active',
      when: 'The course has sets, none of them active.',
      text: 'Nothing active',
    },
    {
      id: 'empty',
      name: 'Empty course',
      when: 'A course with nothing in it yet.',
      text: 'No materials, no sets, Nothing active',
    },
    {
      id: 'list',
      name: 'A list of five',
      when: 'Home lists at most five courses, then "Show all": the lines align down the list.',
    },
  ],
  stress:
    'A 70 character course name and a 70 character set name in a 480px container: both truncate on one line.',
  components: [
    { unit: 'set-line', use: 'Each active set, opening the set.' },
    { unit: 'link', use: 'The course name, opening the course.' },
    {
      unit: 'section-heading',
      use: 'Titles the list of five in the examples.',
    },
  ],
  actions: [
    {
      id: 'open-course',
      label: 'The course name',
      key: 'Enter',
      does: 'Opens the course. The course screen is not a unit yet, so it has no target.',
    },
    {
      id: 'open-set',
      label: 'A set line',
      key: 'Enter',
      does: 'Opens that set in the workspace. The workspace is not a unit yet, so it has no target.',
    },
  ],
  inputs: [
    {
      name: 'name',
      type: 'string',
      default: 'none',
      does: 'The course’s name.',
    },
    {
      name: 'materials',
      type: 'number',
      default: 'none',
      does: 'How many materials it holds.',
    },
    {
      name: 'sets',
      type: 'number',
      default: 'none',
      does: 'How many problem sets it holds.',
    },
    {
      name: 'href',
      type: 'string',
      default: 'none',
      does: 'Where the course name goes.',
    },
    {
      name: 'active',
      type: 'SetLine props[]',
      default: 'none',
      does: 'The active sets, as set lines; none shows "Nothing active".',
    },
    {
      name: 'today',
      type: 'Date',
      default: 'now',
      does: 'The day "within 2 days" counts from; for the design page and tests.',
    },
  ],
  priority: {
    first: 'The course’s name, then its active set.',
    main: 'open-set',
  },
  sizes: {
    narrowest: 480,
    gives: [
      'Below 920 the set lines stack under the name',
      'The set lines drop their time left, then their progress count',
      'The names truncate',
    ],
  },
  rules: {
    cite: [
      'course-first',
      'work-first',
      'links-go-buttons-do',
      'contrast-floors',
      'figures-follow-text',
      'sentence-case',
    ],
  },
  log: 'web/src/units/course-row/log.md',
  decisions: [
    {
      id: 'course-row-d1',
      decision:
        'A course row shows the course’s name (opens the course), its materials and sets counts, and its active sets, each opening its set.',
      why: 'Usually one active set per course, so one list names each course once.',
      beat: 'A list of sets in progress plus a separate list of courses',
      date: '2026-10-13',
    },
    {
      id: 'course-row-d2',
      decision:
        'Home sorts courses by their nearest active due date, then courses with no dated active set, then courses with nothing active; at most five, then "Show all".',
      why: 'Home stays short and the most urgent course comes first.',
      beat: 'All of them; three',
      date: '2026-10-13',
    },
  ],
});
