import { defineSpec } from '@/design/spec';

const SKELETON =
  'The set line as an empty outlined row, a strip of chips as blocks, then the problem as a heading bar, three lines, three help rows and the buttons.';

export default defineSpec({
  id: 'work',
  kind: 'pane',
  title: 'Work',
  group: 'Work',
  purpose:
    'One problem set being worked: the set line, a strip of every problem, the one you are on with its help, and a finish card at the end.',
  states: [
    {
      id: 'in-progress',
      name: 'In progress',
      when: 'Eight problems, three done: the set line, the strip, and the fourth problem with its note and parts.',
      skeleton: SKELETON,
    },
    {
      id: 'all-done',
      name: 'All done',
      when: 'The last problem was marked done: the finish card in place of the problem.',
      text: 'All 8 done · 2 h 10 m',
      skeleton: SKELETON,
    },
    {
      id: 'finding',
      name: 'A problem still being found',
      when: 'The fifth problem is being found: its place and the wait, a dashed chip, and the rest of the set works.',
      text: 'Finding 4.62 on page 112 · about 10 s',
      skeleton: SKELETON,
    },
    {
      id: 'failed',
      name: 'A problem not found',
      when: 'The fifth problem could not be found: what failed, what was tried, and the fix to try next.',
      text: "Couldn't find 4.62",
      skeleton: SKELETON,
    },
    {
      id: 'turned-in',
      name: 'Turned in',
      when: 'The set is handed in: a "Turned in" banner with Take back, and the finish card with Take back where Turn in was.',
      skeleton: SKELETON,
    },
  ],
  exampleWidth: 640,
  stress:
    '30 problems in the strip, 60 character labels, a 90 character set name, and a first problem with a long statement, a long note and a 70 character word.',
  flows: [
    {
      id: 'work-the-set',
      name: 'Work the set to the end',
      steps: [
        'open-set',
        'read-hint',
        'mark-done',
        'next',
        'jump',
        'finish',
        'turn-in',
      ],
    },
  ],
  components: [
    { unit: 'action-menu', use: 'The set menu beside the set line.' },
    {
      unit: 'button',
      use: 'Take back, Turn in anyway, Keep working and Undo.',
    },
    { unit: 'finish-card', use: 'The card after the last problem is done.' },
    { unit: 'list', use: 'Frames the set line.' },
    {
      unit: 'list-row',
      use: 'The set line: name, due, time left and progress.',
    },
    { unit: 'problem', use: 'The problem being worked.' },
    { unit: 'problem-strip', use: 'The strip of numbered chips.' },
    {
      unit: 'set-line',
      use: 'The due date and its label, and the time-left wording.',
    },
    { unit: 'tag', use: 'The "Turned in" tag.' },
  ],
  actions: [
    {
      id: 'open-set',
      label: 'A set in Assignments',
      key: 'Enter',
      does: 'Opens the set at the problem the student left, or the first one to do.',
      target: { unit: 'work', state: 'in-progress' },
    },
    {
      id: 'read-hint',
      label: 'Hint',
      key: 'Enter',
      does: 'Opens the hint under the problem; the walkthrough and answer stay closed until asked.',
    },
    {
      id: 'mark-done',
      label: 'Mark done',
      key: 'Enter',
      does: 'Marks the problem done. It does not move on.',
    },
    {
      id: 'next',
      label: 'Next',
      key: 'Enter',
      does: 'Goes to the next problem still to do, past the end back to the start. It marks nothing.',
    },
    {
      id: 'jump',
      label: 'A chip in the strip',
      key: 'Enter',
      does: 'Goes to that problem in one click, such as the fifth.',
    },
    {
      id: 'finish',
      label: 'Mark done on the last problem',
      key: 'Enter',
      does: 'Shows the finish card.',
      target: { unit: 'work', state: 'all-done' },
    },
    {
      id: 'turn-in',
      label: 'Turn in',
      key: 'Enter',
      does: 'Hands the set in; with problems left it asks first.',
      target: { unit: 'work', state: 'turned-in' },
    },
    {
      id: 'take-back',
      label: 'Take back',
      key: 'Enter',
      does: 'Takes the set back so it can be worked on again.',
    },
    {
      id: 'open-page',
      label: 'The page link',
      key: 'Enter',
      does: 'Tells the workspace to turn the material to the page and outline the problem’s box. The workspace is not a unit yet, so it has no target.',
    },
    {
      id: 'ask',
      label: 'Ask about this',
      key: 'Enter',
      does: 'Tells the workspace to open Ask with "About 4.62" as a chip. It has no target yet.',
    },
    {
      id: 'remove',
      label: 'Remove, in the problem menu',
      key: 'Enter',
      does: 'Removes the problem at once and says "Removed 4.62 · Undo" for six seconds.',
    },
    {
      id: 'set-menu',
      label: 'The set menu',
      key: 'Enter',
      does: 'Add problems, Box one on the page, Edit, Print worksheet, Turn in or Take back, Delete (with Undo).',
    },
  ],
  data: [
    {
      reads:
        'The set (name, due, time left, time spent) and its problems with their labels, pages, statements, figures, parts and help',
      call: 'None yet: sample data (the workspace will pass the real set)',
      waiting:
        'The set line, the strip and the problem as skeletons in their own heights; a problem still being found says so and when.',
      failed:
        'A problem that cannot be found says what failed, what was tried and what to do next, on its own page.',
    },
  ],
  inputs: [
    {
      name: 'set',
      type: 'WorkSet',
      default: 'none',
      does: 'The set and its problems.',
    },
    {
      name: 'startAt, startFinish',
      type: 'string, boolean',
      default: 'where the student left, false',
      does: 'The problem to open on, or the finish card.',
    },
    {
      name: 'memory',
      type: 'Memory',
      default: 'one kept while the page is open',
      does: 'Where the current problem of each set is remembered.',
    },
    {
      name: 'onOpenPage, onAsk, onBackToCourse, onSetMenu, onProblemMenu, onFix',
      type: 'callbacks',
      default: 'none',
      does: 'What the workspace will handle: open a page with the problem’s box, ask about a problem, and the menus.',
    },
  ],
  priority: {
    first: 'The problem you are on, then how far through the set you are.',
    main: 'mark-done',
  },
  sizes: {
    narrowest: 320,
    gives: [
      'The pane’s content is at most 760 wide, centred',
      'The progress bar goes below 440 and the count stays in the meta',
      'The strip wraps to more rows',
    ],
  },
  rules: {
    cite: [
      'smallest-help-first',
      'student-decides',
      'work-first',
      'material-is-main',
      'honest-waits',
      'failure-says-what',
      'one-primary',
      'sentence-case',
    ],
  },
  log: 'web/src/units/work/log.md',
  decisions: [
    {
      id: 'work-d1',
      supersededBy: 'work-d8',
      decision:
        'The header is the set line (name, badge, due date, time left) without a progress bar or count, then the strip, which is the progress.',
      why: 'Jack picked "Set line + strip (Recommended)": the tab already names the set (P5).',
      beat: 'Strip only; a big title',
      date: '2026-10-21',
    },
    {
      id: 'work-d2',
      decision:
        'Remove is immediate, with "Removed 4.62 · Undo" for six seconds and no confirm.',
      why: 'Jack picked "Undo, no confirm (Recommended)": finding #7 (P8).',
      beat: 'Confirm and no undo',
      date: '2026-10-21',
    },
    {
      id: 'work-d3',
      decision:
        'Turn in warns on an unfinished set ("3 of 8 aren’t done. Turn in anyway?"); once turned in, Take back sits where Turn in was.',
      why: 'Jack picked "Warn, and Take back (Recommended)": finding #8 (P9).',
      beat: 'Only when all done; no Turn in',
      date: '2026-10-21',
    },
    {
      id: 'work-d4',
      decision:
        'The page link opens the page and outlines the problem\u2019s box; Ask about this opens Ask with "About 4.62" as a chip. The pane only tells the workspace.',
      why: 'Jack picked "Page, problem outlined (Recommended)" and "A chip in Ask (Recommended)" (P6, P11).',
      beat: 'Page only; the problem quoted in full',
      date: '2026-10-21',
    },
    {
      id: 'work-d5',
      decision:
        'The current problem of each set is remembered, so reopening lands where the student left. The pane keeps it while the page is open, until the workspace does.',
      why: 'Assumed in the work pane grill (S8); keep-the-place.',
      beat: 'Always the first problem',
      date: '2026-10-21',
    },
    {
      id: 'work-d6',
      decision:
        'Next goes to the next problem still to do, or says "This is the only one left to do"; with all done it shows the finish card.',
      why: 'Assumed in the work pane grill.',
      beat: 'Next in plain order',
      date: '2026-10-21',
    },
    {
      id: 'work-d7',
      decision:
        'The pane is built on its own, on the design page; the workspace swaps it in for its stand-in once both have merged.',
      why: 'Jack, 2026-10-21: "Build along side."',
      beat: 'Waiting for the workspace',
      date: '2026-10-21',
    },
    {
      id: 'work-d8',
      decision:
        'The navigator is the segments bar, with no line under it; the set line drops its progress bar and "3 of 8" and keeps the name, badge, time left and due date.',
      why: 'Jack: "Lets go with the segments"; on the segments, the line and "3 of 8": "Don\'t these show the same thing?"; "We don\'t need the title twice".',
      beat: 'Boxes of numbers; a progress bar and count in the set line',
      date: '2026-10-21',
    },
  ],
});
