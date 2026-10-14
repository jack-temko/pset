import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'tag',
  kind: 'component',
  title: 'Tag',
  group: 'Basics',
  purpose:
    'Names a fact about a thing in one or two words. One shape, three tones, an optional glyph, never clickable.',
  states: [
    {
      id: 'neutral',
      name: 'Neutral',
      when: 'A plain fact, such as "Generated".',
    },
    {
      id: 'attention',
      name: 'Attention with a glyph',
      when: 'Something needs attention soon, such as "Due Fri".',
    },
    {
      id: 'danger',
      name: 'Danger with a glyph',
      when: 'Work is late, such as "Overdue".',
    },
    {
      id: 'attention-plain',
      name: 'Attention without a glyph',
      when: 'The word alone carries the meaning.',
    },
  ],
  stress: 'A 40 character tag in a 120px container, which truncates.',
  actions: [],
  inputs: [
    {
      name: 'tone',
      type: "'neutral' | 'attention' | 'danger'",
      default: 'neutral',
      does: 'Which ground and text colour.',
    },
    {
      name: 'icon',
      type: 'LucideIcon',
      default: 'none',
      does: 'One glyph before the word.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      default: 'none',
      does: 'The word or two.',
    },
  ],
  priority: {
    first: 'Its word, small beside the thing it names.',
  },
  sizes: {
    narrowest: 40,
    gives: ['The text truncates with an ellipsis'],
  },
  rules: {
    cite: ['colour-has-a-word', 'contrast-floors', 'sentence-case'],
    local: [
      {
        id: 'tag-short',
        rule: 'Write a tag as one or two words.',
        check: 'Read every tag on the page: none is a phrase.',
        scope: 'tag',
      },
    ],
  },
  log: 'web/src/units/tag/log.md',
  decisions: [
    {
      id: 'tag-d1',
      decision:
        'One shape: a soft ground with its text, an optional glyph before the word, never clickable.',
      why: 'A tag is always recognisable as a tag.',
      beat: 'Outlined and soft shapes; neutral only',
      date: '2026-10-13',
    },
    {
      id: 'tag-d2',
      decision:
        'Two tones to start: neutral and attention. More are added when a screen needs them.',
      why: 'Jack: "the tones got out of hand, lets start small".',
      beat: 'Five tones',
      date: '2026-10-13',
    },
    {
      id: 'tag-d3',
      decision: 'A third tone, danger, for overdue work.',
      why: 'Jack: overdue must not look like a day this week.',
      beat: 'Amber for overdue',
      date: '2026-10-14',
    },
  ],
});
