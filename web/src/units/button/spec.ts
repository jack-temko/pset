import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'button',
  kind: 'component',
  title: 'Button',
  group: 'Basics',
  purpose:
    'Does something when pressed. Four variants, one size, never disabled: it can be busy or not ready, and says so.',
  states: [
    {
      id: 'primary',
      name: 'Primary',
      when: 'The one thing the student most likely does next in a region.',
    },
    {
      id: 'default',
      name: 'Default',
      when: 'An ordinary action.',
    },
    {
      id: 'quiet',
      name: 'Quiet',
      when: 'A low-key action that sits beside material.',
    },
    {
      id: 'danger',
      name: 'Danger',
      when: 'An action that removes or cannot be undone.',
    },
    {
      id: 'icon',
      name: 'With icon',
      when: 'One icon before the label helps the student find it.',
    },
    {
      id: 'busy',
      name: 'Busy',
      when: 'Its action is running. The spinner replaces the icon, or the label if there is no icon; the size holds.',
    },
    {
      id: 'not-ready',
      name: 'Not ready',
      when: 'Cannot act yet; every variant takes the default shape. A press or focus shows why (an overflow: hidden ancestor cuts it off). Left: forced open.',
      text: 'Add a file first.',
    },
    {
      id: 'narrow',
      name: 'In 64 px',
      when: 'The container is as narrow as a button gets.',
    },
  ],
  stress: 'A 60 character label in a 160px container.',
  actions: [
    {
      id: 'press',
      label: "The button's own",
      key: 'Enter or Space',
      does: 'Runs the action the caller gave it.',
    },
    {
      id: 'press-not-ready',
      label: "The button's own",
      key: 'Enter or Space',
      does: 'Shows the reason it is not ready, under the button, and does nothing else.',
    },
  ],
  inputs: [
    {
      name: 'variant',
      type: "'primary' | 'default' | 'quiet' | 'danger'",
      default: 'default',
      does: 'Which look.',
    },
    {
      name: 'icon',
      type: 'LucideIcon',
      default: 'none',
      does: 'One icon before the label.',
    },
    {
      name: 'busy',
      type: 'boolean',
      default: 'false',
      does: 'Shows a spinner, keeps its exact size and ignores presses.',
    },
    {
      name: 'busyLabel',
      type: 'string',
      default: 'Working',
      does: 'What assistive tech hears while it is busy.',
    },
    {
      name: 'notReady',
      type: 'string',
      default: 'none',
      does: 'The reason it cannot act yet; setting it makes the button not ready.',
    },
    {
      name: 'onPress',
      type: '() => void',
      default: 'none',
      does: 'The action.',
    },
    {
      name: 'type',
      type: "'button' | 'submit'",
      default: 'button',
      does: 'The HTML type.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      default: 'none',
      does: 'The label, on one line.',
    },
    {
      name: 'reasonOpen',
      type: 'boolean',
      default: 'false',
      does: 'Shows the not-ready reason without a press or focus; for the design page only.',
    },
  ],
  priority: {
    first: 'Its label.',
    main: 'press',
  },
  sizes: {
    narrowest: 64,
    gives: ['The label truncates with an ellipsis'],
  },
  rules: {
    cite: [
      'one-primary',
      'links-go-buttons-do',
      'student-decides',
      'honest-waits',
      'colour-has-a-word',
      'contrast-floors',
      'serif-to-read',
      'sentence-case',
    ],
    local: [
      {
        id: 'button-one-line',
        rule: "Keep a button's label on one line.",
        check:
          'Set Stress on the page: the label ends in an ellipsis and never wraps.',
        scope: 'button',
      },
    ],
  },
  log: 'web/src/units/button/log.md',
  decisions: [
    {
      id: 'button-d1',
      decision: 'Four variants: primary, default, quiet, danger (solid red).',
      why: 'Jack: a destructive action looks dangerous before the click.',
      beat: 'Three variants with red text for destructive; two',
      date: '2026-10-13',
    },
    {
      id: 'button-d2',
      decision: 'One size, 32 high.',
      why: 'Every control aligns; Primer steers to its medium.',
      beat: 'Two sizes; three',
      date: '2026-10-13',
    },
    {
      id: 'button-d3',
      decision:
        'While it runs, the button keeps its exact size and a spinner replaces its icon, or its label if it has none. A second press does nothing.',
      why: "Nothing moves; as GitHub's Primer does it.",
      beat: 'The label changes; no busy state; a spinner squeezed beside the label',
      date: '2026-10-13',
    },
    {
      id: 'button-d4',
      decision:
        'Never disabled. A button that cannot act yet is "not ready": it takes focus and a press and says why.',
      why: 'Primer: disabled buttons are unreachable by keyboard; student-decides.',
      beat: 'Greyed and inert; hidden',
      date: '2026-10-13',
    },
    {
      id: 'button-d5',
      decision:
        'One optional icon before the label. An icon-only button is a separate unit, built when a screen needs one.',
      why: 'Home needs none.',
      beat: 'Text only; building the icon button now',
      date: '2026-10-13',
    },
  ],
});
