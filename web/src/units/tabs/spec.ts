import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'tabs',
  kind: 'component',
  title: 'Tabs',
  group: 'Navigation',
  purpose:
    'A side’s row of GitHub underline tabs: text, an accent line under the open one, a close x, a + that opens things, and drag to reorder or move to the other side.',
  states: [
    {
      id: 'rest',
      name: 'Three tabs',
      when: 'A set, a material with its page and Ask; the first is open, with its accent underline, chevron and close x.',
    },
    {
      id: 'hover',
      name: 'A tab hovered',
      when: 'The pointer is over a closed tab: its chevron and close x appear and the text darkens.',
    },
    {
      id: 'add-menu',
      name: 'The + menu open',
      when: 'The + was pressed: Materials, Sets and Ask, under the row.',
    },
    {
      id: 'tab-menu',
      name: 'A tab’s menu open',
      when: 'A tab’s chevron or a right click: Move to other side, Swap sides, Close, Close others.',
    },
    {
      id: 'overflow',
      name: 'Too many tabs',
      when: 'Twelve tabs: they shrink to 112px, then the row scrolls sideways with a fade at each edge that has more.',
    },
    {
      id: 'dropping',
      name: 'A tab dragged over',
      when: 'A tab is dragged over the row: an accent bar shows where it would land.',
    },
  ],
  stress:
    'Twelve tabs with 70 character labels in a 480px row: each truncates, the row scrolls, the + stays at the right and the open tab is kept in view.',
  actions: [
    {
      id: 'open-tab',
      label: 'A tab',
      key: 'Enter',
      does: 'Opens it; the accent underline moves to it.',
    },
    {
      id: 'close-tab',
      label: 'The x on a tab',
      does: 'Closes it; the next tab opens, or the one before.',
    },
    {
      id: 'add',
      label: '+',
      key: 'Enter',
      does: 'Opens the menu of everything the course has; a pick opens it as a tab here.',
    },
    {
      id: 'tab-menu',
      label: 'The chevron, or a right click',
      does: 'Opens the tab’s menu: Move to other side, Swap sides, Close, Close others.',
    },
    {
      id: 'drag',
      label: 'Dragging a tab',
      does: 'Reorders it in this row, or moves it to the other side when dropped there.',
    },
  ],
  inputs: [
    {
      name: 'tabs, open',
      type: '{ id, label }[], string | null',
      default: 'none',
      does: 'The tabs in order and the id of the open one.',
    },
    {
      name: 'add, end',
      type: 'MenuGroup[], ReactNode',
      default: 'none',
      does: 'What the + menu offers, and anything after the + (such as Open beside).',
    },
    {
      name: 'onOpen, onClose, onAdd, onAction, onDropTab',
      type: 'callbacks',
      default: 'none',
      does: 'The row holds no state of its own: every change goes to the caller.',
    },
  ],
  priority: { first: 'The open tab.', main: 'open-tab' },
  sizes: {
    narrowest: 360,
    gives: [
      'Tabs shrink from their text’s width to 112px',
      'Then the row scrolls sideways with a fade at the edge',
      'The + and what follows it never move',
    ],
  },
  rules: {
    cite: ['links-go-buttons-do', 'sentence-case', 'contrast-floors'],
  },
  log: 'web/src/units/tabs/log.md',
  components: [{ unit: 'menu', use: 'The + menu and each tab’s menu.' }],
  decisions: [
    {
      id: 'tabs-d1',
      decision:
        'Each side’s tabs are GitHub underline tabs: text, an accent underline on the open one, a close x on hover, a + at the end.',
      why: 'Jack’s pick, W2 (workspace-grill): matches the GitHub look. Reaffirms S6.',
      beat: 'Boxed editor tabs; a picker instead of tabs',
      date: '2026-10-21',
    },
    {
      id: 'tabs-d2',
      decision:
        'A material’s tab reads its name and page, "Griffiths · p. 112"; the caller writes the label.',
      why: 'Jack’s pick, W11: two tabs of one book tell themselves apart.',
      beat: 'Name only',
      date: '2026-10-21',
    },
    {
      id: 'tabs-d3',
      decision:
        'Too many tabs shrink to a minimum, then the row scrolls sideways with a fade at the edge; there is no "more" menu.',
      why: 'Jack’s pick, W13.',
      beat: 'A "more" menu',
      date: '2026-10-21',
    },
    {
      id: 'tabs-d4',
      decision:
        'A tab moves to the other side by dragging it or by "Move to other side" in its menu, which also has Swap sides, Close and Close others.',
      why: 'Jack’s pick, W7; the menu’s items are Assumed in workspace-grill.',
      beat: 'A menu only',
      date: '2026-10-21',
    },
  ],
});
