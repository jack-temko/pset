import { ApiError, errorView } from '@/api/client';
import type { Change, Resource } from '@/api/gen/change';
import type { View } from '@/api/gen/errs';

/**
 * The page's one copy of everything it shows, kept up to date by the change
 * log (`ideas/backend-courses.md`, track 8).
 *
 * - **Normalized.** Each thing is held once, by kind and id. A list holds
 *   only ids, so a course renamed in one place is renamed in every list.
 * - **The higher seq wins.** Every thing on the wire carries the seq of its
 *   last change. A copy replaces the one held only when its seq is at least
 *   as high, so a read that set off before a change and lands after it can't
 *   bring the old copy back.
 * - **A change says what to do.** One with `after` (the student's own edit
 *   to the student's own fields) patches the copy held. One without (PSet's
 *   work, or a mix) has the thing read again. One that makes, removes or
 *   restores a thing has the lists that may hold it read again.
 * - **Only what is on screen is kept live.** A change to a thing nobody
 *   shows drops it; the next screen to show it reads it fresh.
 *
 * Reading and the stream are injected (`ThingDef`, `ListDef`, `apply`), so
 * this file holds the rules and nothing else.
 */

/** What every resource on the wire has. */
export interface Held {
  id: string;
  seq: number;
}

/** How to read one thing of a kind. */
export interface ThingDef<T extends Held> {
  kind: Resource;
  read: (id: string) => Promise<T>;
}

/** How to read one list, and which changes may change what it holds. */
export interface ListDef<T extends Held> {
  /** Unique per list: "courses", "materials:c1". */
  key: string;
  /** What it lists, and how to read one of them again. */
  thing: ThingDef<T>;
  read: () => Promise<T[]>;
  /** Whether a thing made, removed or restored by this change could be in
   *  the list (a material of another course could not). */
  covers: (c: Change) => boolean;
}

/** One thing as a screen sees it. */
export type ThingState<T> =
  | { state: 'loading' }
  | { state: 'ready'; value: T }
  /** Not there (removed and purged, or never was). */
  | { state: 'gone' }
  | { state: 'failed'; error: View };

/** One list as a screen sees it. */
export type ListState<T> =
  | { state: 'loading' }
  | { state: 'ready'; items: T[] }
  | { state: 'failed'; error: View };

/** Whether the page hears about changes. "lost" is a page that reads but
 *  hears nothing until the stream opens again (it keeps trying). */
export type Streaming = 'connecting' | 'open' | 'lost';

interface ThingEntry {
  def: ThingDef<Held>;
  value?: Held;
  gone: boolean;
  error?: View;
  watchers: number;
  reading: boolean;
  again: boolean;
  snap: ThingState<Held>;
}

interface ListEntry {
  def: ListDef<Held>;
  ids?: string[];
  error?: View;
  watchers: number;
  reading: boolean;
  again: boolean;
  snap: ListState<Held>;
}

const thingKey = (kind: Resource, id: string) => `${kind}:${id}`;

const LOADING = { state: 'loading' } as const;

export class Store {
  private things = new Map<string, ThingEntry>();
  private lists = new Map<string, ListEntry>();
  private listeners = new Set<() => void>();
  private waiting: { seq: number; done: () => void }[] = [];
  private opened: () => void = () => undefined;

  /** The newest change this page has heard of. */
  seq = 0;
  streaming: Streaming = 'connecting';
  /** Settles when reads may go: the stream is open (so nothing that changes
   *  after a read is missed), or lost (so reads go anyway). */
  readonly ready: Promise<void>;

  constructor() {
    this.ready = new Promise((r) => {
      this.opened = r;
    });
  }

  // ---- what screens use

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  thing<T extends Held>(kind: Resource, id: string): ThingState<T> {
    return (this.things.get(thingKey(kind, id))?.snap ??
      LOADING) as ThingState<T>;
  }

  list<T extends Held>(key: string): ListState<T> {
    return (this.lists.get(key)?.snap ?? LOADING) as ListState<T>;
  }

  /** Keeps a thing live while it is on screen; returns its undo. */
  watchThing<T extends Held>(def: ThingDef<T>, id: string): () => void {
    const e = this.thingEntry(def, id);
    e.watchers++;
    if (e.value === undefined && !e.gone && !e.reading) {
      void this.readThing(e, id);
    }
    return () => {
      e.watchers--;
    };
  }

