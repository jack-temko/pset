import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'section-heading',
  kind: 'component',
  title: 'Section heading',
  group: 'Basics',
  purpose:
    'Titles a list or a group on a screen: the serif title, a Counter right after it and one quiet action at the right. No rule.',
  states: [
    {
      id: 'plain',
      name: 'Plain',
      when: 'A title alone.',
    },
    {
      id: 'count',
      name: 'With a count',
      when: 'The list says how many it holds, in a Counter after the title.',
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
    'A 60 character title in a 240px container: the title wraps; the Counter stays beside its first line and the action at the right.',
  actions: [],
  inputs: [
    { name: 'children', does: 'The title.' },
    {
      name: 'count',
      does: 'How many things follow, in a Counter right after the title.',
    },
    { name: 'action', does: 'A text link, such as "Show all", at the right.' },
  ],
  priority: {
    first: 'The title, in the heading size.',
  },
  sizes: {
    gives: [
      'The title wraps; the Counter and the action stay on its first line',
    ],
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
        'The heading step on the left, an action on the right, and no outer margin.',
      why: "Settled afterwards, not asked (the builder's): the parent decides the room around big type, so every list is the same.",
      beat: 'A heading with its own margins',
      date: '2026-10-13',
    },
    {
      id: 'section-heading-d2',
      decision:
        "As the old Home's SectionHeader: the count is a Counter pill right after the title, 8 apart; one quiet action at the right; at least 32 high; no rule under it.",
      why: 'Jack: "The heading is bad too. I want to be more similar to my old design."',
      beat: 'A count at the right with a 1px rule below',
      date: '2026-10-14',
    },
    {
      id: 'section-heading-d3',
      decision:
        'The title and the Counter sit centred on one line: both on the middle of the heading text.',
      why: 'Jack: "Need to be vertically aligned center".',
      beat: 'A count that read as floating off the line',
      date: '2026-10-14',
    },
    {
      id: 'section-heading-d4',
      decision:
        'The action at the right sits centred on that same line, with the title and the Counter.',
      why: 'Jack: "Make sure this is aligned too with the header and chip".',
      beat: 'An action on its own line box',
      date: '2026-10-14',
    },
  ],
});
