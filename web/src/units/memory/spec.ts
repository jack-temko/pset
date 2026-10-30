import { defineSpec } from '@/design/spec';

const VERDICT = 'Jack, 2026-10-30';

export default defineSpec({
  id: 'memory',
  kind: 'component',
  title: 'Memory',
  group: 'Mocks',
  purpose:
    'The preferences PSet follows, of two kinds: typed by the student, and saved by Ask when they asked it to remember. Mocked on sample data.',
  exampleWidth: 1012,
  states: [
    {
      id: 'ask-saves',
      name: 'Ask saves, you keep',
      when: 'What Ask just saved sits at the top marked New with Keep and Edit; the rest follow, five of them, then Show all.',
      text: 'Ask saved 2 preferences. Keep them or change them.',
    },
    {
      id: 'show-all',
      name: 'Show all',
      when: 'Show all was pressed: every memory is listed, and the link reads Show fewer.',
      text: 'Show fewer',
    },
    {
      id: 'empty',
      name: 'Nothing remembered',
      when: 'No memories: one paragraph says what memory is, and the add field follows.',
      text: 'PSet remembers how you like things explained',
    },
    {
      id: 'editing',
      name: 'Editing a row',
      when: 'A row’s text becomes a field in the same place, as tall as the wrapped text and growing; Enter saves, Shift+Enter adds a line.',
      text: 'Save',
    },
    {
      id: 'deleted',
      name: 'Deleted, with Undo',
      when: 'A row is gone at once, no question asked, and a line under the list offers Undo.',
      text: 'Deleted “Round to three significant figures”',
    },
  ],
  stress:
    'A 190 character memory among eleven: it wraps onto three lines, and its field grows with it.',
  actions: [
    {
      id: 'add',
      label: 'Add',
      does: 'Adds what is typed as a memory of yours, on Enter or the button.',
    },
    {
      id: 'edit',
      label: 'Edit',
      does: 'Turns the row’s text into a growing field; Enter or Save keeps the change, Shift+Enter adds a line, Escape or Cancel drops it.',
    },
    {
      id: 'delete',
      label: 'Delete',
      does: 'Removes the memory at once and offers Undo, with no question first.',
    },
    {
      id: 'undo',
      label: 'Undo',
      does: 'Puts the deleted memory back where it was.',
    },
    {
      id: 'show-all',
      label: 'Show all',
      does: 'Lists every memory past the first five; the link then reads Show fewer.',
    },
    {
      id: 'keep',
      label: 'Keep',
      does: 'Accepts what Ask saved, and the New mark goes.',
    },
  ],
  data: [
    {
      reads:
        'The memories: text, source (You or Ask), date, the chat a saved one came from',
      call: 'sample',
    },
  ],
  inputs: [
    { name: 'empty', does: 'Starts with nothing remembered.' },
    {
      name: 'showAll',
      does: 'Starts with every memory shown, not the first five.',
    },
    { name: 'editing', does: 'The id of the memory that starts being edited.' },
    {
      name: 'deleted',
      does: 'The id of the memory that starts deleted, with Undo showing.',
    },
  ],
  priority: {
    first: 'The add field, then the list.',
    main: 'add',
  },
  sizes: {
    gives: ['Long text wraps, so a row grows'],
  },
  rules: {
    cite: ['student-decides', 'sentence-case', 'colour-has-a-word'],
  },
  log: 'web/src/units/memory/log.md',
  decisions: [
    {
      id: 'memory-d1',
      decision:
        'Memory is one list where what Ask saved arrives marked New with Keep and Edit, above the rest, until the student keeps it.',
      why: `${VERDICT}: "lets go with D". The model never silently steers: a save from Ask waits for a look.`,
      beat: 'One plain list; two lists; chips',
      date: '2026-10-30',
    },
    {
      id: 'memory-d2',
      decision: 'Delete asks nothing and offers Undo.',
      why: 'A lost preference costs one sentence to type again (ideas/memory-preferences-only.md).',
      beat: 'A confirm on every delete',
      date: '2026-10-30',
    },
    {
      id: 'memory-d3',
      decision:
        'There is no search. The list shows the five newest kept memories, and New ones always, then "Show all" in the heading, as Home’s lists do.',
      why: `${VERDICT}: "drop the search bar. Make it hide past a certain amount with a button to expand like our other lists."`,
      beat: 'A search field; showing every memory',
      date: '2026-10-30',
    },
    {
      id: 'memory-d4',
      decision:
        'A memory shows its full text, wrapped. Edit and Add are multi-line fields that grow with the text, in the same type and place as the text.',
      why: 'Jack, 2026-10-30: "make these memories be multi line editable, editing a saved memory that wraps opens a super smalle inline textblock that sucks to edit".',
      beat: 'A one-line title that truncates; a one-line input',
      date: '2026-10-30',
    },
  ],
});
