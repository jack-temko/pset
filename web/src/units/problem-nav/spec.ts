import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'problem-nav',
  kind: 'component',
  title: 'Problem navigator',
  group: 'Work',
  purpose:
    'Five ways to move through a set without boxes of numbers, each naming a problem by its number and short title: segments, plain numbers, titled numbers, a picker and a titled list.',
  states: [
    {
      id: 'segments',
      name: 'A. Segments',
      when: 'A thin bar of one segment per problem (done filled, current outlined, failed danger), and under it "Problem 4 of 8 · RC step response".',
    },
    {
      id: 'numbers',
      name: 'B. Plain numbers',
      when: 'The numbers as text in a row like underline tabs: current underlined in the accent, done muted with a check, failed in danger.',
    },
    {
      id: 'picker',
      name: 'C. Titled picker',
      when: 'One line "4 · RC step response" with a chevron that opens every problem, and previous and next arrows beside it.',
    },
    {
      id: 'list',
      name: 'D. Titled list',
      when: 'A compact vertical list about 200 wide: number, title and a check, the current row highlighted. The pane puts it left of the problem.',
    },
    {
      id: 'titled-numbers',
      name: 'E. Titled numbers',
      when: 'B\u2019s row with each number followed by its title; too many and the titles truncate, then the row scrolls with an edge fade.',
    },
  ],
  exampleWidth: 640,
  stress:
    'The longest title, 30 problems and a failed one in every view: titles truncate, numbers wrap and the segments thin out.',
  actions: [
    {
      id: 'jump',
      label: 'A segment, number, row or menu item',
      key: 'Enter',
      does: 'Goes to that problem in one click. The picker’s arrows go to the previous and next problem.',
    },
  ],
  inputs: [
    {
      name: 'view',
      type: "'segments' | 'numbers' | 'titled-numbers' | 'picker' | 'list'",
      default: 'none',
      does: 'Which of the five to draw.',
    },
    {
      name: 'items',
      type: 'NavItem[]',
      default: 'none',
      does: 'Each problem’s id, label, short title and state: todo, done, failed or finding.',
    },
    {
      name: 'current, onJump',
      type: 'string, (id) => void',
      default: 'none',
      does: 'The problem the student is on, and which one was chosen.',
    },
  ],
  priority: {
    first: 'Which problem is current, then how many are done.',
    main: 'jump',
  },
  sizes: {
    narrowest: 320,
    gives: [
      'The segments get thinner',
      'The numbers wrap to more rows',
      'Titled numbers shrink their titles to 80 wide, then scroll sideways',
      'Titles truncate, in the list and the picker',
    ],
  },
  components: [
    { unit: 'action-menu', use: 'The picker’s menu of every problem.' },
    { unit: 'tooltip', use: 'Names a segment or number by title on hover.' },
  ],
  rules: {
    cite: [
      'work-first',
      'colour-has-a-word',
      'contrast-floors',
      'sentence-case',
    ],
  },
  log: 'web/src/units/problem-nav/log.md',
  decisions: [
    {
      id: 'problem-nav-d1',
      decision:
        'Five navigators to compare, A to E, each replacing the boxes of numbers. The boxes stay the default until Jack picks one.',
      why: 'Jack: "Not a fan of the boxes with the numbers for questions. Can you give me some other options?" Word for word in the log.',
      beat: 'Boxes of numbers (problem-strip-d1)',
      date: '2026-10-21',
    },
    {
      id: 'problem-nav-d2',
      decision:
        'Each problem has a short generated title of 2 to 4 words, shown with its number in every option and in the problem’s own heading.',
      why: 'Jack asked for "a short generated title to show with the problem number".',
      beat: 'Numbers only',
      date: '2026-10-21',
    },
  ],
});
