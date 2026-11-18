import { useEffect, useSyncExternalStore } from 'react';

import { api, ApiError, errorView, get } from '@/api/client';
import type { Resource } from '@/api/gen/change';
import type { View } from '@/api/gen/errs';
import type { Group, Kind, Place, Places } from '@/api/gen/place';

/**
 * Where the student was, how they laid it out and what they had not sent,
 * kept on the server (`ideas/actions-conditions-place-grill.md`), in place of
 * the browser-storage files.
 *
 * - **Read once.** A tab reads a thing's places the first time it shows that
 *   thing, and never again (C6): two tabs each go their own way, and a
 *   tab's own writes are newer than anything the server could send back.
 * - **Kept here at once, written later.** A place changes as the student
 *   scrolls; the screen reads this tab's copy, and the server gets the
 *   newest of a burst after `WRITE_MS`, one write at a time per place.
 * - **Every write is a whole place.** The server keeps one place per owner,
 *   kind and tab, and a write replaces it: so a write sent twice does no
 *   harm, and a draft is cleared by writing it empty. The page never needs a
 *   place's id.
 * - **Written as the page goes.** While the page is hidden, writes go with
 *   `keepalive`, so they outlive it. As it closes (`pagehide`), whatever is
 *   waiting goes at once, and a write still on its way is sent again with
 *   `keepalive`, since the page may cancel it. The cost: if both were on
 *   their way, the older may land last, and the spot is one move behind.
 * - **Not undone, not refused out loud.** A place is no action: Ctrl+Z never
 *   moves the student. A write the server refuses (`place.bad`) is a page
 *   bug; it goes to whoever listens with `onPlaceFailed` (the error module).
 */

/** What the page sends: the server sets the id, the seq and the group. */
export type PlaceInput = Omit<Place, 'id' | 'seq' | 'group'>;

/** The kinds that are something the student had not sent: the ones a
 *  sending clears. */
export type UnsentKind = 'ask_draft' | 'note_draft' | 'new_set';

/** A thing places belong to. */
export interface Owner {
  kind: Resource;
  id: string;
}

/** Names one place: its owner, its kind, and the workspace tab for a page
 *  or zoom kept per tab. */
export interface PlaceName {
  ownerKind: Resource;
  ownerId: string;
  kind: Kind;
  tabId?: string;
}

/** Which of the rule's three each kind is, as the server files it
 *  (`internal/place`): a place kept here shows the same before it is
 *  written. */
const GROUPS: Record<Kind, Group> = {
  problem: 'where',
  page: 'where',
  line: 'where',
  sides: 'layout',
  zoom: 'layout',
  ask_draft: 'unsent',
  note_draft: 'unsent',
  new_set: 'unsent',
};

/** How long a place has to stop changing before it is written. */
export const WRITE_MS = 1000;
/** How long a write the server never answered waits to go again, and how
 *  many times it goes before the next change brings it back. */
export const RETRY_MS = 5000;
export const TRIES = 3;
/** The most a `keepalive` write may carry: every such request in flight
 *  shares 64 KB, and a long draft in another script comes near it. A bigger
 *  one goes as a plain write and may be lost if the page closes. */
export const KEEPALIVE_MAX = 16_000;

export const placeKey = (p: PlaceName): string =>
  `${p.ownerKind}:${p.ownerId}:${p.kind}:${p.tabId ?? ''}`;

const ownerKey = (o: Owner) => `${o.kind}:${o.id}`;

interface Slot {
  /** What the screen shows: the server's copy, then this tab's writes. */
  place?: Place;
  /** Waiting to go: the newest write. */
  pending?: PlaceInput;
  /** On its way. */
  inflight?: PlaceInput;
  sending?: Promise<void>;
  timer?: ReturnType<typeof setTimeout>;
  /** Times the newest write found no server. */
  tries: number;
  /** Written by this tab: newer than any read. */
  touched: boolean;
}

const slots = new Map<string, Slot>();
/** Owners this tab has read (or is reading). */
const read = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
const failed = new Set<(v: View) => void>();

