import type { AnySpec } from '@/design/spec';

export type Load = 'loaded' | 'loading' | 'both';
export const LOADS: readonly Load[] = ['loaded', 'loading', 'both'];

/** How wide a unit's example opens: a component and a pane at their own
 *  width, a view across the page. */
export const DEFAULT_WIDTH = {
  component: 480,
  pane: 440,
  view: 'full',
} as const;
export const STRESS_WIDTH = 160;

export interface StageState {
  state: string;
  load: Load;
  stress: boolean;
  /** Pixels, or the whole stage. */
  w: number | 'full';
}

/** Reads the example's controls from the URL: `?state=&load=&stress=&w=`.
 *  Anything missing or not valid falls back to its default. */
export function parseStage(q: URLSearchParams, spec: AnySpec): StageState {
  const state = q.get('state');
  const load = q.get('load');
  const w = q.get('w');
  const px = Number(w);
  return {
    state: spec.states.some((s) => s.id === state)
      ? (state as string)
      : spec.states[0].id,
    load: LOADS.find((l) => l === load) ?? 'loaded',
    stress: q.get('stress') === '1',
    w:
      w === 'full'
        ? 'full'
        : w !== null && Number.isFinite(px) && px >= 1
          ? Math.round(px)
          : DEFAULT_WIDTH[spec.kind],
  };
}

/** The URL for a stage state: only what differs from the default, so a
 *  fresh page has a clean address. */
export function stageParams(s: StageState, spec: AnySpec): URLSearchParams {
  const d = parseStage(new URLSearchParams(), spec);
  const q = new URLSearchParams();
  if (s.state !== d.state) q.set('state', s.state);
  if (s.load !== d.load) q.set('load', s.load);
  if (s.stress) q.set('stress', '1');
  if (s.w !== d.w) q.set('w', String(s.w));
  return q;
}
