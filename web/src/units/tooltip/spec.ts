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
      key: 'Focus',
      does: 'Shows the tooltip on hover (after 50ms) or on keyboard focus (at once).',
    },
    {
      id: 'hide',
      label: 'The control',
      key: 'Escape',
      does: 'Hides it on pointer leave, blur or Escape.',
    },
  ],
  inputs: [
    {
      name: 'text',
      type: 'string',
      default: 'none',
      does: 'One short line.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      default: 'none',
      does: 'The one control it belongs to.',
    },
    {
      name: 'open',
      type: 'boolean',
      default: 'false',
      does: 'Opens it from outside: the design page, or a press that opens it.',
    },
    {
      name: 'side',
      type: "'below' | 'above' | 'right' | 'left'",
      default: 'below',
      does: 'The side it prefers; it takes another when there is no room.',
    },
  ],
  priority: {
    first: 'The text.',
  },
  sizes: {
    narrowest: 48,
    gives: ['The text wraps'],
  },
  rules: {
    cite: ['sentence-case', 'contrast-floors'],
    local: [
      {
        id: 'tooltip-one-line',
        rule: 'Write a tooltip as one short line; put anything the student must read on the page.',
        check: 'Read every tooltip: none is more than a short line.',
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
  ],
});
