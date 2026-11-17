import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { ForceLoading } from './loading';
import { hasQuietForm } from './quiet';
import { FIXTURES, UNITS } from './registry';

// The loading contract's fast check (ideas/skeleton-grill.md, D2). It finds
// the screens on the contract by itself (they read data and write no
// skeleton: their quiet form is derived), so converting one, or adding one,
// needs no list here.

const ALL = [...UNITS, ...FIXTURES];

const roots: ReturnType<typeof createRoot>[] = [];
afterEach(() => {
  act(() => {
    for (const r of roots.splice(0)) r.unmount();
  });
  document.body.replaceChildren();
});

/** Every piece of text a render shows, trimmed, in order, and its markup. */
function drawn(node: ReactNode): { texts: string[]; html: string } {
  const el = document.createElement('div');
  document.body.append(el);
  const root = createRoot(el);
  roots.push(root);
  act(() => {
    root.render(node);
  });
  const out: string[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n.textContent?.replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
  const html = el.innerHTML;
  el.remove();
  return { texts: out, html };
}

/** Time for one state to render twice in jsdom, on a loaded machine. */
const RENDER_MS = 20_000;

describe('a screen that reads data has a quiet form, and it prints nothing its loaded state does not', () => {
  const cases = ALL.filter((e) => hasQuietForm(e.spec)).flatMap((e) =>
    e.spec.states
      .filter((s) => s.loads !== false)
      .map((s) => [`${e.spec.id}:${s.id}`, e, s.id] as const),
  );
  it.each(cases)(
    '%s',
    async (_key, entry, state) => {
      const ex = await entry.examples();
      // Not on the contract yet: its hand-written skeleton goes when it is.
      if (ex.skeletons !== undefined) return;
      const render = ex.states[state];
      const loaded = drawn(render());
      const loading = drawn(
        <ForceLoading.Provider value>{render()}</ForceLoading.Provider>,
      );
      // Drawn the same either way: it reads data but is not made with waits,
      // so it has no loading form at all.
      expect(loading.html, 'no quiet form: make it with waits').not.toBe(
        loaded.html,
      );
      const said = loaded.texts.join(' ');
      expect(loading.texts.filter((t) => !said.includes(t))).toEqual([]);
    },
    RENDER_MS,
  );
});
