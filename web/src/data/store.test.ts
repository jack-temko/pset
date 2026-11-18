import { describe, expect, it, vi } from 'vitest';

import { ApiError, viewOf } from '@/api/client';
import type { Change } from '@/api/gen/change';

import { Store, type Held, type ListDef, type ThingDef } from './store';
import { dispatch } from './stream';

interface Mat extends Held {
  title: string;
  pages?: number;
  courseId: string;
  steps?: { id: string }[];
}

/** A reader whose answers the test hands out one by one. */
function reader<T>() {
  const calls: { resolve: (v: T) => void; reject: (e: unknown) => void }[] = [];
  const read = vi.fn(
    () =>
      new Promise<T>((resolve, reject) => {
        calls.push({ resolve, reject });
      }),
  );
  return { read, calls };
}

const tick = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

const mat = (seq: number, title = 'Book', more: Partial<Mat> = {}): Mat => ({
  id: 'm1',
  seq,
  title,
  courseId: 'c1',
  ...more,
});

const change = (c: Partial<Change> & { seq: number }): Change => ({
  kind: 'material',
  id: 'm1',
  courseId: 'c1',
  op: 'changed',
  actor: 'pset',
  ...c,
});

function world() {
  const s = new Store();
  const one = reader<Mat>();
  const many = reader<Mat[]>();
  const def: ThingDef<Mat> = { kind: 'material', read: one.read };
  const list: ListDef<Mat> = {
    key: 'materials:c1',
    thing: def,
    read: many.read,
    covers: (c) => c.courseId === 'c1',
  };
  return { s, one, many, def, list };
}

describe('reading', () => {
  it('reads only once the stream is open', async () => {
    const { s, one, def } = world();
    s.watchThing(def, 'm1');
    await tick();
    expect(one.read).not.toHaveBeenCalled();
    s.open();
    await tick();
    expect(one.read).toHaveBeenCalledTimes(1);
  });

  it('reads anyway when the stream is lost', async () => {
    const { s, one, def } = world();
    s.watchThing(def, 'm1');
    s.lose();
    await tick();
    expect(one.read).toHaveBeenCalledTimes(1);
  });

  it('says gone for a 404, and failed for a first read that fails', async () => {
    const { s, one, def } = world();
    s.open();
    s.watchThing(def, 'm1');
    await tick();
    one.calls[0]?.reject(new ApiError(404, viewOf('internal.unexpected')));
    await tick();
    expect(s.thing('material', 'm1').state).toBe('gone');

    const w = world();
    w.s.open();
    w.s.watchThing(w.def, 'm1');
    await tick();
    w.one.calls[0]?.reject(new ApiError(500, viewOf('internal.unexpected')));
    await tick();
    expect(w.s.thing('material', 'm1').state).toBe('failed');
  });
});

describe('the higher seq wins', () => {
  it('patches from the student’s own values, newer only', async () => {
    const { s, one, def } = world();
    s.open();
    s.watchThing(def, 'm1');
    await tick();
    one.calls[0]?.resolve(mat(5));
    await tick();
    s.apply(change({ seq: 6, actor: 'student', after: { title: 'Calc' } }));
    expect(s.thing<Mat>('material', 'm1')).toEqual({
      state: 'ready',
      value: mat(6, 'Calc'),
    });
    // An older change, replayed: ignored.
    s.apply(change({ seq: 4, actor: 'student', after: { title: 'Old' } }));
    expect(s.thing<Mat>('material', 'm1')).toMatchObject({
      value: { title: 'Calc' },
    });
    expect(one.read).toHaveBeenCalledTimes(1);
  });

  it('never lets a read that set off earlier bring the old copy back', async () => {
    const { s, one, def } = world();
    s.open();
    s.watchThing(def, 'm1');
    await tick();
    one.calls[0]?.resolve(mat(5));
    await tick();
    // PSet read more pages: read again...
    s.apply(change({ seq: 7 }));
    await tick();
    // ...and meanwhile the student's rename arrives.
    s.apply(change({ seq: 8, actor: 'student', after: { title: 'New' } }));
    // The read lands with the copy from seq 7: refused, it is older...
    one.calls[1]?.resolve(mat(7, 'Book', { pages: 40 }));
    await tick();
    expect(s.thing<Mat>('material', 'm1')).toMatchObject({
      value: { title: 'New', seq: 8 },
    });
    // ...but what PSet changed at 7 is still to show: one more read.
    expect(one.read).toHaveBeenCalledTimes(3);
    one.calls[2]?.resolve(mat(8, 'New', { pages: 40 }));
    await tick();
    expect(s.thing<Mat>('material', 'm1')).toMatchObject({
      value: { title: 'New', pages: 40, seq: 8 },
    });
  });

  it('starts again from a lower seq when the log does', async () => {
    const { s, one, def } = world();
    s.open();
    s.watchThing(def, 'm1');
    await tick();
    one.calls[0]?.resolve(mat(500));
    await tick();
    let done = false;
    void s.caughtUp(900).then(() => {
      done = true;
    });
    s.resync(3);
    await tick();
    expect(done).toBe(true);
    expect(s.seq).toBe(3);
    one.calls[1]?.resolve(mat(2, 'Fresh'));
    await tick();
    expect(s.thing<Mat>('material', 'm1')).toMatchObject({
      value: { title: 'Fresh', seq: 2 },
    });
  });
});

