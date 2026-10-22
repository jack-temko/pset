/** The workspace's whole state in one value: both sides' tabs, the open tab
 *  on each, the split and each material tab's page. It is all the address
 *  would hold (workspace-d9), and every change to it is a pure function here. */
export type TabKind = 'set' | 'material' | 'ask';

export interface Tab {
  /** Unique among the open tabs; a material may be open twice. */
  id: string;
  kind: TabKind;
  /** The set's or material's id in the course; empty for Ask. */
  ref: string;
  /** A material tab's page. */
  page?: number;
  /** The problem Ask is about. */
  problem?: string;
}

/** 0 is the left side, 1 the right. */
export type Side = 0 | 1;

export interface State {
  sides: readonly [readonly Tab[], readonly Tab[]];
  /** The open tab's id on each side. */
  open: readonly [string | null, string | null];
  /** Each side's tab ids, least recently open first (workspace-d14). */
  recent: readonly [readonly string[], readonly string[]];
  /** The left side's share of the width, in (0, 1). */
  split: number;
  next: number;
}

export type Spec = Omit<Tab, 'id'>;

export const other = (s: Side): Side => (s === 0 ? 1 : 0);

export function emptyState(): State {
  return {
    sides: [[], []],
    open: [null, null],
    recent: [[], []],
    split: 0.5,
    next: 1,
  };
}

const withSide = (st: State, side: Side, tabs: readonly Tab[]): State => ({
  ...st,
  sides: side === 0 ? [tabs, st.sides[1]] : [st.sides[0], tabs],
});

const withOpen = (st: State, side: Side, id: string | null): State => {
  const recent =
    id === null
      ? st.recent[side]
      : [...st.recent[side].filter((x) => x !== id), id];
  return {
    ...st,
    open: side === 0 ? [id, st.open[1]] : [st.open[0], id],
    recent: side === 0 ? [recent, st.recent[1]] : [st.recent[0], recent],
  };
};

export function find(st: State, id: string) {
  for (const side of [0, 1] as const) {
    const tab = st.sides[side].find((t) => t.id === id);
    if (tab) return { tab, side };
  }
  return undefined;
}

/** The tab open on a side. */
export function openTab(st: State, side: Side) {
  return st.sides[side].find((t) => t.id === st.open[side]);
}

/** The tabs the student can see: the open one of each side. */
export function showing(st: State): Tab[] {
  return ([0, 1] as const).flatMap((s) => openTab(st, s) ?? []);
}

/** The side that has folded away, if exactly one has. */
export function foldedSide(st: State): Side | undefined {
  const [l, r] = st.sides;
  if (l.length === 0 && r.length > 0) return 0;
  if (r.length === 0 && l.length > 0) return 1;
  return undefined;
}

/** Puts a new tab at the end of a side and opens it. */
function push(st: State, side: Side, spec: Spec): State {
  const tab: Tab = { ...spec, id: `t${String(st.next)}` };
  return withOpen(
    withSide({ ...st, next: st.next + 1 }, side, [...st.sides[side], tab]),
    side,
    tab.id,
  );
}

/** Entering a set (workspace-d6): its material on the left at the current
 *  problem's page, the set on the right. */
export function openSet(
  set: string,
  material: { ref: string; page: number },
  split = 0.5,
): State {
  let st: State = { ...emptyState(), split };
  st = push(st, 0, {
    kind: 'material',
    ref: material.ref,
    page: material.page,
  });
  return push(st, 1, { kind: 'set', ref: set });
}

/** Opens something from a side's + menu. A material always gets a new tab (it
 *  may be open twice); a set or Ask that is open is shown instead. */
export function add(st: State, side: Side, spec: Spec): State {
  if (spec.kind !== 'material') {
    const have = ([0, 1] as const)
      .flatMap((s) => st.sides[s].map((tab) => ({ tab, s })))
      .find(({ tab }) => tab.kind === spec.kind && tab.ref === spec.ref);
    if (have) {
      const moved =
        have.s === side ? st : move(st, have.tab.id, side, undefined);
      return select(moved, have.tab.id);
    }
  }
  return push(st, side, spec);
}

export function select(st: State, id: string): State {
  const at = find(st, id);
  return at ? withOpen(st, at.side, id) : st;
}

/** Removes a tab. If it was open, the side's most recently used remaining
 *  tab opens (workspace-d14). */
export function close(st: State, id: string): State {
  const at = find(st, id);
  if (!at) return st;
  const rest = st.sides[at.side].filter((t) => t.id !== id);
  const kept = st.recent[at.side].filter((x) => x !== id);
  const pruned: State = {
    ...withSide(st, at.side, rest),
    recent: at.side === 0 ? [kept, st.recent[1]] : [st.recent[0], kept],
  };
  const open =
    st.open[at.side] === id ? (kept.at(-1) ?? null) : st.open[at.side];
  return withOpen(pruned, at.side, open);
}

export function closeOthers(st: State, id: string): State {
  const at = find(st, id);
  if (!at) return st;
  const only: State = {
    ...withSide(st, at.side, [at.tab]),
    recent: at.side === 0 ? [[], st.recent[1]] : [st.recent[0], []],
  };
  return withOpen(only, at.side, id);
}

