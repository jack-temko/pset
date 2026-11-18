import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Store } from './store';
import { connect, OPEN_WAIT_MS, RETRY_MS } from './stream';

/** An EventSource the test drives: open it, send it messages, close it. */
class FakeSource {
  static made: FakeSource[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  readyState = FakeSource.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  readonly url: string;
  constructor(url: string) {
    this.url = url;
    FakeSource.made.push(this);
  }
  open() {
    this.readyState = FakeSource.OPEN;
    this.onopen?.();
  }
  send(data: unknown, id = '') {
    this.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify(data),
        lastEventId: id,
      }),
    );
  }
  fail(closed: boolean) {
    this.readyState = closed ? FakeSource.CLOSED : FakeSource.CONNECTING;
    this.onerror?.();
  }
  close() {
    this.closed = true;
  }
}

const last = () => FakeSource.made.at(-1);

beforeEach(() => {
  vi.useFakeTimers();
  FakeSource.made = [];
  vi.stubGlobal('EventSource', FakeSource);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('connect', () => {
  it('opens from now, and hears where the log starts', () => {
    const s = new Store();
    connect(s);
    expect(last()?.url).toBe('/api/changes');
    last()?.open();
    last()?.send({ type: 'open' }, '42');
    expect(s.streaming).toBe('open');
    expect(s.seq).toBe(42);
  });

  it('lets reads go when the stream is slow, and reads again once it opens', async () => {
    const s = new Store();
    const reread = vi.spyOn(s, 'rereadAll');
    let ready = false;
    void s.ready.then(() => {
      ready = true;
    });
    connect(s);
    await vi.advanceTimersByTimeAsync(OPEN_WAIT_MS);
    expect(ready).toBe(true);
    expect(reread).not.toHaveBeenCalled();
    last()?.open();
    expect(reread).toHaveBeenCalledTimes(1);
  });

  it('leaves a dropped connection to EventSource, and opens a closed one again from the last seq', async () => {
    const s = new Store();
    connect(s);
    last()?.open();
    last()?.send({ type: 'open' }, '7');
    last()?.fail(false);
    expect(s.streaming).toBe('connecting');
    expect(FakeSource.made).toHaveLength(1);
    last()?.fail(true);
    expect(s.streaming).toBe('lost');
    await vi.advanceTimersByTimeAsync(RETRY_MS[0] ?? 0);
    expect(FakeSource.made).toHaveLength(2);
    expect(last()?.url).toBe('/api/changes?after=7');
    last()?.open();
    expect(s.streaming).toBe('open');
  });

  it('waits longer each time it can’t open, and reads again after a gap it can’t replay', async () => {
    const s = new Store();
    const reread = vi.spyOn(s, 'rereadAll');
    connect(s);
    last()?.fail(true);
    await vi.advanceTimersByTimeAsync(RETRY_MS[0] ?? 0);
    last()?.fail(true);
    await vi.advanceTimersByTimeAsync((RETRY_MS[1] ?? 0) - 1);
    expect(FakeSource.made).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeSource.made).toHaveLength(3);
    // It never heard a seq: no ?after=, and everything is read again.
    expect(last()?.url).toBe('/api/changes');
    last()?.open();
    expect(reread).toHaveBeenCalled();
  });

  it('stops for good when closed', async () => {
    const s = new Store();
    const close = connect(s);
    const first = last();
    close();
    first?.fail(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(first?.closed).toBe(true);
    expect(FakeSource.made).toHaveLength(1);
  });
});
