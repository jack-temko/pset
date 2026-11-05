import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'segmented-control',
  kind: 'component',
  title: 'Segmented control',
  group: 'Basics',
  purpose:
    'One choice out of two to four short options, all in view in a row, applied the moment one is pressed. The chosen one is filled.',
  states: [
    {
      id: 'first',
      name: 'First chosen',
      when: 'The first option is the value.',
    },
    {
      id: 'middle',
      name: 'Middle chosen',
      when: 'Another option is the value; the fill moves with it.',
    },
  ],
  stress:
    'Four options with 24 character labels in a 320px container: the control keeps its row and overflows the container rather than wrapping.',
  actions: [],
  inputs: [
    { name: 'label', does: 'The control’s name.' },
    { name: 'options', does: 'The segments: an id and a label each.' },
    { name: 'value', does: 'The id of the chosen segment.' },
    { name: 'onChange', does: 'Called with the id pressed.' },
  ],
  priority: { first: 'The chosen segment.' },
  sizes: { gives: ['The segments keep a 64px floor; the row does not wrap'] },
  rules: { cite: ['sentence-case', 'contrast-floors'] },
  decisions: [
    {
      id: 'segmented-control-d1',
      decision:
        'A segmented control has no Apply: choosing is applying. The chosen segment is filled with the pressed ground.',
      why: 'Confirmed by Jack: "Three-part switch (Recommended)" (settings-view-grill G6): Paper, Night and System as one row, applied at once.',
      beat: 'A toggle; a dropdown',
      date: '2026-10-22',
    },
  ],
});
