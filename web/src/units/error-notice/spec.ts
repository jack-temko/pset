import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'error-notice',
  kind: 'component',
  title: 'Error notice',
  group: 'Basics',
  purpose:
    'Every error in PSet, in one of two forms: a line with a red mark, or a quiet box that says what, why and what to do. The words come from the error catalog.',
  states: [
    {
      id: 'line',
      name: 'Line',
      when: 'An error inside a flow, such as a failed answer in Ask: the mark, the words in ink and one outlined action.',
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
      when: "A field's value was refused: the line takes the hint's place, with no action, under the field's red edge.",
      text: 'That name is taken by another course.',
    },
    {
      id: 'block',
      name: 'Block',
      when: 'A part of a screen failed: a quiet box, the red mark, what in ink, why muted, the actions (the first is primary), Details.',
      text: "Couldn't find 3.A.4",
    },
    {
      id: 'details',
      name: 'Details open',
      when: 'The Details fold opens on the catalog ids and the incident, with Copy, for a bug report.',
      text: 'incident k7q2',
    },
    {
      id: 'pane',
      name: 'A whole pane',
      when: 'The pane failed as a whole: it centres a block, which is at most 560 wide.',
      text: 'Read it again',
    },
  ],
  stress:
    'A 90 character line and a block naming a 70 character file, in 240px: both wrap, the action wraps under the words, nothing overflows.',
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
      does: 'Only the ones that can work; the first is primary. A line takes one, outlined.',
    },
    {
      name: 'startDetails',
      does: 'Opens Details at first; for the design page.',
    },
  ],
  priority: {
    first: 'What went wrong, beside the red mark.',
    main: 'act',
  },
  sizes: {
    gives: ['Lines wrap; a block fills its place up to 560px wide'],
  },
  rules: {
    cite: [
      'colour-has-a-word',
      'student-decides',
      'sentence-case',
      'one-primary',
      'quiet-when-repeated',
      'contrast-floors',
      'failure-says-what',
    ],
    local: [
      {
        id: 'error-one-look',
        rule: 'Show every error with Error notice, never a red paragraph or box of its own.',
        check:
          "Search the units for text-(--ds-danger): only Error notice's mark, Tag and danger menu items use it.",
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
      supersededBy: 'error-notice-d5',
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
    {
      id: 'error-notice-d5',
      decision:
        "A block is a quiet box like PSet's other boxes: a hairline border, the raised ground, the 6px radius. Its only red is the mark.",
      why: 'Jack: "Don\'t love the look of the two variants of errors." Bare, it floated, and its fixes ran into the problem\'s own buttons.',
      beat: 'No border (d2); a red bordered box; a soft red ground, on which muted text falls under 7:1',
      date: '2026-11-05',
    },
    {
      id: 'error-notice-d6',
      decision:
        'Red marks the error and the words stay readable: what in full ink, why and fix muted. A line is ink too, never a red sentence.',
      why: 'Red sentences shout and read worse on the dark ground; Primer, Atlassian and macOS colour the mark, not the words.',
      beat: 'What in red (d2); the whole line in red',
      date: '2026-11-05',
    },
    {
      id: 'error-notice-d7',
      decision:
        'The mark is a circle with "!", the common sign for an error, in both forms.',
      why: 'Primer, Geist and Material draw an error as a round or stop sign and keep the triangle for a warning.',
      beat: 'The warning triangle',
      date: '2026-11-05',
    },
    {
      id: 'error-notice-d8',
      decision:
        "A line's action is outlined, and wraps under the words when the line is full.",
      why: 'quiet-when-repeated: a single action keeps its outline. Quiet, it wrapped alone and read as stray text.',
      beat: 'A quiet button',
      date: '2026-11-05',
    },
    {
      id: 'error-notice-d9',
      decision:
        "Details is a Fold under a block's actions: a muted line with a chevron, not one more button.",
      why: 'Among the fixes, a quiet Details read as a fourth fix; the Fold already tucks away the checks and the kept errors.',
      beat: 'A quiet Details button in the actions row',
      date: '2026-11-05',
    },
  ],
});
