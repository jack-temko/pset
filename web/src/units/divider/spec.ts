import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'divider',
  kind: 'component',
  title: 'Divider',
  group: 'Navigation',
  purpose:
    'The 1px hairline between two sides. It turns the accent while hovered or dragged, and a double click puts the split back to half and half.',
  states: [
    {
      id: 'rest',
      name: 'At rest',
      when: 'A 1px muted hairline between the sides.',
    },
    {
      id: 'hover',
      name: 'Hovered',
      when: 'The pointer is over its 9px grip area: the line turns the accent.',
    },
    {
      id: 'drag',
      name: 'Dragged',
      when: 'It is being dragged: the line stays the accent until the pointer is released.',
    },
  ],
  stress:
    'In a 480px tall, 120px wide container with nothing around it: the line is still 1px and its grip area is still 9px wide.',
  actions: [
    {
      id: 'drag',
      label: 'Dragging the line',
      does: 'Reports the pointer’s x; the parent sets the split and stops each side at 360px.',
    },
    {
      id: 'reset',
      label: 'Double click',
      does: 'Resets to half and half.',
    },
  ],
  inputs: [
    {
      name: 'onMove',
      type: '(clientX: number) => void',
      default: 'none',
      does: 'Called with the pointer’s x in window coordinates while dragging.',
    },
    {
      name: 'onReset',
      type: '() => void',
      default: 'none',
      does: 'Called on a double click.',
    },
  ],
  priority: {
    first: 'The line itself, quiet until it is wanted.',
    main: 'drag',
  },
  sizes: {
    narrowest: 9,
    gives: ['It is always 1px wide; only the grip area could shrink'],
  },
  rules: { cite: ['material-is-main', 'contrast-floors'] },
  log: 'web/src/units/divider/log.md',
  decisions: [
    {
      id: 'divider-d1',
      decision:
        'A 1px hairline that turns accent while hovered or dragged; double-click resets half and half; no visible grip.',
      why: 'Jack’s pick, W15.',
      beat: 'A visible grip',
      date: '2026-10-21',
    },
    {
      id: 'divider-d2',
      decision:
        'A side is never narrower than 360px: the parent stops the drag there.',
      why: 'Assumed in workspace-grill.',
      beat: 'No minimum',
      date: '2026-10-21',
    },
  ],
});
