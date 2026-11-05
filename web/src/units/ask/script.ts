import type { Block, Turn } from './types';
import { ANSWER } from './sample';

/** An answer being written, for the design page and the workspace until the
 *  server answers: thinking, then each step running in its place and the
 *  document a block at a time. The real pane streams what the server sends. */
export function script(): { after: number; step: (t: Turn) => Turn }[] {
  const add =
    (b: Block) =>
    (t: Turn): Turn => ({
      ...t,
      blocks: [...t.blocks, b],
    });
  const last = (t: Turn, f: (b: Block) => Block): Turn => ({
    ...t,
    blocks: t.blocks.map((b, i) => (i === t.blocks.length - 1 ? f(b) : b)),
  });
  const out: { after: number; step: (t: Turn) => Turn }[] = [];
  for (const [n, b] of ANSWER.entries()) {
    if (b.k !== 'run') {
      out.push({ after: n === 0 ? 900 : 800, step: add(b) });
      continue;
    }
    // A run of steps: each shows as the one current step, then is done.
    b.calls.forEach((c, i) => {
      out.push({
        after: i === 0 ? 900 : 1000,
        step: (t) =>
          i === 0
            ? add({ k: 'run', calls: [], current: c })(t)
            : last(t, (x) =>
                x.k === 'run'
                  ? {
                      ...x,
                      calls: [...x.calls, ...(x.current ? [x.current] : [])],
                      current: c,
                    }
                  : x,
              ),
      });
    });
    out.push({
      after: 1000,
      step: (t) =>
        last(t, (x) =>
          x.k === 'run'
            ? {
                ...x,
                calls: [...x.calls, ...(x.current ? [x.current] : [])],
                current: undefined,
              }
            : x,
        ),
    });
  }
  out.push({ after: 500, step: (t) => ({ ...t, status: 'done' }) });
  return out;
}
