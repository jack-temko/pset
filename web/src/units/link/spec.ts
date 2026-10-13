import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'link',
  kind: 'component',
  title: 'Text link',
  group: 'Basics',
  purpose:
    'Goes somewhere. Underlined inside a sentence; plain when it stands alone, underlined on hover and focus.',
  states: [
    {
      id: 'standalone',
      name: 'Standalone',
      when: 'The link stands on its own line, as a destination.',
    },
    {
      id: 'inline-serif',
      name: 'Inline in a serif sentence',
      when: 'The link sits in text the student reads.',
    },
    {
      id: 'inline-sans',
      name: 'Inline in a sans line',
      when: 'The link sits in a line of the interface.',
    },
    {
      id: 'hover',
      name: 'Hover',
      when: 'The pointer is over a standalone link (forced on the page).',
    },
    {
      id: 'focus',
      name: 'Focus',
      when: 'A standalone link has keyboard focus (forced on the page).',
    },
  ],
  stress: 'A 90 character link in a 200px container, which wraps like text.',
  actions: [
    {
      id: 'follow',
      label: 'The link text',
      key: 'Enter',
      does: 'Goes to the place it names; the caller decides where.',
    },
  ],
  inputs: [
    {
      name: 'href',
      type: 'string',
      default: 'none',
      does: 'Where it goes.',
    },
    {
      name: 'inline',
      type: 'boolean',
      default: 'false',
      does: 'Underlined, and takes the size and face of the text around it.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      default: 'none',
      does: 'The link text.',
    },
    {
      name: 'onClick, ref and the other anchor props',
      type: 'anchor props',
      default: 'none',
      does: 'Pass through to the anchor, so a router-aware screen can intercept navigation.',
    },
    {
      name: 'forceState',
      type: "'hover' | 'focus'",
      default: 'none',
      does: 'Draws the hover or focus look without either; for the design page only.',
    },
  ],
  priority: {
    first: 'Its text, in the accent colour.',
    main: 'follow',
  },
  sizes: {
    narrowest: 80,
    gives: ['The text wraps like the text around it'],
  },
  rules: {
    cite: [
      'links-go-buttons-do',
      'colour-has-a-word',
      'contrast-floors',
      'figures-follow-text',
    ],
  },
  log: 'web/src/units/link/log.md',
  decisions: [
    {
      id: 'link-d1',
      decision:
        'Underlined inside text; plain when standing alone, underlined on hover and focus.',
      why: "Colour is never the only signal; Primer's rule.",
      beat: 'Always underlined; hover only',
      date: '2026-10-13',
    },
    {
      id: 'link-d2',
      decision: 'A link goes somewhere; a button does something.',
      why: 'So the two never blur.',
      beat: 'Low-priority actions as links',
      date: '2026-10-13',
    },
  ],
});
