import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'fold',
  kind: 'component',
  title: 'Fold',
  group: 'Basics',
  purpose:
    'A quiet line with a chevron that unfolds what is under it, for the part most visits do not need: finished sets, the checks, the kept errors.',
  states: [
    {
      id: 'closed',
      name: 'Closed',
      when: 'The line alone, its label saying what is inside, with a count where it helps.',
      text: 'Done (6)',
    },
    {
      id: 'open',
      name: 'Open',
      when: 'The content sits under the line, which keeps its place.',
    },
  ],
  stress:
    'A 90 character label in a 240px container: the label truncates; the chevron stays.',
  actions: [],
  inputs: [
    { name: 'label', does: 'The line: what is inside, and how many.' },
    { name: 'defaultOpen', does: 'Opens it at first.' },
    { name: 'children', does: 'What unfolds.' },
  ],
  priority: { first: 'The label.' },
  sizes: { gives: ['The label truncates'] },
  rules: { cite: ['sentence-case', 'contrast-floors'] },
  decisions: [
    {
      id: 'fold-d1',
      decision:
        'A fold is a muted line with a chevron, 32 high, that opens in place and pushes what is below down.',
      why: 'Assumed, to confirm with Jack: the course view and Settings fold what most visits skip (C3, C9, G3, G4, G11).',
      beat: 'A "Show" link; a separate page',
      date: '2026-10-22',
    },
  ],
});