  /** Keeps a list (and every thing in it) live while it is on screen. */
  watchList<T extends Held>(def: ListDef<T>): () => void {
    let e = this.lists.get(def.key);
    if (e === undefined) {
      e = {
        def: def as unknown as ListDef<Held>,
        watchers: 0,
        reading: false,
        again: false,
        snap: LOADING,
      };
      this.lists.set(def.key, e);
    }
    const entry = e;
    entry.watchers++;
    if (entry.ids === undefined) {
      if (!entry.reading) void this.readList(entry);
    } else if (entry.watchers === 1) {
      // Shown again after a while unwatched: its things may have been
      // forgotten meanwhile. Read it again behind the copy it shows.
      void this.readList(entry);
    }
    return () => {
      entry.watchers--;
    };
  }

  /** Settles once the page has heard of every change up to `seq` (an
   *  action's reply says how far the log had got), or at once if it never
   *  will. Heard, not shown: a thing a change sent to be read again may
   *  still be on its way. */
  caughtUp(seq: number): Promise<void> {
    if (seq <= this.seq || this.streaming === 'lost') return Promise.resolve();
    return new Promise((done) => {
      this.waiting.push({ seq, done });
    });
  }

  // ---- what the stream calls

  /** The stream opened (or reopened). */
  open(): void {
    this.streaming = 'open';
    this.opened();
    this.changed();
  }

  /** The stream is slow to open: reads go anyway, and a change between a
   *  read and the stream's opening may be missed until the thing changes
   *  again. */
  readAnyway(): void {
    this.opened();
  }

  /** The stream is gone (until it opens again): reads still go, nothing is
   *  live. */
  lose(): void {
    this.streaming = 'lost';
    this.opened();
    for (const w of this.waiting) w.done();
    this.waiting = [];
    this.changed();
  }

  /** Back to connecting, as the stream retries. */
  reconnecting(): void {
    if (this.streaming === 'lost') return;
    this.streaming = 'connecting';
    this.changed();
  }

  /** The stream's position, from an event's id: a seq the page has heard. */
  heard(seq: number): void {
    if (seq <= this.seq) return;
    this.seq = seq;
    const now = this.waiting.filter((w) => w.seq <= seq);
    this.waiting = this.waiting.filter((w) => w.seq > seq);
    for (const w of now) w.done();
  }

  /** One change from the log. */
  apply(c: Change): void {
    this.heard(c.seq);
    const key = thingKey(c.kind, c.id);
    const e = this.things.get(key);
    if (e !== undefined) {
      const v = e.value;
      if (
        v !== undefined &&
        c.op === 'changed' &&
        c.after !== undefined &&
        c.seq > v.seq
      ) {
        // The student's own edit, with its values: no read needed.
        this.keep(e, { ...v, ...c.after, seq: c.seq });
        // A read on its way set off before this edit, and its copy is now
        // older than the one held: refused when it lands. Whatever made it
        // set off still needs a read, so one more follows it.
        if (e.reading) e.again = true;
        this.changed();
      } else if (v === undefined || c.seq > v.seq) {
        this.refresh(key, e, c.id);
      }
    }
    // A list being read may hold this thing, read before the change: it
    // reads once more.
    for (const l of this.lists.values()) {
      if (l.reading && l.def.thing.kind === c.kind && l.def.covers(c)) {
        l.again = true;
      }
    }
    // A step's change names only the step: whatever holds it reads again,
    // and so does anything being read now, which may hold it unseen.
    if (c.kind === 'step') {
      this.refreshHolders(c.id);
      for (const t of this.things.values()) if (t.reading) t.again = true;
      for (const l of this.lists.values()) if (l.reading) l.again = true;
    }
    if (c.op !== 'changed') {
      for (const l of this.lists.values()) {
        if (l.def.thing.kind === c.kind && l.def.covers(c)) {
          this.refreshList(l);
        }
      }
    }
  }

  /** The log no longer reaches back to the page, and starts at `seq`:
   *  everything on screen is read again, and nothing else is kept. */
  resync(seq: number): void {
    // Below what the page heard, or below a copy it holds: the log can't
    // have gone back, so it started again.
    const restarted =
      seq < this.seq ||
      [...this.things.values()].some((e) => (e.value?.seq ?? 0) > seq);
    if (restarted) {
      // The log starts again lower (its database was made again): every seq
      // the page holds is from before, so each copy held gives way to the
      // next read, and nothing waits for a seq that won't come.
      this.seq = seq;
      for (const e of this.things.values()) {
        if (e.value !== undefined) e.value = { ...e.value, seq: -1 };
      }
      for (const w of this.waiting) w.done();
      this.waiting = [];
    }
    this.heard(seq);
    this.rereadAll();
  }

