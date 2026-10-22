import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'tabs',
  kind: 'component',
  title: 'Tabs',
  group: 'Navigation',
  purpose:
    'A side’s row of GitHub underline tabs: text, an accent line under the open one, a close x on every tab, a + that opens things, and drag to reorder or move to the other side.',
  states: [
    {
      id: 'rest',
      name: 'Three tabs',
      when: 'A set, a material with its page and Ask; the first is open, with its accent underline and a full-colour close x; the others’ x is dim.',
    },
    {
      id: 'hover',
      name: 'A tab hovered',
      when: 'The pointer is over a closed tab: its close x goes from dim to full muted and the text darkens.',
    },
    {
      id: 'add-menu',
      name: 'The + menu open',
      when: 'The + was pressed: Materials, Sets and Ask, under the row.',
    },
    {
      id: 'tab-menu',
      name: 'A tab’s menu open',
      when: 'A right click on a tab: Move to other side, Swap sides, Close, Close others.',
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
      label: 'A right click on a tab',
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
      name: 'add',
      type: 'MenuGroup[]',
      default: 'none',
      does: 'What the + menu offers, and anything after the +.',
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
      id: 'tabs-d-plus',
      decision:
        'The + at the end of a tab row is the close x’s size: a 20 by 20 hit area and a 14 icon.',
      why: 'Jack, 2026-10-21: "For the workspace the plus button size should be the same size as the close button on the tabs".',
      beat: 'A 32 square + beside 20 square close buttons',
      date: '2026-10-21',
    },
    {
      id: 'tabs-d1',
      decision:
        'Each side’s tabs are GitHub underline tabs: text, an accent underline on the open one, a close x always shown, a + at the end.',
      why: 'Jack’s pick, W2 (workspace-grill): matches the GitHub look. Reaffirms S6.',
      beat: 'Boxed editor tabs; a picker instead of tabs',
      date: '2026-10-21',
    },
    {
      id: 'tabs-d2',
      decision:
        'A material’s tab reads its name, then its page dim, a space between and no dot: "Griffiths p. 112". A tab has a label and an optional note.',
      why: 'Jack: "Make the page number on material dim, no dot separator." (W11 refined; the pick was name and page.)',
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
      id: 'tabs-d5',
      decision:
        'Each tab has one icon, its close x, always shown: dim when inactive, muted on hover, text colour when open. The tab menu opens on right click.',
      why: 'Jack: "leaves a weird gap. How does vscode do it? Either make them always show dimly or something" (W17; the full words are in the log).',
      beat: 'Icons that appear on hover; a reserved empty slot as in VS Code',
      date: '2026-10-21',
    },
    {
      id: 'tabs-d6',
      decision:
        'Dragging near either end of a long row scrolls it, as in VS Code. A press that moves only a few px is a click, not a drag.',
      why: 'Jack, W19: "I want it to be similar to [VS Code]. Hit the edge cases please."',
      beat: 'No scrolling while dragging',
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