const slot = (key: string): Slot => {
  let s = slots.get(key);
  if (s === undefined) {
    s = { tries: 0, touched: false };
    slots.set(key, s);
  }
  return s;
};

const changed = () => {
  listeners.forEach((l) => {
    l();
  });
};

const fail = (e: unknown) => {
  const v = errorView(e);
  failed.forEach((f) => {
    // A listener's own bug must not stop the writes after this one.
    try {
      f(v);
    } catch {
      // Nothing left to tell.
    }
  });
};

/** Calls `f` with each place write or read that failed; returns its undo. */
export function onPlaceFailed(f: (v: View) => void): () => void {
  failed.add(f);
  return () => {
    failed.delete(f);
  };
}

/**
 * Reads the places of these things, the first time this tab asks for each.
 * Later calls for the same thing return the first read's promise. Never
 * rejects: a thing not read opens as if nothing was kept.
 */
export function readPlaces(owners: readonly Owner[]): Promise<void> {
  const fresh = owners.filter((o) => !read.has(ownerKey(o)));
  if (fresh.length > 0) {
    const q = fresh
      .map((o) => `owner=${encodeURIComponent(ownerKey(o))}`)
      .join('&');
    const p = get<Places>(`/api/places?${q}`).then(
      ({ places }) => {
        for (const pl of places) {
          const s = slot(placeKey(pl));
          // This tab wrote it while the read was on its way: its own is newer.
          if (!s.touched) s.place = pl;
        }
        changed();
      },
      (e: unknown) => {
        // The next screen to show the thing may try again.
        for (const o of fresh) read.delete(ownerKey(o));
        fail(e);
      },
    );
    for (const o of fresh) read.set(ownerKey(o), p);
  }
  return Promise.all(
    owners.map((o) => read.get(ownerKey(o)) ?? Promise.resolve()),
  ).then(() => undefined);
}

const hidden = () =>
  typeof document !== 'undefined' && document.visibilityState === 'hidden';

/** Whether a write is small enough to outlive the page. */
const fits = (input: PlaceInput) =>
  new TextEncoder().encode(JSON.stringify(input)).length <= KEEPALIVE_MAX;

/** One write, its failures sorted: no server is tried again, a removed owner
 *  is nothing to say, the rest is the page's bug. */
async function write(key: string, input: PlaceInput, keepalive: boolean) {
  const s = slot(key);
  try {
    await api<Place>('PUT', '/api/places', input, { keepalive });
    s.tries = 0;
  } catch (e) {
    if (!(e instanceof ApiError) || e.status === 0) {
      s.tries++;
      // Only when nothing newer is waiting: a newer write replaces it.
      if (s.pending === undefined && s.tries < TRIES) {
        s.pending = input;
        schedule(key, RETRY_MS);
      }
      return;
    }
    // The owner was removed while the student was on it: nothing to keep.
    if (e.status === 404) return;
    fail(e);
  }
}

async function send(key: string): Promise<void> {
  const s = slot(key);
  // One write at a time per place, in order: an older write never lands
  // after a newer one while the page is open.
  while (s.sending !== undefined) await s.sending;
  const next = s.pending;
  if (next === undefined) return;
  s.pending = undefined;
  s.inflight = next;
  s.sending = write(key, next, hidden() && fits(next)).finally(() => {
    s.sending = undefined;
    s.inflight = undefined;
  });
  await s.sending;
}

function schedule(key: string, ms = WRITE_MS) {
  const s = slot(key);
  clearTimeout(s.timer);
  s.timer = setTimeout(() => {
    s.timer = undefined;
    void send(key);
  }, ms);
}

const clamp = (x: number | undefined, lo: number, hi: number, or: number) =>
  x === undefined || !Number.isFinite(x) ? or : Math.min(hi, Math.max(lo, x));

/** A place inside the server's bounds: a scroll ratio that rounds past 1 is
 *  not a bug worth a refusal. */