  /** Reads everything on screen again, forgetting the rest: the page may
   *  have missed changes (it read before the stream opened, or it was
   *  away), but the log has not started again. */
  rereadAll(): void {
    for (const [key, e] of this.things) this.refresh(key, e, idOf(key));
    for (const l of this.lists.values()) this.refreshList(l);
  }

  // ---- inside

  private changed() {
    this.redrawLists();
    this.listeners.forEach((l) => {
      l();
    });
  }

  private thingEntry(def: ThingDef<Held>, id: string): ThingEntry {
    const key = thingKey(def.kind, id);
    let e = this.things.get(key);
    if (e === undefined) {
      e = {
        def,
        gone: false,
        watchers: 0,
        reading: false,
        again: false,
        snap: LOADING,
      };
      this.things.set(key, e);
    }
    return e;
  }

  /** Whether a thing is on screen: watched itself, or in a watched list. */
  private live(key: string, e: ThingEntry): boolean {
    if (e.watchers > 0) return true;
    const id = idOf(key);
    for (const l of this.lists.values()) {
      if (
        l.watchers > 0 &&
        l.def.thing.kind === e.def.kind &&
        l.ids?.includes(id)
      ) {
        return true;
      }
    }
    return false;
  }

  /** A changed thing: read again if on screen, else forgotten. */
  private refresh(key: string, e: ThingEntry, id: string) {
    if (this.live(key, e)) {
      void this.readThing(e, id);
    } else {
      this.things.delete(key);
    }
  }

  private refreshHolders(stepId: string) {
    for (const [key, e] of this.things) {
      const steps = (e.value as { steps?: { id: string }[] } | undefined)
        ?.steps;
      if (steps?.some((s) => s.id === stepId)) this.refresh(key, e, idOf(key));
    }
  }

  private refreshList(l: ListEntry) {
    if (l.watchers > 0) {
      void this.readList(l);
    } else {
      this.lists.delete(l.def.key);
    }
  }

  /** Keeps a copy if it is at least as new as the one held. */
  private keep(e: ThingEntry, v: Held): boolean {
    if (e.value !== undefined && v.seq < e.value.seq) return false;
    e.value = v;
    e.gone = false;
    e.error = undefined;
    e.snap = { state: 'ready', value: v };
    return true;
  }

  private async readThing(e: ThingEntry, id: string): Promise<void> {
    // One read of a thing at a time; a change during it reads once more.
    if (e.reading) {
      e.again = true;
      return;
    }
    e.reading = true;
    await this.ready;
    try {
      const v = await e.def.read(id);
      this.keep(e, v);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        e.value = undefined;
        e.gone = true;
        e.snap = { state: 'gone' };
      } else if (e.value === undefined) {
        // A copy held stays on screen; only a first read that fails shows.
        e.error = errorView(err);
        e.snap = { state: 'failed', error: e.error };
      }
    }
    e.reading = false;
    this.changed();
    if (e.again) {
      e.again = false;
      void this.readThing(e, id);
    }
  }

  private async readList(l: ListEntry): Promise<void> {
    if (l.reading) {
      l.again = true;
      return;
    }
    l.reading = true;
    await this.ready;
    try {
      const items = await l.def.read();
      for (const v of items) {
        this.keep(this.thingEntry(l.def.thing, v.id), v);
      }
      l.ids = items.map((v) => v.id);
      l.error = undefined;
      l.snap = { state: 'ready', items: this.itemsOf(l) };
    } catch (err) {
      if (l.ids === undefined) {
        l.error = errorView(err);
        l.snap = { state: 'failed', error: l.error };
      }
    }
    l.reading = false;
    this.changed();
    if (l.again) {
      l.again = false;
      void this.readList(l);
    }
  }

  private itemsOf(l: ListEntry): Held[] {
    return (l.ids ?? []).flatMap((id) => {
      const v = this.things.get(thingKey(l.def.thing.kind, id))?.value;
      return v === undefined ? [] : [v];
    });
  }

  /** Lists show their things' newest copies: a list whose things changed
   *  gets a new snapshot, the rest keep theirs (so React skips them). */
  private redrawLists(): void {
    for (const l of this.lists.values()) {
      // A list nobody shows keeps its last picture: shown again, it reads
      // again behind it, and nothing jumps.
      if (l.ids !== undefined && l.watchers > 0) {
        const items = this.itemsOf(l);
        const was = l.snap.state === 'ready' ? l.snap.items : [];
        if (items.some((v, i) => v !== was[i]) || items.length !== was.length) {
          l.snap = { state: 'ready', items };
        }
      }
    }
  }
}

const idOf = (key: string) => key.slice(key.indexOf(':') + 1);
