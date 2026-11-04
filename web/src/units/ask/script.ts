import type { Turn } from './types';
import { ANSWER, CALLS } from './sample';

/** An answer being written, for the design page and the workspace until the
 *  server answers: thinking, a call in flight, each call finishing, then the
 *  document a block at a time. The real pane streams what the server sends. */
export function script(): { after: number; step: (t: Turn) => Turn }[] {
  const [search, read] = CALLS;
  return [
    { after: 900, step: (t) => ({ ...t, inFlight: search }) },
    {
      after: 1100,
      step: (t) => ({ ...t, calls: [...t.calls, search], inFlight: read }),
    },
    {
      after: 1100,
      step: (t) => ({ ...t, calls: [...t.calls, read], inFlight: undefined }),
    },
    ...ANSWER.map((b) => ({
      after: 800,
      step: (t: Turn): Turn => ({ ...t, blocks: [...t.blocks, b] }),
    })),
    { after: 500, step: (t) => ({ ...t, status: 'done' }) },
  ];
}
