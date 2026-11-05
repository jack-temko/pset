import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'icon-button',
  kind: 'component',
  title: 'Icon button',
  group: 'Basics',
  purpose:
    'A square button that is only its icon, for an action so familiar the icon says it: Send, Stop, Copy. Its name shows on hover.',
  states: [
    {
      id: 'quiet',
      name: 'Quiet',
      when: 'The usual look: an action repeated on every row or answer.',
    },
    {
      id: 'primary',
      name: 'Primary',
      when: 'The one main action of its place, such as Send.',
    },
    {
      id: 'default',
      name: 'Default',
      when: 'An action that needs its edge but is not the main one, such as Stop.',
    },
    {
      id: 'named',
      name: 'Named on hover',
      when: 'Hover or focus shows its name in a tooltip. Here: forced open.',
      text: 'Copy',
    },
    {
      id: 'busy',
      name: 'Busy',
      when: 'Its action is running: a spinner in place of the icon, the same size.',
    },
    {
      id: 'not-ready',
      name: 'Not ready',
      when: 'Cannot act yet: the default shape, and the tooltip says why instead of its name.',
      text: 'Write a message first',
    },
  ],
  stress: 'Three in a 96px container: they keep their size and never shrink.',
  actions: [
    {
      id: 'press',
      label: 'The icon',
      does: 'Runs the action the caller gave it.',
    },
    {
      id: 'press-not-ready',
      label: 'The icon',
      does: 'Opens the reason in a tooltip and does nothing else.',
    },
  ],
  inputs: [
    { name: 'icon', does: 'The one icon.' },
    {
      name: 'label',
      does: 'Its name: the tooltip, and what assistive tech hears.',
    },
    { name: 'variant', does: 'Which look, as Button; quiet by default.' },
    {
      name: 'busy',
      does: 'A spinner in place of the icon; presses are ignored.',
    },
    {
      name: 'notReady',
      does: 'The reason it cannot act yet; its tooltip says it.',
    },
    {
      name: 'reasonOpen',
      does: 'Forces the tooltip open; for the design page only.',
    },
    { name: 'onPress', does: 'The action.' },
  ],
  priority: {
    first: 'Its icon.',
    main: 'press',
  },
  sizes: {
    gives: ['Nothing: it is always the size of a control, square'],
  },
  rules: {
    cite: [
      'quiet-when-repeated',
      'student-decides',
      'honest-waits',
      'sentence-case',
    ],
    local: [
      {
        id: 'icon-button-familiar',
        rule: 'Use an icon button only where the icon alone is unmistakable; otherwise a Button with a label.',
        check:
          'Cover the tooltips: every icon button on the page still reads as its action.',
        scope: 'icon-button',
      },
    ],
  },
  log: 'web/src/units/icon-button/log.md',
  decisions: [
    {
      id: 'icon-button-d1',
      decision:
        "Its own unit beside Button, as button-d5 planned: square, the icon only, its name in a tooltip, Button's looks and not-ready.",
      why: 'Jack, on Ask: "Can we make the stop/send icons?" and "Can we make this just an icon too?" (Copy).',
      beat: 'An icon-only prop on Button',
      date: '2026-11-05',
    },
  ],
});
