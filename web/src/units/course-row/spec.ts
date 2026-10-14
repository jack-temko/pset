import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'course-row',
  kind: 'component',
  title: 'Course row',
  group: 'Lists',
  purpose:
    'One course on one line: its name, how many materials and how many sets it holds. The row opens the course.',
  states: [
    {
      id: 'typical',
      name: 'Typical',
      when: 'A course with several materials and sets.',
    },
    {
      id: 'singular',
      name: 'One material, one set',
      when: 'Each count is one: the words go singular.',
    },
    {
      id: 'empty',
      name: 'Empty course',
      when: 'A course with nothing in it yet.',
      text: 'No materials, No sets',
    },
    {
      id: 'list',
      name: 'A list of three',
      when: 'Home lists every course: the counts line up down the list.',
    },
  ],
  stress:
    'A 70 character course name in a 320px container: it truncates on one line.',
  components: [
    {
      unit: 'section-heading',
      use: 'Titles the list of three in the examples.',
    },
  ],
  actions: [
    {
      id: 'open-course',
      label: 'The row',
      key: 'Enter',
      does: 'Opens the course, and only the course. The course screen is not a unit yet, so it has no target.',
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
      does: 'Where the row goes.',
    },
  ],
  priority: {
    first: 'The course’s name.',
    main: 'open-course',
  },
  sizes: {
    narrowest: 320,
    gives: ['The counts take less room below 520', 'The name truncates'],
  },
  rules: {
    cite: [
      'course-first',
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
        'A row shows the course’s name, its materials count and its sets count, and the whole row opens the course and only the course.',
      why: 'Jack: "the row opens the course, and just the course".',
      beat: 'The row opens the current set; unfinished sets and next due',
      date: '2026-10-13',
    },
  ],
});
