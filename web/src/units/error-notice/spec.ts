import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'error-notice',
  kind: 'component',
  title: 'Error notice',
  group: 'Basics',
  purpose:
    'Every error in PSet, in one of two forms: a red line, or a block that says what, why and what to do. The words come from the error catalog.',
  states: [
    {
      id: 'line',
      name: 'Line',
      when: 'An error inside a flow, such as a failed answer in Ask: the line and one quiet action.',
      text: 'Try again',
    },
    {
      id: 'line-fix',
      name: 'Line, fix first',
      when: 'The fix must come first: its action alone, never Try again beside it.',
      text: 'Open Settings',
    },
    {
      id: 'field',
      name: 'Under a field',
      when: "A field's value was refused: the line takes the hint's place, with no action.",
      text: 'That name is taken by another course.',
    },
    {
      id: 'block',
      name: 'Block',
      when: 'A part of a screen failed: what in red, why as muted lines, the actions (the first is primary), Details.',
      text: "Couldn't find 3.A.4",
    },
    {
      id: 'details',
      name: 'Details open',
      when: 'Details shows the catalog ids and the incident, with Copy, for a bug report.',
      text: 'incident k7q2',
    },
    {
      id: 'pane',
      name: 'A whole pane',
      when: 'The pane failed as a whole: it centres a block, which keeps its own size.',
      text: 'Read it again',
    },
  ],
  stress:
    'A 90 character line and a block naming a 70 character file, in 240px: both wrap, nothing overflows.',
  actions: [
    {
      id: 'act',
      label: "The error's own, such as Try again",
      does: 'Runs what the caller gave it.',
    },
    {
      id: 'details',
      label: 'Details',
      does: 'Opens or closes the ids and the incident.',
    },
    {
      id: 'copy',
      label: 'Copy',
      does: 'Copies what, the ids and the incident as text.',
    },
  ],
  inputs: [
    { name: 'variant', does: 'Line or block; block by default.' },
    {
      name: 'error',
      does: "The catalog's words: what, why (a line or a list), fix, chain and incident.",
    },
    {
      name: 'actions',
      does: 'Only the ones that can work; the first is primary. A line takes one.',
    },
    {
      name: 'startDetails',
      does: 'Opens Details at first; for the design page.',
    },
  ],
  priority: {
    first: 'What went wrong, in red.',
    main: 'act',
  },
  sizes: {
    gives: ['Lines wrap; a block is at most 560px wide'],
  },
  rules: {
    cite: [
      'colour-has-a-word',
      'student-decides',
      'sentence-case',
      'one-primary',
    ],
    local: [
      {
        id: 'error-one-look',
        rule: 'Show every error with Error notice, never a red paragraph or box of its own.',
        check:
          'Search the units for text-(--ds-danger): only Error notice, Tag and danger buttons use it.',
        scope: 'error-notice',
      },
    ],
  },
  log: 'web/src/units/error-notice/log.md',
  decisions: [
    {
      id: 'error-notice-d1',
      decision:
        'Two forms, the fewest that cover every case: a line (fields, flows) and a block. A failed pane centres a block.',
      why: 'Jack: "The smallest subset that covers our use cases completley".',
      beat: 'Field, line, card and pane as four variants',
      date: '2026-11-05',
    },
    {
      id: 'error-notice-d2',
      decision:
        'A block has no border or ground: a red glyph and title, why and fix muted under it.',
      why: 'Jack picked "Red icon + title, no border (Recommended)".',
      beat: 'A red bordered box; a soft red ground',
      date: '2026-11-05',
    },
    {
      id: 'error-notice-d3',
      decision:
        'Only actions that can work: when a fix must come first (no key), Try again is not offered.',
      why: 'Jack picked "Only the one that works (Recommended)".',
      beat: 'The fix first with Try again beside it',
      date: '2026-11-05',
    },
    {
      id: 'error-notice-d4',
      decision:
        'Details (the catalog ids and the incident, with Copy) is on blocks only, closed.',
      why: 'Jack picked "Card and pane only (Recommended)".',
      beat: 'Everywhere; nowhere',
      date: '2026-11-05',
    },
  ],
});
