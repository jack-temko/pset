import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'problem',
  kind: 'component',
  title: 'Problem',
  group: 'Work',
  purpose:
    'One problem to work on: the professor’s note, its label and page link, the statement with figures and parts, three help rows, and Mark done, Ask about this, Next and one menu.',
  states: [
    {
      id: 'ready',
      name: 'Ready',
      when: 'Found: the statement with math and a figure, three closed help rows and the actions.',
    },
    {
      id: 'parts',
      name: 'Note and parts',
      when: 'A professor’s note above, and parts (a) to (d) with the ones the note skips dimmed, marked "Skipped" and given no help.',
    },
    {
      id: 'plain',
      name: 'Plain',
      when: 'A one line statement, no note, no figures, no parts and help closed.',
    },
    {
      id: 'done',
      name: 'Done',
      when: 'Marked done: the button reads "Done" and Next becomes the primary.',
    },
    {
      id: 'finding',
      name: 'Being found',
      when: 'The problem shows its place and the wait; Mark done and Ask about this say why they cannot act yet.',
      text: 'Finding 4.62 on page 112 · about 10 s',
    },
    {
      id: 'writing',
      name: 'Writing help',
      when: 'The problem is found but a help step is not written: its row says so and when.',
      text: 'Writing the walkthrough · about 20 s',
    },
    {
      id: 'failed',
      name: 'Not found, first time',
      when: 'Says what failed and what was tried; Try again leads, then box it on the page and paste the text.',
      text: "Couldn't find 4.62",
    },
    {
      id: 'failed-twice',
      name: 'Not found, second time',
      when: 'Says it is the second try; box it on the page leads, Try again moves down.',
      text: "Still couldn't find 4.62 (2nd try)",
    },
  ],
  exampleWidth: 680,
  stress:
    'A 70 character unbroken word in a long statement, a 60 character label, a 3 line note, and all three help rows open.',
  actions: [
    {
      id: 'mark-done',
      label: 'Mark done',
      does: 'Marks this problem done, or takes it back when it already is.',
    },
    {
      id: 'ask',
      label: 'Ask about this',
      does: 'Asks the workspace to open Ask with this problem as a chip. The workspace is not a unit yet, so it has no target.',
    },
    {
      id: 'next',
      label: 'Next',
      does: 'Goes to the next problem still to do; it marks nothing.',
    },
    {
      id: 'open-page',
      label: 'p. 112',
      does: 'Asks the workspace to turn the material to the page and outline the problem’s box. It has no target yet.',
    },
    {
      id: 'open-help',
      label: 'Hint, Walkthrough, Answer',
      does: 'Opens or closes that help step.',
    },
    {
      id: 'menu',
      label: 'The "⋯" menu',
      does: 'Edit, move, note, check the figure, wrong problem, remove.',
    },
    {
      id: 'fix',
      label: 'Try again, Box it on the page, Paste the text',
      does: 'What to try after a problem was not found.',
    },
  ],
  inputs: [
    {
      name: 'problem',
      does: 'The label, page, note, statement as runs, figures, parts, the help steps, whether it was found, and whether it is done.',
    },
    { name: 'index', does: 'Its place in the set, from 1.' },
    { name: 'openHelp', does: 'Which help steps start open.' },
    { name: 'nextNotReady', does: 'Why Next cannot go on, said in a tooltip.' },
    { name: 'onDone', does: 'Called when Mark done is pressed or taken back.' },
    { name: 'onAsk', does: 'Called when Ask about this is pressed.' },
    { name: 'onOpenPage', does: 'Called when the page link is pressed.' },
    { name: 'onNext', does: 'Called when Next is pressed.' },
    {
      name: 'onMenu',
      does: 'Called when a menu item of the problem is picked.',
    },
    {
      name: 'onFix',
      does: 'Called with the fix the student picked on a failed or stuck problem.',
    },
  ],
  priority: {
    first: 'The statement, then the actions.',
    main: 'mark-done',
  },
  sizes: {
    gives: [
      'The text keeps to 66 characters, then fills the width',
      'The actions wrap',
      'The figures wrap under each other',
    ],
  },
  rules: {
    cite: [
      'smallest-help-first',
      'student-decides',
      'work-first',
      'one-primary',
      'honest-waits',
      'failure-says-what',
      'serif-to-read',
      'figures-follow-text',
      'colour-has-a-word',
      'links-go-buttons-do',
      'sentence-case',
    ],
  },
  log: 'web/src/units/problem/log.md',
  decisions: [
    {
      id: 'problem-d1',
      decision:
        'Each problem has its own Mark done; Next only moves on and marks nothing.',
      why: 'Jack picked "Its own Done button (Recommended)": finding #4, Next marked problems done without saying so (P2).',
      beat: 'Next marks and says so; done on opening the answer',
      date: '2026-10-21',
    },
    {
      id: 'problem-d2',
      decision:
        'Visible: Mark done, Next, the help rows, Ask about this and the page link. Edit, move, note, check figure, wrong problem and remove are in one menu.',
      why: 'Jack picked "Only the work (Recommended)": today shows 14 controls (P4).',
      beat: 'Keeping notes and "wrong problem" visible',
      date: '2026-10-21',
    },
    {
      id: 'problem-d3',
      decision:
        'Parts a note skips show dimmed with "Skipped" and get no help.',
      why: 'Jack picked "Dim the skipped parts (Recommended)": finding #13 (P7).',
      beat: 'Hide them; the note only',
      date: '2026-10-21',
    },
    {
      id: 'problem-d4',
      decision:
        'Beside the problem’s number sit its label and page link ("4.62 · p. 112"), and nothing else.',
      why: 'Jack picked "Label and page link (Recommended)": time and difficulty stay out of the way (P14).',
      beat: 'Time spent; difficulty',
      date: '2026-10-21',
    },
    {
      id: 'problem-d5',
      decision:
        'The professor’s note sits above the problem as a quiet bordered note.',
      why: 'Jack picked "A note above the problem (Recommended)": read before the problem (P15).',
      beat: 'Below the problem',
      date: '2026-10-21',
    },
    {
      id: 'problem-d6',
      decision:
        'A problem shows as soon as it is found, and each help step still being written says so and when.',
      why: 'Jack picked "Problem first, help says when (Recommended)": F5, waiting gave no place or time (P10).',
      beat: 'One waiting line for everything',
      date: '2026-10-21',
    },
    {
      id: 'problem-d7',
      decision:
        'A second failure says so ("Still couldn’t find 4.62 (2nd try)"), what was tried, and leads with the next fix; Try again moves down.',
      why: 'Jack picked "Says it’s the second try (Recommended)": F6 (P16).',
      beat: 'The same message each time',
      date: '2026-10-21',
    },
    {
      id: 'problem-d8',
      decision:
        'Figures sit under the text and a press shows one larger. "Check how the figure reads" is in the menu.',
      why: 'Assumed in the work pane grill.',
      beat: 'Figures beside the text',
      date: '2026-10-21',
    },
  ],
});
