import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'section-heading',
  kind: 'component',
  title: 'Section heading',
  group: 'Basics',
  purpose:
    'Titles a list or a group on a screen, with an optional count and one action at the right, over a rule.',
  states: [
    {
      id: 'plain',
      name: 'Plain',
      when: 'A title alone.',
    },
    {
      id: 'count',
      name: 'With a count',
      when: 'The list says how many it holds.',
    },
    {
      id: 'action',
      name: 'With an action',
      when: 'The list has one place to go, such as "Show all".',
    },
    {
      id: 'both',
      name: 'With both',
      when: 'A count and an action.',
    },
  ],
  stress:
    'A 60 character title in a 240px container: the title wraps and the right side stays on the first line.',
  components: [{ unit: 'link', use: 'The "Show all" action in the examples.' }],
  actions: [],
  inputs: [
    {
      name: 'children',
      type: 'ReactNode',
      default: 'none',
      does: 'The title.',
    },
    {
      name: 'count',
      type: 'ReactNode',
      default: 'none',
      does: 'How many things follow, small and grey at the right.',
    },
    {
      name: 'action',
      type: 'ReactNode',
      default: 'none',
      does: 'A text link, such as "Show all", at the right of the count.',
    },
  ],
  priority: {
    first: 'The title, in the heading size.',
  },
  sizes: {
    narrowest: 160,
    gives: ['The title wraps; the count and the action stay on its first line'],
  },
  exampleWidth: 960,
  rules: {
    cite: ['serif-to-read', 'room-for-big-type', 'sentence-case'],
  },
  log: 'web/src/units/section-heading/log.md',
  decisions: [
    {
      id: 'section-heading-d1',
      decision:
        'The heading step on the left, a count and an action on the right in the small step, a 1px rule below, and no outer margin.',
      why: "Settled afterwards, not asked (the builder's): the parent decides the room around big type, so every list is the same.",
      beat: 'A heading with its own margins',
      date: '2026-10-13',
    },
  ],
});