function bounded(p: PlaceInput): PlaceInput {
  switch (p.kind) {
    case 'page':
      return {
        ...p,
        page: Math.round(clamp(p.page, 1, 100_000, 1)),
        down: clamp(p.down, 0, 1, 0),
      };
    case 'line':
      return { ...p, block: Math.round(clamp(p.block, 0, 100_000, 0)) };
    case 'sides':
      return { ...p, split: clamp(p.split, 0, 1, 0.5) };
    case 'zoom':
      return { ...p, zoom: clamp(p.zoom, 0.1, 8, 1) };
    default:
      return p;
  }
}

const shown = (input: PlaceInput, seq: number): Place => ({
  ...input,
  id: '',
  seq,
  group: GROUPS[input.kind],
});

/** Keeps a place: on screen now, on the server after `WRITE_MS`. */
export function keepPlace(place: PlaceInput): void {
  const input = bounded(place);
  const key = placeKey(input);
  const s = slot(key);
  s.touched = true;
  s.tries = 0;
  s.place = shown(input, s.place?.seq ?? 0);
  s.pending = input;
  // A tab's page or zoom is also the material's last, which a tab opened on
  // it next starts from: the server keeps both, and so does this tab.
  if (input.tabId !== undefined && input.tabId !== '') {
    const last = slot(placeKey({ ...input, tabId: undefined }));
    last.touched = true;
    last.place = shown({ ...input, tabId: undefined }, last.place?.seq ?? 0);
  }
  changed();
  schedule(key);
}

/** Forgets a draft: it was sent. Gone from the screen now; on the server it
 *  is written empty, which clears it, after any write before it. */
export function clearPlace(p: {
  ownerKind: Resource;
  ownerId: string;
  kind: UnsentKind;
}): void {
  const key = placeKey(p);
  const s = slot(key);
  s.touched = true;
  s.tries = 0;
  s.place = undefined;
  s.pending = { ownerKind: p.ownerKind, ownerId: p.ownerId, kind: p.kind };
  clearTimeout(s.timer);
  s.timer = undefined;
  changed();
  void send(key);
}

/**
 * Sends every write still waiting, now. Hidden, they go in order (and with
 * `keepalive`, since the page is hidden). Leaving, they go at once, and a
 * write on its way is sent again with `keepalive`: the page may cancel it.
 */
export function flushPlaces(opts: { leaving?: boolean } = {}): void {
  for (const [key, s] of slots) {
    clearTimeout(s.timer);
    s.timer = undefined;
    if (!opts.leaving) {
      if (s.pending !== undefined) void send(key);
      continue;
    }
    const last = s.pending ?? s.inflight;
    s.pending = undefined;
    if (last === undefined || !fits(last)) continue;
    void api('PUT', '/api/places', last, { keepalive: true }).catch(
      () => undefined,
    );
  }
}

const onHide = () => {
  if (document.visibilityState === 'hidden') flushPlaces();
};
const onLeave = () => {
  flushPlaces({ leaving: true });
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', onLeave);
  document.addEventListener('visibilitychange', onHide);
  // A hot reload makes this module again: the old one's listeners go.
  import.meta.hot?.dispose(() => {
    window.removeEventListener('pagehide', onLeave);
    document.removeEventListener('visibilitychange', onHide);
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * A thing's place of one kind (and tab), reading the thing's places the first
 * time this tab shows it. `undefined` while it is being read, and when none
 * was kept: a screen opens at its start either way, and moves once if a place
 * arrives (a scroll position is applied, not laid out, so nothing jumps).
 * Every keep wakes every reader: a screen keeps a scroll spot at most every
 * frame, not on every scroll event.
 */
export function usePlace(p: PlaceName): Place | undefined {
  const { ownerKind, ownerId } = p;
  useEffect(() => {
    void readPlaces([{ kind: ownerKind, id: ownerId }]);
  }, [ownerKind, ownerId]);
  const key = placeKey(p);
  return useSyncExternalStore(subscribe, () => slots.get(key)?.place);
}

/** A place as this tab has it now, outside a component. */
export const currentPlace = (p: PlaceName): Place | undefined =>
  slots.get(placeKey(p))?.place;

/** Forgets everything this tab holds: tests only. */
export function resetPlacesForTest(): void {
  for (const s of slots.values()) clearTimeout(s.timer);
  slots.clear();
  read.clear();
  listeners.clear();
  failed.clear();
}
