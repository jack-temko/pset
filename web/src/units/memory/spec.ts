import { defineSpec } from '@/design/spec';

const MOCK = 'Mock for Jack to judge; not decided';

export default defineSpec({
  id: 'memory',
  kind: 'component',
  title: 'Memory',
  group: 'Mocks',
  purpose:
    'The preferences PSet follows, of two kinds: typed by the student, and saved by Ask when they asked it to remember. Four layouts to choose from, on sample data.',
  exampleWidth: 1012,
  states: [
    {
      id: 'a-one-list',
      name: 'A: one list, filter',
      when: 'One list under a search field, an add field and an All, Yours, From Ask filter; each row names its source.',
      text: 'Use V_0, V_1 for nodal voltages',
    },
    {
      id: 'b-two-lists',
      name: 'B: two lists',
      when: 'Yours, with its add field at the foot, and Saved from Ask, under one search that filters both.',
      text: 'Saved from Ask',
    },
    {
      id: 'c-chips',
      name: 'C: compact chips',
      when: 'Wrapping chips grouped by kind: click one to edit it in place, x deletes, a dashed chip adds.',
      text: '+ Add',
    },
    {
      id: 'd-review',
      name: 'D: Ask saves, you keep',
      when: 'Like A, but what Ask just saved is marked New with Keep and Edit until the student keeps it.',
      text: 'Ask saved 2 preferences. Keep them or change them.',
    },
    {
      id: 'empty',
      name: 'Nothing remembered',
      when: 'No memories: one paragraph says what memory is, and the add field follows.',
      text: 'PSet remembers how you like things explained',
    },
    {
      id: 'no-results',
      name: 'Search finds nothing',
      when: 'The search matches no memory: the list says so, and the filter and add field stay.',
      text: 'No memory matches “pspice2”',
    },
    {
      id: 'editing',
      name: 'Editing a row (A)',
      when: 'A row’s text is a field of the same height, with Save and Cancel at its right.',
      text: 'Save',
    },
    {
      id: 'deleted',
      name: 'Deleted, with Undo (A)',
      when: 'A row is gone at once, no question asked, and a line under the list offers Undo.',
      text: 'Deleted “Round to three significant figures”',
    },
  ],
  stress:
    'A 190 character memory and a 60 character one: the title truncates on one line and its full text is on hover.',
  actions: [
    {
      id: 'add',
      label: 'Add',
      does: 'Adds what is typed as a memory of yours, on Enter or the button.',
    },
    {
      id: 'edit',
      label: 'Edit',
      does: 'Turns the row’s text into a field; Enter or Save keeps the change, Escape or Cancel drops it.',
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
      id: 'keep',
      label: 'Keep',
      does: 'Option D: accepts what Ask saved, and the New mark goes.',
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
    { name: 'option', does: 'Which layout is drawn: A, B, C or D.' },
    { name: 'empty', does: 'Starts with nothing remembered.' },
    { name: 'query', does: 'What the search starts with.' },
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
    gives: ['A memory’s text truncates', 'Chips wrap to the next line'],
  },
  rules: {
    cite: ['student-decides', 'sentence-case', 'colour-has-a-word'],
  },
  decisions: [
    {
      id: 'memory-d1',
      decision:
        'Four layouts are drawn as states so Jack can pick: one list with a filter, two lists, chips, and one where Ask’s saves need a Keep.',
      why: `${MOCK}: Jack asked for easy add, search, delete and edit, and two kinds of memory.`,
      beat: 'The fold of plain lines at the foot of the Course view',
      date: '2026-10-30',
    },
    {
      id: 'memory-d2',
      decision: 'Delete asks nothing and offers Undo.',
      why: `${MOCK}: a lost preference costs one sentence to type again (ideas/memory-preferences-only.md).`,
      beat: 'A confirm on every delete',
      date: '2026-10-30',
    },
  ],
});
