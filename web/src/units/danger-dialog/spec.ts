import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'danger-dialog',
  kind: 'component',
  title: 'Danger dialog',
  group: 'Basics',
  purpose:
    'The last level of asking, for what is wide and cannot be put back: a dialog that counts what goes and keeps its red button locked until the student types the name.',
  states: [
    {
      id: 'course',
      name: 'Delete a course',
      when: 'Counts the sets and materials that go; the student types the course name.',
      text: 'This deletes 12 sets and 9 materials.',
    },
    {
      id: 'reset',
      name: 'Reset everything',
      when: 'Counts everything a reset takes; the student types "reset".',
      text: 'Type reset to confirm',
    },
  ],
  stress:
    'A 55 character course name in a 480px container: the title and the word to type wrap, and the buttons keep their size.',
  actions: [
    {
      id: 'confirm',
      label: 'Delete course',
      does: 'Does it. Not ready, with the reason "Type <word> first.", until the typed word matches exactly.',
    },
    {
      id: 'cancel',
      label: 'Cancel',
      does: 'Closes the dialog and changes nothing. Escape and a press on the backdrop do the same.',
    },
  ],
  inputs: [
    { name: 'title', does: 'What is being done: "Delete ECE 210".' },
    { name: 'message', does: 'What goes, with counts.' },
    {
      name: 'word',
      does: 'What the student types to unlock the button: the course name, or "reset".',
    },
    { name: 'confirmLabel', does: 'The red button’s words.' },
    {
      name: 'onConfirm',
      does: 'Called when the unlocked red button is pressed.',
    },
    {
      name: 'onCancel',
      does: 'Called on Cancel, Escape or a press on the backdrop.',
    },
    {
      name: 'inline',
      does: 'Sits in the flow, not the top layer (the design page only).',
    },
  ],
  priority: { first: 'What goes.', main: 'cancel' },
  sizes: {
    gives: [
      'The text wraps',
      'The dialog is 480 wide, less on a narrow window',
    ],
  },
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
      id: 'danger-dialog-d1',
      decision:
        'Irreversible, wide actions (delete a course, reset everything) open a dialog that counts what goes; the red button waits for the typed name or "reset".',
      why: 'Confirmed by Jack: "Three levels (Recommended)" (settings-view-grill G9), after asking how GitHub does it; the third level.',
      beat: 'The small confirm for everything; always typing',
      date: '2026-10-30',
    },
    {
      id: 'danger-dialog-d2',
      decision:
        'The red button is not ready, never disabled, with the reason in a tooltip: "Type ECE 210 first."',
      why: 'Builder’s call: the Button never disables (button-d4), so it says why it cannot act.',
      beat: 'A disabled button with no reason',
      date: '2026-10-30',
    },
  ],
});
