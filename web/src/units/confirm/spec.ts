import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'confirm',
  kind: 'component',
  title: 'Confirm',
  group: 'Basics',
  purpose:
    'A question before something is taken away: what goes with counts, then a danger button and Cancel. The middle level of asking; it floats under its button.',
  states: [
    {
      id: 'history',
      name: 'Clear study history',
      when: 'Counts the hours and answers that go.',
      text: 'This deletes 86 h of study time and 1,032 answers.',
    },
    {
      id: 'errors',
      name: 'Clear kept errors',
      when: 'Counts the errors Settings has kept.',
      text: 'This clears 3 kept errors.',
    },
  ],
  stress:
    'A 160 character message in a 360px container: the message wraps over the buttons.',
  actions: [
    {
      id: 'confirm',
      label: 'Clear study history',
      does: 'Does the thing, and the confirm closes.',
    },
    {
      id: 'cancel',
      label: 'Cancel',
      does: 'Closes the confirm and changes nothing.',
    },
  ],
  inputs: [
    { name: 'message', does: 'What goes, with counts.' },
    { name: 'confirmLabel', does: 'The danger button’s words.' },
    { name: 'onConfirm', does: 'Called when the danger button is pressed.' },
    {
      name: 'onCancel',
      does: 'Called on Cancel, Escape or a press outside it.',
    },
    {
      name: 'anchor',
      does: 'The element that began it: the question floats under it. None puts it in the flow (the design page).',
    },
  ],
  priority: { first: 'What goes.', main: 'cancel' },
  sizes: { gives: ['The message wraps'] },
  rules: {
    cite: [
      'friction-matches-loss',
      'student-decides',
      'colour-has-a-word',
      'sentence-case',
    ],
  },
  decisions: [
    {
      id: 'confirm-d1',
      supersededBy: 'confirm-d2',
      decision:
        'A destructive action asks in place, not in a modal: the line swaps for the question, with counts, a danger button and Cancel.',
      why: 'Assumed, to confirm with Jack (course-view-grill C7, settings-view-grill G9): both views confirm with counts of what goes.',
      beat: 'A modal; an Undo only',
      date: '2026-10-22',
    },
    {
      id: 'confirm-d2',
      decision:
        'The question is a popover anchored under the button that began it, not a block in the page: nothing is pushed down.',
      why: 'Review of the Course and Settings builds: an in-place block moved the content below it. Assumed, to confirm with Jack.',
      beat: 'A block that replaces the button or opens above the lists',
      date: '2026-10-22',
    },
    {
      id: 'confirm-d3',
      decision:
        'The confirm is the second level: it clears one kind of data (study history, kept errors). A course or everything opens the danger dialog and asks for a name.',
      why: 'Confirmed by Jack: "Three levels (Recommended)" (settings-view-grill G9).',
      beat: 'One confirm for every destructive action',
      date: '2026-10-30',
    },
  ],
});
