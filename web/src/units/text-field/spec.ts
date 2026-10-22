import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'text-field',
  kind: 'component',
  title: 'Text field',
  group: 'Basics',
  purpose:
    'A labelled one-line input that says when the student commits it, on Enter or on leaving, with a line under it for "Saved" or why it failed and room for a button beside it.',
  states: [
    {
      id: 'empty',
      name: 'Empty',
      when: 'No value yet: the placeholder shows.',
    },
    {
      id: 'filled',
      name: 'Filled',
      when: 'A value, such as the student’s name.',
    },
    {
      id: 'inline',
      name: 'In a row',
      when: 'Renaming in place: no visible label or note, and as tall as the title it replaces.',
    },
    {
      id: 'saved',
      name: 'Saved',
      when: 'Just committed: the note under the field says so for a moment.',
      text: 'Saved',
    },
    {
      id: 'key',
      name: 'A key with a button',
      when: 'Fixed-width, hidden type, and a button at the right.',
    },
    {
      id: 'failed',
      name: 'Failed',
      when: 'The value was refused: the border and the note take the danger colour.',
      text: 'The key was refused',
    },
  ],
  stress:
    'A 120 character value in a 240px container with a button: the value scrolls inside the field and the button keeps its size.',
  actions: [],
  inputs: [
    { name: 'label', does: 'The words over the field.' },
    { name: 'value', does: 'What is typed.' },
    { name: 'onChange', does: 'Called with each edit.' },
    {
      name: 'onCommit',
      does: 'Called on Enter, or when focus leaves a field whose value changed, once.',
    },
    {
      name: 'onCancel',
      does: 'Called on Escape; the field is left without committing.',
    },
    {
      name: 'inline',
      does: 'Sits in a row’s title or a heading: no visible label or note, as tall as the text it replaces.',
    },
    {
      name: 'autoFocus',
      does: 'Focuses and selects the value when the field appears.',
    },
    { name: 'placeholder', does: 'The muted words in an empty field.' },
    { name: 'mono', does: 'Fixed-width type, for a key or a path.' },
    { name: 'secret', does: 'Hides what is typed.' },
    {
      name: 'failed',
      does: 'Draws the field and its note in the danger colour.',
    },
    {
      name: 'note',
      does: 'The line under the field; false leaves the line out.',
    },
    { name: 'action', does: 'A control at the field’s right.' },
  ],
  priority: { first: 'The field.' },
  sizes: { gives: ['The field narrows; its button keeps its size'] },
  rules: { cite: ['sentence-case', 'contrast-floors', 'colour-has-a-word'] },
  decisions: [
    {
      id: 'text-field-d1',
      decision:
        'Fields commit on Enter or on blur when the value changed, once, and show a brief note; no Save button of their own. The note line holds its height.',
      why: 'Assumed, to confirm with Jack (settings-view-grill G8): fewer buttons, and "Saved" appearing must not move the page.',
      beat: 'A Save per field',
      date: '2026-10-22',
    },
  ],
});
