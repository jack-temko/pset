import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import { useRead, type Read } from './read';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** A read whose answers the test hands out, in any order. */
function answers() {
  const pending: ((v: string) => void)[] = [];
  const fail: ((e: unknown) => void)[] = [];
  const read = () =>
    new Promise<string>((resolve, reject) => {
      pending.push(resolve);
      fail.push(reject);
    });
  return { read, pending, fail };
}

function mount(read: () => Promise<string>) {
  // The probe hands its latest state out through a box, after each render.
  const box: { state: Read<string>; reload: () => void } = {
    state: { state: 'loading' },
    reload: () => undefined,
  };
  function Probe() {
    const [state, reload] = useRead(read);
    useEffect(() => {
      box.state = state;
      box.reload = reload;
    });
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => {
    root.render(<Probe />);
  });
  return {
    state: () => box.state,
    reload: () => {
      act(() => {
        box.reload();
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
    },
  };
}

describe('useRead', () => {
  it('lets only the newest read answer', async () => {
    const a = answers();
    const r = mount(a.read);
    r.reload();
    // The second read lands first, then the first, older one.
    await act(async () => {
      a.pending[1]?.('new');
      await Promise.resolve();
      a.pending[0]?.('old');
      await Promise.resolve();
    });
    expect(r.state()).toEqual({ state: 'ready', value: 'new' });
    r.unmount();
  });

  it('keeps the last answer when a reload fails', async () => {
    const a = answers();
    const r = mount(a.read);
    await act(async () => {
      a.pending[0]?.('first');
      await Promise.resolve();
    });
    r.reload();
    await act(async () => {
      a.fail[1]?.(new Error('down'));
      await Promise.resolve();
    });
    expect(r.state()).toEqual({ state: 'ready', value: 'first' });
    r.unmount();
  });
});