describe('changes', () => {
  it('reads a thing on screen again, once more if it changes meanwhile', async () => {
    const { s, one, def } = world();
    s.open();
    s.watchThing(def, 'm1');
    await tick();
    one.calls[0]?.resolve(mat(1));
    await tick();
    s.apply(change({ seq: 2 }));
    s.apply(change({ seq: 3 }));
    s.apply(change({ seq: 4 }));
    await tick();
    expect(one.read).toHaveBeenCalledTimes(2);
    one.calls[1]?.resolve(mat(2));
    await tick();
    expect(one.read).toHaveBeenCalledTimes(3);
  });

  it('forgets a thing nobody shows', async () => {
    const { s, one, def } = world();
    s.open();
    const unwatch = s.watchThing(def, 'm1');
    await tick();
    one.calls[0]?.resolve(mat(1));
    await tick();
    unwatch();
    s.apply(change({ seq: 2 }));
    await tick();
    expect(one.read).toHaveBeenCalledTimes(1);
    expect(s.thing('material', 'm1').state).toBe('loading');
  });

  it('reads a list again when a thing it may hold is made or removed', async () => {
    const { s, many, list } = world();
    s.open();
    s.watchList(list);
    await tick();
    many.calls[0]?.resolve([mat(1)]);
    await tick();
    s.apply(change({ seq: 2, id: 'm2', op: 'created' }));
    await tick();
    expect(many.read).toHaveBeenCalledTimes(2);
    // Another course's material, and a plain change: no list read.
    s.apply(change({ seq: 3, id: 'm9', courseId: 'c2', op: 'created' }));
    s.apply(change({ seq: 4, id: 'm9', courseId: 'c1', op: 'changed' }));
    await tick();
    expect(many.read).toHaveBeenCalledTimes(2);
  });

  it('reads a list again when one of its things changed during its read', async () => {
    const { s, many, list } = world();
    s.open();
    s.watchList(list);
    await tick();
    // Read on the server before this change, answered after it.
    s.apply(change({ seq: 2 }));
    many.calls[0]?.resolve([mat(1)]);
    await tick();
    expect(many.read).toHaveBeenCalledTimes(2);
  });

  it('reads a list again when it is shown after a while unwatched', async () => {
    const { s, many, list } = world();
    s.open();
    const unwatch = s.watchList(list);
    await tick();
    many.calls[0]?.resolve([mat(1)]);
    await tick();
    unwatch();
    // Its thing changed while nobody showed it: forgotten.
    s.apply(change({ seq: 2 }));
    s.watchList(list);
    await tick();
    expect(many.read).toHaveBeenCalledTimes(2);
    many.calls[1]?.resolve([mat(2)]);
    await tick();
    expect(s.list<Mat>('materials:c1')).toMatchObject({
      state: 'ready',
      items: [{ seq: 2 }],
    });
  });

  it('shows a patch in every list that holds the thing', async () => {
    const { s, many, list } = world();
    s.open();
    s.watchList(list);
    await tick();
    many.calls[0]?.resolve([mat(1)]);
    await tick();
    const seen = vi.fn();
    s.subscribe(seen);
    s.apply(change({ seq: 2, actor: 'student', after: { title: 'Calc' } }));
    expect(s.list<Mat>('materials:c1')).toMatchObject({
      state: 'ready',
      items: [{ title: 'Calc' }],
    });
    expect(seen).toHaveBeenCalled();
  });

  it('reads again whatever holds a step that changed', async () => {
    const { s, one, def } = world();
    s.open();
    s.watchThing(def, 'm1');
    await tick();
    one.calls[0]?.resolve(mat(1, 'Book', { steps: [{ id: 'st1' }] }));
    await tick();
    s.apply(change({ seq: 2, kind: 'step', id: 'st1' }));
    await tick();
    expect(one.read).toHaveBeenCalledTimes(2);
  });

  it('reads everything on screen again on a resync', async () => {
    const { s, one, many, def, list } = world();
    s.open();
    s.watchThing(def, 'm1');
    s.watchList(list);
    await tick();
    one.calls[0]?.resolve(mat(1));
    many.calls[0]?.resolve([mat(1)]);
    await tick();
    s.resync(50);
    await tick();
    expect(one.read).toHaveBeenCalledTimes(2);
    expect(many.read).toHaveBeenCalledTimes(2);
    expect(s.seq).toBe(50);
  });
});

describe('caught up', () => {
  it('settles once the page has heard that far, or at once when lost', async () => {
    const s = new Store();
    s.open();
    let done = false;
    void s.caughtUp(3).then(() => {
      done = true;
    });
    s.heard(2);
    await tick();
    expect(done).toBe(false);
    s.apply(change({ seq: 3, kind: 'course', id: 'x' }));
    await tick();
    expect(done).toBe(true);

    let lost = false;
    void s.caughtUp(99).then(() => {
      lost = true;
    });
    s.lose();
    await tick();
    expect(lost).toBe(true);
  });
});

describe('the stream’s messages', () => {
  it('sends changes and resyncs to the store, the rest to whoever shows them', () => {
    const s = new Store();
    const apply = vi.spyOn(s, 'apply');
    const resync = vi.spyOn(s, 'resync');
    const live = vi.fn();
    const c = change({ seq: 4 });
    dispatch(s, JSON.stringify({ type: 'change', data: c }), '4', live);
    dispatch(s, JSON.stringify({ type: 'resync' }), '90', live);
    dispatch(
      s,
      JSON.stringify({ type: 'step.activity', data: { stepId: 'a' } }),
      '',
      live,
    );
    dispatch(s, 'not json', '', live);
    dispatch(
      s,
      JSON.stringify({ type: 'change', data: { nope: 1 } }),
      '',
      live,
    );
    dispatch(s, JSON.stringify({ type: 'open' }), '120', live);
    expect(s.seq).toBe(120);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith(c);
    expect(resync).toHaveBeenCalledWith(90);
    expect(live).toHaveBeenCalledTimes(1);
    expect(live).toHaveBeenCalledWith({
      type: 'step.activity',
      data: { stepId: 'a' },
    });
  });
});