/** Moves a tab to a side, before another tab or at the end, and opens it
 *  there. A side that empties folds away on its own. */
export function move(
  st: State,
  id: string,
  to: Side,
  before: string | null | undefined,
): State {
  const at = find(st, id);
  if (!at || before === id) return st;
  const without = close(st, id);
  const tabs = without.sides[to];
  const i = before ? tabs.findIndex((t) => t.id === before) : -1;
  const next =
    i < 0 ? [...tabs, at.tab] : [...tabs.slice(0, i), at.tab, ...tabs.slice(i)];
  // A side that was folded comes back at half and half (workspace-d14).
  const split = tabs.length === 0 ? 0.5 : without.split;
  return withOpen({ ...withSide(without, to, next), split }, to, id);
}

/** A tab dropped on the outer third of the one open side (workspace-d14): a
 *  new side opens on that edge with the tab, the old side keeps the rest, at
 *  half and half. The only tab of the only side cannot split: nothing changes. */
export function splitOpen(st: State, id: string, edge: Side): State {
  const folded = foldedSide(st);
  const at = find(st, id);
  if (folded === undefined || !at) return st;
  if (st.sides[at.side].length === 1 && at.side === other(folded)) return st;
  // The old tabs go to the side opposite the edge.
  const ready = other(folded) === edge ? swap(st) : st;
  return move(ready, id, edge, undefined);
}

export function swap(st: State): State {
  return {
    ...st,
    sides: [st.sides[1], st.sides[0]],
    open: [st.open[1], st.open[0]],
    recent: [st.recent[1], st.recent[0]],
    split: 1 - st.split,
  };
}

export const setSplit = (st: State, split: number): State => ({ ...st, split });

export function setPage(st: State, id: string, page: number): State {
  const at = find(st, id);
  if (!at || at.tab.kind !== 'material') return st;
  return withSide(
    st,
    at.side,
    st.sides[at.side].map((t) => (t.id === id ? { ...t, page } : t)),
  );
}

/** A page link in the work on `workSide` (workspace-d8): turn the book's tab
 *  that is showing, on either side; if none is showing, its tab on the other
 *  side; if none, open one there. Never a duplicate while one is visible. */
export function follow(
  st: State,
  workSide: Side,
  ref: string,
  page: number,
): State {
  const far = other(workSide);
  const visible = [far, workSide]
    .map((s) => openTab(st, s))
    .find((t) => t?.kind === 'material' && t.ref === ref);
  if (visible) return setPage(st, visible.id, page);
  const there = st.sides[far].find(
    (t) => t.kind === 'material' && t.ref === ref,
  );
  if (there) return setPage(select(st, there.id), there.id, page);
  return push(st, far, { kind: 'material', ref, page });
}

/** "Ask about this" (workspace-d5): Ask as a tab on the side not holding the
 *  work, the problem attached. There is one Ask; it is brought along. */
export function askAbout(st: State, workSide: Side, problem: string): State {
  const far = other(workSide);
  const have = ([0, 1] as const)
    .flatMap((s) => st.sides[s])
    .find((t) => t.kind === 'ask');
  const base = have ? close(st, have.id) : st;
  return push(base, far, { kind: 'ask', ref: '', problem });
}

// ---- the address (workspace-d9)

const token = (t: Tab) =>
  t.kind === 'set'
    ? `s:${t.ref}`
    : t.kind === 'material'
      ? `m:${t.ref}:${String(t.page ?? 1)}`
      : `a:${t.problem ?? ''}`;

/** The state as a query string: `l=m:griffiths:112,a:p2&r=s:ps4&lo=0&ro=0&x=0.5`. */
export function encode(st: State): string {
  const q = new URLSearchParams();
  for (const [key, side, o] of [
    ['l', 0, 'lo'],
    ['r', 1, 'ro'],
  ] as const) {
    const tabs = st.sides[side];
    if (tabs.length === 0) continue;
    q.set(key, tabs.map(token).join(','));
    q.set(
      o,
      String(
        Math.max(
          0,
          tabs.findIndex((t) => t.id === st.open[side]),
        ),
      ),
    );
  }
  q.set('x', st.split.toFixed(3));
  return q.toString();
}

function parseTab(s: string): Spec | undefined {
  const [k, a = '', b = ''] = s.split(':');
  if (k === 's' && a) return { kind: 'set', ref: a };
  if (k === 'm' && a) {
    const page = Number(b);
    return { kind: 'material', ref: a, page: page >= 1 ? Math.floor(page) : 1 };
  }
  if (k === 'a') return { kind: 'ask', ref: '', problem: a || undefined };
  return undefined;
}

/** The state an address holds; what it cannot read it leaves out. */
export function decode(query: string): State {
  const q = new URLSearchParams(query);
  let st = emptyState();
  for (const [key, side, o] of [
    ['l', 0, 'lo'],
    ['r', 1, 'ro'],
  ] as const) {
    const specs = (q.get(key) ?? '')
      .split(',')
      .flatMap((s) => parseTab(s) ?? []);
    for (const spec of specs) st = push(st, side, spec);
    const at = st.sides[side].at(Number(q.get(o)));
    if (at) st = withOpen(st, side, at.id);
  }
  const x = Number(q.get('x'));
  return x > 0 && x < 1 ? { ...st, split: x } : st;
}
