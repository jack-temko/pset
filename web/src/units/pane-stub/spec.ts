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
    },
    {
      id: 'boxed',
      name: 'Material with a problem boxed (stand-in)',
      when: 'After a page link in the work (P11): the problem’s box on the page-shaped block is outlined in the accent for a moment, then the outline fades.',
    },
    {
      id: 'ask',
      name: 'Ask (stand-in)',
      when: 'The problem Ask is about and an empty input. Not Ask’s design.',
    },
  ],
  stress:
    'A 79 character material name and a four digit page: everything wraps and nothing overflows.',
  actions: [
    {
      id: 'type',
      label: 'The Ask input',
      does: 'Takes typed text and does nothing with it: Ask is not designed yet.',
    },
  ],
  data: [
    {
      reads: 'A material’s name and page, the problem Ask is about',
      call: 'sample',
    },
  ],
  inputs: [
    {
      name: 'name',
      does: 'The material’s name.',
    },
    {
      name: 'page',
      does: 'The page it shows.',
    },
    {
      name: 'boxed',
      does: 'The problem whose box to outline, with a counter that restarts the outline when the same problem is followed again.',
    },
    {
      name: 'about',
      does: 'Ask only: the problem Ask is about; without it, "About nothing yet".',
    },
  ],
  priority: {
    first: 'The material’s name and its page.',
    main: 'type',
  },
  sizes: {
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
    {
      id: 'pane-stub-d2',
      decision:
        'The stand-ins have no failed state: they are replaced by the real panes, which decide theirs.',
      why: 'Not designed: noted when the spec format dropped the data waiting and failed fields (ideas/spec-format-grill.md, F9).',
      beat: 'A failed line in the data section',
      date: '2026-10-22',
    },
  ],
});
