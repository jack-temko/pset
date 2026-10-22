import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'tooltip',
  kind: 'component',
  title: 'Tooltip',
  group: 'Basics',
  purpose:
    'A small floating label tied to one control. It shows on hover and focus, finds room inside the viewport, and no parent clips it.',
  states: [
    {
      id: 'below',
      name: 'Below',
      when: 'The default: below its control, centred, 4 away.',
    },
    {
      id: 'above',
      name: 'Above',
      when: 'Forced by side, or taken when there is no room below.',
    },
    {
      id: 'long',
      name: 'Long text',
      when: 'A 120 character text wraps at 250 wide.',
    },
    {
      id: 'edge',
      name: 'At an edge',
      when: 'Its control is at the right edge, so it shifts inward and keeps 8 from the viewport.',
    },
  ],
  stress:
    'A 120 character text, its control in a 120px container at the surface bottom right.',
  actions: [
    {
      id: 'show',
      label: 'The control',
      does: 'Shows the tooltip on hover (after 50ms) or on keyboard focus (at once).',
    },
    {
      id: 'hide',
      label: 'The control',
      does: 'Hides it on pointer leave, blur or Escape.',
    },
  ],
  inputs: [
    {
      name: 'text',
      does: 'One short line; a data point may run a few, split by a newline.',
    },
    { name: 'children', does: 'The one control it belongs to.' },
    {
      name: 'open',
      does: 'Opens it from outside: the design page, or a press that opens it.',
    },
    {
      name: 'side',
      does: 'The side it prefers; it takes another when there is no room.',
    },
    {
      name: 'onClose',
      does: 'Called when the tooltip closes itself: Escape, pointer leave, blur.',
    },
  ],
  priority: {
    first: 'The text.',
  },
  sizes: {
    gives: ['The text wraps'],
  },
  rules: {
    cite: ['sentence-case', 'contrast-floors'],
    local: [
      {
        id: 'tooltip-one-line',
        rule: 'Write a tooltip as one short line, or a few for one data point; put anything the student must read on the page.',
        check:
          'Read every tooltip: one short line, or a few lines about one data point.',
        scope: 'tooltip',
      },
    ],
  },
  log: 'web/src/units/tooltip/log.md',
  decisions: [
    {
      id: 'tooltip-d1',
      decision:
        'A tooltip sits below its control, centred, and moves to another side or shifts when there is no room, never leaving the viewport.',
      why: "As Primer's tooltip does.",
      beat: 'A line under the control that can be clipped or overlap',
      date: '2026-10-13',
    },
    {
      id: 'tooltip-d2',
      decision: 'It is at most 250 wide and its text wraps.',
      why: "Primer's limit.",
      beat: 'One unbroken line',
      date: '2026-10-13',
    },
    {
      id: 'tooltip-d3',
      decision:
        'A tooltip closes when its control is covered or leaves the window.',
      why: 'It floats above everything, so it must not outlive what it points at.',
      beat: 'Staying open over a top bar',
      date: '2026-10-13',
    },
    {
      id: 'tooltip-d4',
      decision:
        "The tooltip is our own code: placed once in page coordinates in the browser's top layer, with no positioning library.",
      why: 'No lag while scrolling and no new dependency.',
      beat: '@primer/behaviors; Floating UI',
      date: '2026-10-13',
    },
    {
      id: 'tooltip-d5',
      decision:
        'A newline in the text starts a new line, so a data point such as a heatmap day can list its day, total and courses.',
      why: 'Jack, on the heatmap hover: "courses by time in them. no split" (home-info-grill D7).',
      beat: 'One line that joins them with commas',
      date: '2026-10-16',
    },
  ],
});
