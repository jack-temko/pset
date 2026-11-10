import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { ForceLoading } from './loading';
import { FIXTURES, UNITS } from './registry';

// The loading contract's fast checks (ideas/skeleton-plan.md, layer A). Each
// one lists today's offenders: a new offender fails, and a fixed one must
// leave its list, so the lists only shrink until step 13 removes them.

const SOURCES = import.meta.glob<string>(
  [
    '/src/units/*/**/*.{ts,tsx}',
    '/src/design/sample/*/**/*.{ts,tsx}',
    '!**/*.test.*',
  ],
  { query: '?raw', import: 'default', eager: true },
);

const ALL = [...UNITS, ...FIXTURES];

/** The unit folder a source path is in: "home" for /src/units/home/x.tsx. */
const unitOf = (path: string) =>
  /\/(?:units|sample)\/([^/]+)\//.exec(path)?.[1] ?? path;

/** Units that still export a hand-written skeleton. */
const SKELETON_EXPORTS: readonly string[] = [
  'ask',
  'bar-chart',
  'course',
  'greeting',
  'heatmap',
  'home',
  'list-page',
  'material',
  'problem',
  'problem-strip',
  'settings',
  'summary',
  'work',
];

/** Units that still draw a bar of their own instead of a bone. */
const OWN_BARS: readonly string[] = [
  'ask',
  'bar-chart',
  'course',
  'greeting',
  'heatmap',
  'home',
  'list-page',
  'material',
  'problem',
  'problem-strip',
  'settings',
  'summary',
  'work',
];

/** States whose loading form prints text the loaded state never shows (a
 *  fake crumb, a made-up sentence), as "unit:state". */
const MADE_UP_TEXT: readonly string[] = [
  // The fake "Course" crumb, until the name comes from the clicked link.
  'course:normal',
  'course:nothing-due',
  'course:empty',
  'course:reading-in',
  // "Assignments" in the crumb and title on every kind of list.
  'list-page:memories',
  'list-page:courses',
];

/** Units that read data and are not on the contract yet. */
const NOT_WAITING: readonly string[] = [
  'ask',
  'bar-chart',
  'course',
  'greeting',
  'heatmap',
  'home',
  'list-page',
  'material',
  'memory',
  'settings',
  'side',
  'work',
  'workspace',
];

const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort();

describe('the loading contract', () => {
  it('no unit exports a hand-written skeleton', () => {
    const found = Object.entries(SOURCES)
      .filter(([, s]) => /export function \w+Skeleton\b/.test(s))
      .map(([p]) => unitOf(p));
    expect(sorted(found)).toEqual(sorted(SKELETON_EXPORTS));
  });

  it('only the bone unit draws a loading bar', () => {
    const found = Object.entries(SOURCES)
      .filter(([p]) => !p.includes('/units/bone/'))
      .filter(([, s]) => /animate-pulse|ds-bone(?!-)|ds-bone-block/.test(s))
      .map(([p]) => unitOf(p));
    expect(sorted(found)).toEqual(sorted(OWN_BARS));
  });

  it('a unit that reads data is on the contract', () => {
    const found = ALL.filter((e) => (e.spec.data?.length ?? 0) > 0)
      .map((e) => e.spec.id)
      .filter(
        (id) =>
          !Object.entries(SOURCES).some(
            ([p, s]) => unitOf(p) === id && s.includes('waits('),
          ),
      );
    expect(sorted(found)).toEqual(sorted(NOT_WAITING));
  });
});

const roots: ReturnType<typeof createRoot>[] = [];
afterEach(() => {
  act(() => {
    for (const r of roots.splice(0)) r.unmount();
  });
  document.body.replaceChildren();
});

/** Every piece of text a render shows, trimmed, in order. */
function textsOf(node: ReactNode): string[] {
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
  el.remove();
  return out;
}

/** Time for one state to render twice in jsdom, on a loaded machine. */
const RENDER_MS = 20_000;

describe('a loading form prints nothing the loaded state does not', () => {
  const cases = ALL.flatMap((e, i) =>
    e.spec.states
      .filter((s) => s.loads !== false)
      .map((s) => [`${e.spec.id}:${s.id}`, i, s.id] as const),
  );
  it.each(cases)(
    '%s',
    async (key, i, state) => {
      const ex = await ALL[i].examples();
      const render = ex.states[state];
      const written = ex.skeletons?.[state];
      const loading = written ? (
        written()
      ) : (
        <ForceLoading.Provider value="shape">{render()}</ForceLoading.Provider>
      );
      const loaded = textsOf(render()).join(' ');
      const extra = textsOf(loading).filter((t) => !loaded.includes(t));
      if (MADE_UP_TEXT.includes(key)) expect(extra).not.toEqual([]);
      else expect(extra).toEqual([]);
    },
    RENDER_MS,
  );
});
