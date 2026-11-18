import { useEffect, useSyncExternalStore } from 'react';

import { ApiError, del, errorView, get, put } from '@/api/client';
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
 *   newest of a burst after `WRITE_MS`, one write at a time per place, and
 *   whatever is still waiting when the page is hidden or closed.
 * - **Not undone, not refused out loud.** A place is no action: Ctrl+Z never
 *   moves the student. A write the server refuses (`place.bad`) is a page
 *   bug; it goes to whoever listens with `onPlaceFailed` (the error module).
 */

/** What the page sends: the server sets the id, the seq and the group. */
export type PlaceInput = Omit<Place, 'id' | 'seq' | 'group'>;

/** A thing places belong to. */
export interface Owner {
  kind: Resource;
  id: string;
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

/** One place per owner, kind and tab (the workspace's tab, not the
 *  browser's). */
export const placeKey = (p: {
  ownerKind: Resource;
  ownerId: string;
  kind: Kind;
  tabId?: string;
}): string => `${p.ownerKind}:${p.ownerId}:${p.kind}:${p.tabId ?? ''}`;

const ownerKey = (o: Owner) => `${o.kind}:${o.id}`;

interface Slot {
  /** What the screen shows: the server's copy, then this tab's writes. */
  place?: Place;
  /** The server's id for it, once it has one: what a clear deletes. */
  id?: string;
  /** Waiting to go: the newest write, or `null` for a clear. */
  pending?: PlaceInput | null;
  timer?: ReturnType<typeof setTimeout>;
  /** The write on its way, if one is. */
  sending?: Promise<void>;
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
    s = { touched: false };
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
    f(v);
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
 * Later calls for the same thing return the first read's promise.
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
          s.id = pl.id;
          // This tab wrote it while the read was on its way: its own is newer.
          if (!s.touched) s.place = pl;
        }
        changed();
      },
      (e: unknown) => {
        // Not read: the screen opens as if nothing was kept, and the next
        // screen to show the thing may try again.
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

async function send(key: string): Promise<void> {
  const s = slot(key);
  // One write at a time per place, in order: a clear can't pass the write
  // it clears.
  while (s.sending !== undefined) await s.sending;
  if (s.pending === undefined) return;
  const next = s.pending;
  s.pending = undefined;
  const go = async () => {
    try {
      if (next === null) {
        if (s.id !== undefined) await del(`/api/places/${s.id}`);
        s.id = undefined;
      } else {
        const kept = await put<Place>('/api/places', next);
        s.id = kept.id;
        // Only the id and seq are taken: the fields the screen shows are its
        // own, and may have moved on while this was on its way.
        if (s.place !== undefined && s.pending === undefined) {
          s.place = { ...s.place, id: kept.id, seq: kept.seq };
        }
      }
    } catch (e) {
      // A place emptied by the purge reads as none: nothing to clear.
      if (!(next === null && e instanceof ApiError && e.status === 404)) {
        fail(e);
      }
    }
  };
  s.sending = go().finally(() => {
    s.sending = undefined;
  });
  await s.sending;
}

function schedule(key: string) {
  const s = slot(key);
  clearTimeout(s.timer);
  s.timer = setTimeout(() => {
    s.timer = undefined;
    void send(key);
  }, WRITE_MS);
}

/** Keeps a place: on screen now, on the server after `WRITE_MS`. */
export function keepPlace(input: PlaceInput): void {
  const key = placeKey(input);
  const s = slot(key);
  s.touched = true;
  s.place = {
    ...input,
    id: s.id ?? '',
    seq: s.place?.seq ?? 0,
    group: GROUPS[input.kind],
  };
  s.pending = input;
  changed();
  schedule(key);
}

/** Forgets a place: a draft sent. Gone from the screen now, from the server
 *  once any write before it has landed. */
export function clearPlace(p: {
  ownerKind: Resource;
  ownerId: string;
  kind: Kind;
  tabId?: string;
}): void {
  const key = placeKey(p);
  const s = slot(key);
  s.touched = true;
  s.place = undefined;
  s.pending = null;
  clearTimeout(s.timer);
  s.timer = undefined;
  changed();
  void send(key);
}

/**
 * Sends every write still waiting, now. On `pagehide` the page may be gone
 * before an answer, so these go with `keepalive` and nobody waits for them.
 */
export function flushPlaces(opts: { leaving?: boolean } = {}): void {
  for (const [key, s] of slots) {
    if (s.pending === undefined) continue;
    clearTimeout(s.timer);
    s.timer = undefined;
    if (!opts.leaving) {
      void send(key);
      continue;
    }
    const next = s.pending;
    s.pending = undefined;
    if (next === null) {
      if (s.id !== undefined) {
        void fetch(`/api/places/${s.id}`, {
          method: 'DELETE',
          keepalive: true,
        }).catch(() => undefined);
      }
    } else {
      void fetch('/api/places', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
        keepalive: true,
      }).catch(() => undefined);
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    flushPlaces({ leaving: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPlaces();
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
 */
export function usePlace(p: {
  ownerKind: Resource;
  ownerId: string;
  kind: Kind;
  tabId?: string;
}): Place | undefined {
  const { ownerKind, ownerId } = p;
  useEffect(() => {
    void readPlaces([{ kind: ownerKind, id: ownerId }]);
  }, [ownerKind, ownerId]);
  const key = placeKey(p);
  return useSyncExternalStore(subscribe, () => slots.get(key)?.place);
}

/** Forgets everything this tab holds: tests only. */
export function resetPlacesForTest(): void {
  for (const s of slots.values()) clearTimeout(s.timer);
  slots.clear();
  read.clear();
  listeners.clear();
  failed.clear();
}
