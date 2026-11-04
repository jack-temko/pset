import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'workspace',
  kind: 'view',
  title: 'Workspace',
  group: 'Screens',
  purpose:
    'Where a set is done: a top bar with the path, then two sides of tabs split by a divider. Any of a set, a material or Ask sits in either side, and a side with no tabs folds away.',
  states: [
    {
      id: 'opening',
      name: 'Opening a set',
      when: 'A set was opened: its material on the left at the current problem’s page, the set on the right, half and half.',
    },
    {
      id: 'followed',
      name: 'A page link followed',
      when: 'The work’s page link was followed: the book’s showing tab turned from p. 111 to p. 113.',
    },
    {
      id: 'two-materials',
      name: 'Two materials and a set',
      when: 'The left side has Griffiths and the lecture notes as tabs, the set on the right.',
    },
    {
      id: 'folded',
      name: 'One side folded',
      when: 'The material’s last tab was closed: the set takes the full width.',
    },
    {
      id: 'returned',
      name: 'A tab dragged back',
      when: 'Ask was dragged onto the outer left third of the one open side: a new left side opens with that one tab, half and half.',
    },
    {
      id: 'twice',
      name: 'The same book twice',
      when: 'Griffiths is open at p. 111 on the left and p. 45 on the right, each at its own page, the set beside the second.',
    },
    {
      id: 'ask',
      name: 'Ask open',
      when: 'After "Ask about this" on problem 2: Ask is a tab on the left, side opposite the work, with the problem attached.',
    },
    {
      id: 'many',
      name: 'Many tabs',
      when: 'The left side has ten tabs: they shrink to their minimum, then the row scrolls with a fade at the edge.',
    },
    {
      id: 'loading',
      name: 'One side still loading',
      when: 'The left side has loaded and the right is still a skeleton: each side loads on its own, and both tab rows are there.',
    },
  ],
  stress:
    'A 79 character course, a 79 character set and a 70 character material, ten tabs and Ask open: the path and tabs truncate, panes wrap, nothing overflows.',
  flows: [
    {
      id: 'work-a-set',
      name: 'Work a set',
      steps: [
        'open-set',
        'follow-page-link',
        'ask-about',
        'close-material-side',
        'move-tab',
      ],
    },
  ],
  actions: [
    {
      id: 'open-set',
      label: 'A set, from Home or the course',
      does: 'Opens the workspace: the set’s material on the left at the current problem’s page, the set on the right.',
      target: { unit: 'workspace', state: 'opening' },
    },
    {
      id: 'follow-page-link',
      label: 'A page link in the work',
      does: 'Turns the book’s showing tab, on either side (or opens one opposite the work), to the page and flashes the problem’s box for 1.8 s.',
      target: { unit: 'workspace', state: 'followed' },
    },
    {
      id: 'box-one',
      label: 'Box one on the page, in the work’s menu',
      does: 'Turns the book to the problem’s page and puts that material tab in boxing mode; Done keeps the boxes on the problem.',
      target: { unit: 'material', state: 'boxing' },
    },
    {
      id: 'ask-about',
      label: 'Ask about this',
      does: 'Opens Ask as a tab on the side not holding the work, with the problem attached.',
      target: { unit: 'workspace', state: 'ask' },
    },
    {
      id: 'close-material-side',
      label: 'The x on the last tab of a side',
      does: 'The side folds away and the other takes the full width.',
      target: { unit: 'workspace', state: 'folded' },
    },
    {
      id: 'move-tab',
      label: 'Drag a tab, or "Move to other side"',
      does: 'The tab moves to the other side and opens there; with one side open, an outer third of its pane opens a new side there; the middle does nothing.',
      target: { unit: 'workspace', state: 'returned' },
    },
    {
      id: 'swap-sides',
      label: 'Swap sides',
      does: 'Both sides trade places, with their tabs, open tabs and the split.',
    },
    {
      id: 'drag-divider',
      label: 'Drag the divider',
      does: 'Changes the split; a side stops at 360px. A double click puts it back to half and half.',
    },
    {
      id: 'open-from-plus',
      label: '+ on a side',
      does: 'Opens a material (a new tab, so it can be open twice), another set, or Ask, as a tab on that side.',
    },
  ],
  data: [
    {
      reads:
        'The course’s name, materials and sets with their problems; which tabs are open',
      call: 'sample',
    },
  ],
  remembers: [
    {
      what: 'Which tabs are open on each side, the open tab on each, and the split',
      per: 'Course',
      for: 'Until you change the arrangement; not kept yet (the address will hold it).',
    },
    {
      what: 'The page each material tab shows',
      per: 'Material tab',
      for: 'Until you turn the page; not kept yet.',
    },
    {
      what: 'The problem you were on and the summary place, kept by the work pane',
      per: 'Set',
      for: 'Until the page closes today; see the work pane.',
    },
  ],
  inputs: [
    { name: 'course', does: 'The course’s name, materials and sets.' },
    {
      name: 'initial',
      does: 'Both sides’ tabs, the open tab on each, the split and each material tab’s page: all the address would hold, as one value.',
    },
    {
      name: 'loading',
      does: 'Which sides still show their pane as a skeleton.',
    },
    {
      name: 'onChange',
      does: 'Called with the whole state when anything in it changes.',
    },
    {
      name: 'today',
      does: 'The day Due soon counts from (the design page and tests).',
    },
    {
      name: 'homeHref',
      does: 'Where the wordmark goes.',
    },
    {
      name: 'courseHref',
      does: 'Where the course in the path goes.',
    },
    {
      name: 'settingsHref',
      does: 'Where Settings goes.',
    },
  ],
  priority: {
    first: 'The work, with its material beside it.',
    main: 'follow-page-link',
  },
  sizes: {
    gives: [
      'Desktop only: there is no layout for a narrow window',
      'The divider stops at 360px for each side',
      'Tabs shrink, then their rows scroll',
    ],
  },
  exampleWidth: 'full',
  rules: {
    cite: ['work-first', 'material-is-main', 'honest-waits', 'sentence-case'],
  },
  log: 'web/src/units/workspace/log.md',
  decisions: [
    {
      id: 'workspace-d1',
      decision:
        'The top bar is the path only, "PSet / Circuits I / Problem set 4", and Settings. Progress lives in the work pane.',
      why: 'Jack’s pick, W1.',
      beat: 'Path plus the set’s progress; no top bar',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d2',
      decision:
        'The sides split half and half by default, draggable, a side never under 360px.',
      why: 'Jack’s pick, W3; the 360px stop is Assumed. Remembering the split per course (S8) is not wired yet.',
      beat: 'Material wider; work wider',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d3',
      decision:
        'A side whose last tab closes folds away; the other takes the full width. It comes back only when a tab is dragged onto an outer third of the open side.',
      why: 'Jack’s pick, W4: no empty boxes. Confirms A1. Jack: "Drop the open to the side please... No more open to the side."',
      beat: 'An empty side listing what to open',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d4',
      decision:
        '"Ask about this" opens Ask as a tab on the side not holding the work, the problem attached. There is one Ask; it is brought along.',
      why: 'Jack’s pick, W5. Reaffirms S9. One Ask is assumed.',
      beat: 'Under the work; a floating panel',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d5',
      decision:
        'A material can be open twice, each tab at its own page. Replaces A2.',
      why: 'Jack’s pick, W6: an example page beside a problem page.',
      beat: 'Open once only',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d6',
      decision:
        'A tab moves to the other side by dragging it or by "Move to other side"; "Swap sides" swaps both.',
      why: 'Jack’s pick, W7.',
      beat: 'A menu only',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d13',
      decision:
        'A split zone tints the half the new side will take, whole side with its tab row, in the same tint as any drop target: no outline, never dashed.',
      why: 'Jack, W18 (workspace-grill): the outlines differed in style and size; one look for every drop target.',
      beat: 'A dashed box labelled Drop to open here',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d14',
      decision:
        'With one side open, a tab dragged to an outer third of its pane opens a new side there, half and half; the middle does nothing. A lone tab cannot split.',
      why: 'Jack, W19: "I want it to be similar to [VS Code]. Hit the edge cases please." Zones: VS Code thirds. Full words in the log.',
      beat: 'Halves of the window; only the left',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d15',
      decision:
        'When the open tab leaves a side, that side shows its most recently used remaining tab; a dropped tab becomes the open tab of its side.',
      why: 'Jack, W19: next tab "most recently used".',
      beat: 'The next tab, or the one before',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d7',
      decision:
        'No code for narrow windows: PSet is desktop only. There is no notice, no breakpoint and no small layout. Replaces A3.',
      why: 'Jack: "remember, we do NOT support mobile or small screens. We do NOT need to include any code or styling related to that."',
      beat: 'A "needs a wider window" notice; one side with a switch; stacked sides',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d8',
      decision:
        'A page link turns the book’s showing tab, on either side; if none shows, its tab opposite the work; if none, it opens one there. Never a duplicate.',
      why: 'Jack: "the visible one, or the one on the other side" (W14).',
      beat: 'The other side’s tab first; always a new tab',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d9',
      decision:
        'Everything open is one State value: both sides’ tabs, the open tab on each, the split and each tab’s page. It encodes to a query string and back.',
      why: 'Assumed in workspace-grill (A6): the address keeps what is open. Not wired to the address or remembered per course yet.',
      beat: 'State scattered across the panes',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d10',
      decision:
        'A side’s + menu offers the course’s materials, its other sets, and Ask.',
      why: 'Jack’s pick, W10: one place to open anything.',
      beat: 'Materials and Ask only',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d11',
      decision:
        'Opening a set puts its material on the left at the current problem’s page and the set on the right.',
      why: 'Jack’s pick, W9: nothing to set up. Reaffirms S7.',
      beat: 'As you left it; the set alone',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d12',
      decision: 'No keyboard shortcuts for now.',
      why: 'Jack: "None for now" (W12).',
      beat: 'An editor-style set; the basics',
      date: '2026-10-21',
    },
    {
      id: 'workspace-d16',
      decision:
        'The workspace has no failed state yet: the panes decide theirs in their own grills.',
      why: 'Not designed: noted when the spec format dropped the data waiting and failed fields (ideas/spec-format-grill.md, F9).',
      beat: 'A failed line in the data section',
      date: '2026-10-22',
    },
    {
      id: 'workspace-d17',
      decision:
        'A page link turns the material and flashes the problem’s box; the request is spent after 2 s, so a tab opened again does not flash.',
      why: 'Jack: "the visible one, or the one on the other side" (W-page link) and "Page, problem outlined (Recommended)" (P11, work-d4).',
      beat: 'Page only; a flash on every visit',
      date: '2026-10-22',
    },
    {
      id: 'workspace-d18',
      decision:
        '"Box one on the page" opens boxing mode on the material tab, at the problem’s page; boxes drawn survive a tab switch and Done keeps them on the problem.',
      why: 'Jack picked "A boxing mode in the material pane (Recommended)" (M11); keeping them is the build’s sample until the server saves them.',
      beat: 'A separate full-window boxing screen',
      date: '2026-10-22',
    },
  ],
});
