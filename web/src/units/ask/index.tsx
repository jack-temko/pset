import { waits, type Loads } from '@/design/loading';
import { Pane } from './pane';
import type { Turn } from './types';

export type { Question, Turn } from './types';

/** The Ask pane: one running conversation about a course, and the box that
 *  adds to it. Its quiet form is the box at the foot and an empty
 *  conversation above it: the box is known, the turns are not (loading D2). */
export const Ask = waits(
  { data: ['turns'] } satisfies Loads<{ turns: readonly Turn[] }>,
  Pane,
);
