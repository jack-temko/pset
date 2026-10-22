import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'pane-stub',
  kind: 'pane',
  title: 'Pane stand-ins',
  group: 'Panes',
  purpose:
    'STAND-INS, not designs: placeholder work, material and Ask panes, so the workspace can be driven. The real panes are their own grills.',
  states: [
    {
      id: 'work',
      name: 'Work (stand-in)',
      when: 'A set’s name and three problems, each with a page link and "Ask about this". Not the work pane’s design.',
      skeleton:
        'A label bar, a title bar, and three problems as a bar, a text block and a bar.',
    },
    {
      id: 'material',
      name: 'Material (stand-in)',
      when: 'The material’s name, "Page 112" and a page-shaped block. Not the material pane’s design.',
      skeleton:
        'A label bar, a title bar, a page number bar and a page-shaped block.',
    },
    {
      id: 'ask',
      name: 'Ask (stand-in)',
      when: 'The problem Ask is about and an empty input. Not Ask’s design.',
      skeleton:
        'A label bar, a title bar, the problem line and an input-sized block.',
    },
  ],
  stress:
    'A 79 character set name and problem texts three times as long, with four digit pages: everything wraps and nothing overflows.',
  flows: [
    { id: 'follow-a-page', name: 'Follow a page', steps: ['page-link'] },
    { id: 'ask', name: 'Ask about a problem', steps: ['ask-about'] },
  ],
  components: [
    { unit: 'button', use: '"Ask about this", quiet.' },
    { unit: 'link', use: 'The page link of each problem.' },
  ],
  actions: [
    {
      id: 'page-link',
      label: 'p. 112',
      key: 'Enter',
      does: 'Asks the workspace to turn the material to that page. The workspace decides which tab (workspace-d8).',
    },
    {
      id: 'ask-about',
      label: 'Ask about this',
      key: 'Enter',
      does: 'Asks the workspace to open Ask on the other side with this problem attached.',
    },
  ],
  data: [
    {
      reads:
        'A set’s problems with their pages, a material’s name and page, the problem Ask is about',
      call: 'None yet: sample data in the workspace unit',
      waiting: 'Each pane’s own skeleton, in the same frame.',
      failed: 'Not designed: stand-ins have no failed state.',
    },
  ],
  inputs: [
    {
      name: 'name, material, problems, onPage, onAsk',
      type: 'WorkStub props',
      default: 'none',
      does: 'The set, the material its links point into, its problems, and what a page link and "Ask about this" do.',
    },
    {
      name: 'name, page',
      type: 'MaterialStub props',
      default: 'none',
      does: 'The material’s name and the page it shows.',
    },
    {
      name: 'about',
      type: 'AskStub prop',
      default: 'none',
      does: 'The problem Ask is about; without it, "About nothing yet".',
    },
  ],
  priority: {
    first: 'The set’s name and its first problem.',
    main: 'ask-about',
  },
  sizes: {
    narrowest: 360,
    gives: [
      'Text wraps',
      'The page block keeps its shape and scrolls with the pane',
    ],
  },
  exampleWidth: 560,
  rules: {
    cite: [
      'material-is-main',
      'serif-to-read',
      'honest-waits',
      'sentence-case',
    ],
  },
  log: 'web/src/units/pane-stub/log.md',
  decisions: [
    {
      id: 'pane-stub-d1',
      decision:
        'These three panes are stand-ins, labelled as such on screen, built only so the workspace can be driven; their real designs are later grills.',
      why: 'ideas/workspace.md: "They exist only so the workspace can be driven; their real designs are later grills."',
      beat: 'Designing the panes here',
      date: '2026-10-21',
    },
  ],
});
