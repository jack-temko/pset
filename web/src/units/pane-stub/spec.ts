import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'pane-stub',
  kind: 'component',
  title: 'Ask stand-in',
  group: 'Panes',
  purpose:
    'A STAND-IN, not a design: a placeholder Ask pane (the work and material panes are real now), so the workspace can be driven. The real Ask pane is its own grill.',
  states: [
    {
      id: 'ask',
      name: 'Ask (stand-in)',
      when: 'The problem Ask is about and an empty input. Not Ask’s design.',
    },
  ],
  stress:
    'A 110 character problem to ask about: it wraps and nothing overflows.',
  actions: [
    {
      id: 'type',
      label: 'The Ask input',
      does: 'Takes typed text and does nothing with it: Ask is not designed yet.',
    },
  ],
  data: [
    {
      reads: 'The problem Ask is about',
      call: 'sample',
    },
  ],
  inputs: [
    {
      name: 'about',
      does: 'Ask only: the problem Ask is about; without it, "About nothing yet".',
    },
  ],
  priority: {
    first: 'The problem Ask is about.',
    main: 'type',
  },
  sizes: {
    gives: ['Text wraps'],
  },
  exampleWidth: 560,
  rules: {
    cite: ['serif-to-read', 'honest-waits', 'sentence-case'],
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
    {
      id: 'pane-stub-d3',
      decision:
        'The material stand-in is gone: the real material pane replaces it in the workspace. Only Ask remains a stand-in.',
      why: 'The material pane grill (ideas/material-pane-grill.md) is built; pane-stub-d1 said the stand-ins go when the real panes land.',
      beat: 'Keeping both',
      date: '2026-10-22',
    },
  ],
});
