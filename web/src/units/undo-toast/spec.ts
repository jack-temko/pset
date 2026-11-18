import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'undo-toast',
  kind: 'component',
  title: 'Undo toast',
  group: 'Basics',
  purpose:
    'What Ctrl+Z took back, said once at the bottom of the page in the server’s own words, with Redo and Show. One at a time; it leaves by itself.',
  states: [
    {
      id: 'undone',
      name: 'Undone',
      when: 'Ctrl+Z took back a rename on this page: the sentence and Redo.',
      text: 'Renamed back to Problem set 4.',
    },
    {
      id: 'show',
      name: 'Undone elsewhere',
      when: 'The undone thing is on another page: Show goes there, Redo puts it back.',
      text: 'Show',
    },
    {
      id: 'still-hidden',
      name: 'Brought back, still hidden',
      when: 'Undo brought a thing back whose parent is still removed (D6): the sentence says so.',
      text: 'Its assignment is still removed.',
    },
    {
      id: 'refused',
      name: 'Nothing to undo',
      when: 'Ctrl+Z was refused: the reason, muted, with only Close.',
      text: 'There’s nothing to undo.',
    },
  ],
  stress:
    'A 160 character sentence in a 360px container: it wraps beside the buttons, which keep their size.',
  actions: [
    {
      id: 'redo',
      label: 'Redo',
      does: 'Puts back what Ctrl+Z took back (an undo of the undo), and says that instead.',
    },
    {
      id: 'show',
      label: 'Show',
      does: 'Goes to the thing that was undone. Only when it has a page.',
    },
    {
      id: 'close',
      label: 'Close',
      does: 'Hides the toast. It also leaves after 6 s, or when the next undo replaces it.',
    },
  ],
  inputs: [
    { name: 'said', does: 'The sentence: what was undone, or why not.' },
    { name: 'refused', does: 'Ctrl+Z was refused: muted, no Redo or Show.' },
    { name: 'onRedo', does: 'Puts it back.' },
    { name: 'onShow', does: 'Goes to the thing; absent when it has no page.' },
    { name: 'onClose', does: 'Hides the toast.' },
    {
      name: 'floating',
      does: 'Fixed at the bottom centre over the page; false on the design page.',
    },
  ],
  priority: { first: 'What was undone.', main: 'redo' },
  sizes: { gives: ['The sentence wraps; the buttons keep their size'] },
  rules: {
    cite: ['say-it-once', 'sentence-case', 'colour-has-a-word'],
  },
  decisions: [
    {
      id: 'undo-toast-d1',
      decision:
        'An undo is said in a toast at the bottom centre, over the page: one at a time, gone after 6 s or when the next replaces it.',
      why: 'Jack, 2026-11-18: "toasts are fine for this, make sensible judgments and make it look good" (C7, E3 bent).',
      beat: 'A line in the top bar; saying it only where the thing is',
      date: '2026-11-18',
    },
    {
      id: 'undo-toast-d2',
      decision:
        'Redo sits in the toast, not on a key: the sentence is what was undone, and the button beside it puts it back.',
      why: 'Ctrl+Z walks back and never toggles (the store), so redo needs its own place; a key for it is the palette’s to decide.',
      beat: 'Ctrl+Shift+Z; no redo',
      date: '2026-11-18',
    },
  ],
});
