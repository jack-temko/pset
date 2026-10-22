import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'pane-stub',
  kind: 'component',
  title: 'Pane stand-ins',
  group: 'Panes',
  purpose:
    'STAND-INS, not designs: placeholder material and Ask panes (the work pane is real now), so the workspace can be driven. The real panes are their own grills.',
  states: [
    {
      id: 'material',
      name: 'Material (stand-in)',
      when: 'The material’s name, "Page 112" and a page-shaped block. Not the material pane’s design.',
      skeleton:
        'A label bar, a title bar, a page number bar and a page-shaped block.',
    },
    {
      id: 'boxed',
      name: 'Material with a problem boxed (stand-in)',
      when: 'After a page link in the work (P11): the problem’s box on the page-shaped block is outlined in the accent for a moment, then the outline fades.',
      skeleton: 'The material’s own skeleton: the box is not drawn.',
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
    'A 79 character material name and a four digit page: everything wraps and nothing overflows.',
  components: [],
  actions: [
    {
      id: 'type',
      label: 'The Ask input',
      key: 'Tab',
      does: 'Takes typed text and does nothing with it: Ask is not designed yet.',
    },
  ],
  data: [
    {
      reads: 'A material’s name and page, the problem Ask is about',
      call: 'None yet: sample data in the workspace unit',
      waiting: 'Each pane’s own skeleton, in the same frame.',
      failed: 'Not designed: stand-ins have no failed state.',
    },
  ],
  inputs: [
    {
      name: 'name, page, boxed',
      type: 'MaterialStub props',
      default: 'none',
      does: 'The material’s name, the page it shows, and the problem whose box to outline (with a counter that restarts the outline when the same problem is followed again).',
    },
    {
      name: 'about',
      type: 'AskStub prop',
      default: 'none',
      does: 'The problem Ask is about; without it, "About nothing yet".',
    },
  ],
  priority: {
    first: 'The material’s name and its page.',
    main: 'type',
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
        'These panes are stand-ins, labelled as such on screen, built only so the workspace can be driven; their real designs are later grills.',
      why: 'ideas/workspace.md: "They exist only so the workspace can be driven; their real designs are later grills."',
      beat: 'Designing the panes here',
      date: '2026-10-21',
    },
  ],
});
