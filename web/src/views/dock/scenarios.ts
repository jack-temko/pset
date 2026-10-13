import type { Scenario } from '@/views/mock/scenario';
import type { DockProps } from './stage';
import {
  EXAM,
  MANY_THINGS,
  SET_4,
  SLIDES_7,
  SLIDES_8,
  TEXTBOOK,
} from './sample';

function state(
  id: string,
  title: string,
  note: string,
  props: DockProps,
): Scenario {
  return {
    id,
    title,
    note,
    start: () => ({ routes: [], props: { ...props } }),
  };
}

/** One scenario per state of the dock's grill (States table). */
export const SCENARIOS: Scenario[] = [
  state(
    'just-opened',
    'Just opened',
    'Problem set 4 was opened from the overview: it is on the right, and the left pane is empty with the list to open from.',
    { right: SET_4.id },
  ),
  state(
    'one-tab',
    'One tab',
    'The textbook is the one tab on the left, under a strip of one tab and the +.',
    { right: SET_4.id, tabs: [{ id: TEXTBOOK.id }] },
  ),
  state(
    'several-tabs',
    'Several tabs',
    'Three tabs on the left. Scroll one, switch to another and back: it keeps its place.',
    {
      right: SET_4.id,
      tabs: [
        { id: TEXTBOOK.id, page: 6 },
        { id: SLIDES_7.id },
        { id: EXAM.id },
      ],
      shown: TEXTBOOK.id,
    },
  ),
  state(
    'many-tabs',
    'Many tabs',
    'A course with more than the strip holds: twelve tabs open, titles cut short with a tooltip, the strip scrolling sideways. The + stays at the end.',
    {
      right: SET_4.id,
      things: MANY_THINGS,
      tabs: MANY_THINGS.filter((t) => t.id !== SET_4.id)
        .slice(0, 12)
        .map((t) => ({ id: t.id })),
    },
  ),
  state(
    'last-tab-closed',
    'Last tab closed',
    'One tab is open. Close it and the left pane goes back to empty.',
    { right: SET_4.id, tabs: [{ id: SLIDES_7.id }] },
  ),
  state(
    'already-open',
    'Already open',
    'Lecture 7 is open on the left. Pick it again from the +: its tab is shown, nothing is opened twice. Problem set 4 is not offered: it is on the right.',
    {
      right: SET_4.id,
      tabs: [{ id: SLIDES_7.id }, { id: SLIDES_8.id }],
      shown: SLIDES_8.id,
    },
  ),
  state(
    'link-followed',
    'A link followed',
    'Click "Textbook, page 3" on a problem: the textbook opens on the left at that page. Click the same link again, or "Lecture 7, page 5": the tab is shown at the page.',
    { right: SET_4.id },
  ),
  state(
    'at-a-limit',
    'At a limit',
    'The seam is dragged as far as it goes. A pane stops at 360px and the seam does not move further.',
    { right: SET_4.id, tabs: [{ id: TEXTBOOK.id }], split: 0.95 },
  ),
  state(
    'reloaded',
    'Reloaded',
    'Drag the seam, then reload the page: the same thing is on the right (from the URL) and the split is where it was left. This scenario leaves the saved split alone; the others reset it.',
    { right: TEXTBOOK.id, keepSplit: true },
  ),
];
