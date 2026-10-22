import { defineSpec } from '@/design/spec';

const SKELETON =
  'The set line, a strip of segments, then what it opens on: a problem as bars and help rows, or the summary as bars and two button stubs, centred.';

export default defineSpec({
  id: 'work',
  kind: 'pane',
  title: 'Work',
  group: 'Work',
  purpose:
    'One problem set being worked: the set line, a strip of every problem, the one you are on with its help, and a summary as the last stop.',
  states: [
    {
      id: 'current-underline',
      name: 'In progress, current underlined',
      when: 'Eight problems, one in each state, the current one marked by a line under its segment; the fourth problem with its note and parts.',
      skeleton: SKELETON,
    },
    {
      id: 'summary',
      name: 'Summary, not finished',
      when: 'The "Summary" label after the bar was pressed with 2 of 8 done: "2 of 8 done", total time, when it is due, time per problem, Turn in.',
      text: '2 of 8 done',
      skeleton: SKELETON,
    },
    {
      id: 'summary-finished',
      name: 'Summary, finished',
      when: 'All done: "All 8 done", one muted line of figures, the bars, the longest, Turn in and Back to the course.',
      text: 'All 8 done',
      skeleton: SKELETON,
    },
    {
      id: 'summary-turned-in',
      name: 'Summary, turned in',
      when: 'Handed in: "Turned in Oct 14", the same figures, and Take back where Turn in was.',
      text: 'Turned in Oct 14',
      skeleton: SKELETON,
    },
    {
      id: 'empty',
      name: 'No problems yet',
      when: 'A set with no problems: "No problems yet" and Add problems, centred in the pane.',
      text: 'No problems yet',
      skeleton: SKELETON,
    },
    {
      id: 'plain',
      name: 'Plain problem',
      when: 'A one line statement, no note, no figures, help closed: the plainest a problem gets.',
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
    {
      unit: 'summary',
      use: 'The last stop: figures for the set, Turn in, Back to the course.',
    },
    { unit: 'tag', use: 'The "Turned in" tag.' },
  ],
  actions: [
    {
      id: 'open-set',
      label: 'A set in Assignments',
      key: 'Enter',
      does: 'Opens the set at the problem the student left, or the first one to do.',
      target: { unit: 'work', state: 'current-underline' },
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
      does: 'Shows the summary, with every problem done.',
      target: { unit: 'work', state: 'summary-finished' },
    },
    {
      id: 'open-summary',
      label: 'The "Summary" label after the bar',
      key: 'Enter',
      does: 'Opens the summary any time. A segment returns to its problem; Next on the last problem comes here too.',
      target: { unit: 'work', state: 'summary' },
    },
    {
      id: 'turn-in',
      label: 'Turn in',
      key: 'Enter',
      does: 'Hands the set in; with problems left it asks first.',
      target: { unit: 'work', state: 'summary-turned-in' },
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
      name: 'startAt, startSummary',
      type: 'string, boolean',
      default: 'where the student left, false',
      does: 'The problem to open on, or the summary.',
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
        'Next goes to the next problem still to do after this one; on the last it goes to the summary.',
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
    {
      id: 'work-d9',
      decision:
        'Segments are coloured by state (done, started, not started, working, queued, failed); the current one is underlined.',
      why: 'Jack: "Also have the colors of the bar represent the state of the question".',
      beat: 'Accent and danger only; an outer outline',
      date: '2026-10-21',
    },
    {
      id: 'work-d10',
      decision:
        'The current problem is marked by an underline in its segment\u2019s colour, and only that.',
      why: 'Jack: "go with the underline, drop the others", then "Can we make the line the same color as the segment".',
      beat: 'Taller and inset segments',
      date: '2026-10-21',
    },
    {
      id: 'work-d11',
      decision:
        'The summary is the last stop after the segments: a flag at the end of the bar opens it any time, Next on the last problem goes to it, a segment returns.',
      why: 'Jack: "Also the finished page doesnt look the best. Can we include some light stats?" and, on how to reach it, "A last stop after the segments".',
      beat: 'A finish card only after the last problem; a button in the set line',
      date: '2026-10-21',
    },
    {
      id: 'work-d12',
      decision:
        'The summary replaces the finish card. A finished or turned-in set opens on it; an unfinished one on its remembered problem.',
      why: 'Jack: "how to get to it and see it, and switch to and from it"; reopen: "The summary".',
      beat: 'Reopening on the last problem',
      date: '2026-10-21',
    },
    {
      id: 'work-d13',
      decision:
        'Turn in is on the summary and in the set menu; an unfinished set still asks first. Take back is in both places.',
      why: 'Jack: "On the summary, plus the set menu".',
      beat: 'Turn in only in the menu',
      date: '2026-10-21',
    },
    {
      id: 'work-d14',
      decision:
        'Anything that stands alone in the pane (the summary, a set with no problems, a problem being found or not found) is centred, across and down.',
      why: 'Jack: "Make sure every part of the panel looks good when not expanded or empty. For example we should center what we can vertically and horizontally."',
      beat: 'Standing at the top with empty space under',
      date: '2026-10-21',
    },
    {
      id: 'work-d15',
      decision:
        'Once every problem is done or the set is turned in, the set line drops the due badge and shows a neutral "Done" or "Turned in" tag.',
      why: 'Coordinator, 2026-10-21: a finished set still showed "Due soon" or "Overdue", which no longer means anything.',
      beat: 'A due badge on a finished set',
      date: '2026-10-21',
    },
    {
      id: 'work-d16',
      decision:
        'The summary is a box like a list, and shows no due date; the set line keeps it. The rulebook gets say-it-once.',
      why: 'Jack: "Can we show these a bit more github-y" and "Shown in two spots. This should be a rule, avoid duplication where possible".',
      beat: 'Due on both the summary and the set line',
      date: '2026-10-21',
    },
    {
      id: 'work-d17',
      supersededBy: 'work-d18',
      decision:
        'Four summary looks to compare: A box, B like Home, C plain, D tiles. All say the same and none shows a due date.',
      why: 'Jack: "the set panel summary page still looks not my favorite, almost too github-y now. lest A/B some options".',
      beat: 'The one GitHub box',
      date: '2026-10-21',
    },
    {
      id: 'work-d18',
      supersededBy: 'work-d19',
      decision:
        'The summary is the plain look only. Four ways to reach it are compared: the flag, a label after the bar, a link in the set line, one more segment.',
      why: 'Jack: "lets go with C. Still dont like the summary as that icon at the end, lets A/B that now".',
      beat: 'Four summary looks; only the flag',
      date: '2026-10-21',
    },
    {
      id: 'work-d19',
      decision:
        'The summary is reached by a "Summary" label after the bar, underlined in its own colour while it shows; Next on the last problem goes there too.',
      why: 'Jack: "B, then approved, make sure the bar is the similar color as the text".',
      beat: 'A flag icon; a link in the set line; one more segment',
      date: '2026-10-21',
    },
  ],
});
