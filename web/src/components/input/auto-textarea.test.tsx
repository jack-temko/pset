import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import { AutoTextarea } from '.';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

class NoResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}
globalThis.ResizeObserver = NoResizeObserver;

describe('AutoTextarea', () => {
  it('keeps its natural height when it has no layout, rather than collapsing to 0px', () => {
    // A textarea mounted hidden (the Ask tab behind Homework) measures
    // scrollHeight 0: it must not be given a height of 0.
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    act(() => {
      root.render(<AutoTextarea value="" onChange={() => {}} />);
    });
    const el = host.querySelector('textarea');
    expect(el?.style.height).not.toBe('0px');
    act(() => {
      root.unmount();
    });
    host.remove();
  });
});
