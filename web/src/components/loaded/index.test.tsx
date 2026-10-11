import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GRACE_MS } from '@/lib/settled';
import { Loaded } from '.';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type Q = { data: string | undefined; isPending: boolean; isError: boolean };
const pending: Q = { data: undefined, isPending: true, isError: false };
const loaded: Q = { data: 'hello', isPending: false, isError: false };
const failed: Q = { data: undefined, isPending: false, isError: true };

let host: HTMLDivElement;
let root: Root;
const show = (q: Q) => {
  act(() => {
    root.render(
      <Loaded query={q} skeleton={<span data-testid="sk">...</span>}>
        {(d) => <span>{d}</span>}
      </Loaded>,
    );
  });
};
const box = () => host.firstElementChild as HTMLElement;
const skeletonLayer = () => host.querySelector<HTMLElement>('[aria-hidden]');
const contentLayer = () => box().lastElementChild as HTMLElement | null;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => {
    root.unmount();
  });
  host.remove();
  vi.useRealTimers();
});

describe('Loaded', () => {
  it('holds the skeleton in layout but hidden during the grace, then shows it', () => {
    show(pending);
    expect(host.querySelector('[data-testid=sk]')).not.toBeNull();
    expect(skeletonLayer()?.className).toContain('opacity-0');
    act(() => void vi.advanceTimersByTime(GRACE_MS));
    expect(skeletonLayer()?.className).toContain('opacity-100');
  });

  it('is busy while pending', () => {
    show(pending);
    expect(box().getAttribute('aria-busy')).toBe('true');
  });

  it('crossfades content over a skeleton that was seen, then drops the skeleton', () => {
    show(pending);
    act(() => void vi.advanceTimersByTime(GRACE_MS));
    show(loaded);
    expect(skeletonLayer()?.className).toContain('fade-out');
    expect(contentLayer()?.className).toContain('fade-in');
    expect(box().hasAttribute('aria-busy')).toBe(false);
    act(() => void vi.advanceTimersByTime(200));
    expect(skeletonLayer()).toBeNull();
    expect(host.textContent).toBe('hello');
  });

  it('keeps the same content element through the crossfade', () => {
    show(pending);
    act(() => void vi.advanceTimersByTime(GRACE_MS));
    show(loaded);
    const before = contentLayer();
    act(() => void vi.advanceTimersByTime(200));
    expect(contentLayer()).toBe(before);
  });

  it('shows data that lands inside the grace at once, with no skeleton and no fade', () => {
    show(pending);
    act(() => void vi.advanceTimersByTime(100));
    show(loaded);
    expect(skeletonLayer()).toBeNull();
    expect(contentLayer()?.className).not.toContain('fade-in');
    expect(host.textContent).toBe('hello');
  });

  it('shows cached data at once, without the fade', () => {
    show(loaded);
    expect(host.textContent).toBe('hello');
    expect(skeletonLayer()).toBeNull();
    expect(contentLayer()?.className).not.toContain('fade-in');
  });

  it('swaps instantly under reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    show(pending);
    act(() => void vi.advanceTimersByTime(GRACE_MS));
    show(loaded);
    expect(skeletonLayer()).toBeNull();
    expect(contentLayer()?.className).not.toContain('fade-in');
    vi.unstubAllGlobals();
  });

  it('starts the grace again when a new wait begins', () => {
    show(pending);
    act(() => void vi.advanceTimersByTime(GRACE_MS));
    show(loaded);
    act(() => void vi.advanceTimersByTime(200));
    show(pending);
    expect(skeletonLayer()?.className).toContain('opacity-0');
  });

  it('says one line when the query failed', () => {
    show(failed);
    expect(host.textContent).toMatch(/Couldn't load/);
    expect(host.querySelector('[role=status]')).not.toBeNull();
  });

  it('does not show the error line when there is data to show', () => {
    show({ data: 'hello', isPending: false, isError: true });
    expect(host.textContent).toBe('hello');
  });

  it('starts the skeleton fade-out from the opacity it had, so a half-faded skeleton does not pop', () => {
    show(pending);
    act(() => void vi.advanceTimersByTime(GRACE_MS));
    const real = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, p) => {
      const cs = real(el, p);
      return el === skeletonLayer()
        ? ({ opacity: '0.4' } as CSSStyleDeclaration)
        : cs;
    });
    show(loaded);
    expect(skeletonLayer()?.style.getPropertyValue('--fade-from')).toBe('0.4');
    vi.restoreAllMocks();
  });

  describe('without a grace (an overlay)', () => {
    const showNow = (q: Q) => {
      act(() => {
        root.render(
          <Loaded grace={false} query={q} skeleton={<span>...</span>}>
            {(d) => <span>{d}</span>}
          </Loaded>,
        );
      });
    };

    it('draws the skeleton from the first frame', () => {
      showNow(pending);
      expect(skeletonLayer()?.className).toContain('opacity-100');
      expect(skeletonLayer()?.className).not.toContain('opacity-0');
    });

    it('still crossfades data that lands inside 300ms, since the skeleton was seen', () => {
      showNow(pending);
      act(() => void vi.advanceTimersByTime(100));
      showNow(loaded);
      expect(skeletonLayer()?.className).toContain('fade-out');
      expect(contentLayer()?.className).toContain('fade-in');
      act(() => void vi.advanceTimersByTime(200));
      expect(skeletonLayer()).toBeNull();
    });

    it('shows cached data at once', () => {
      showNow(loaded);
      expect(skeletonLayer()).toBeNull();
      expect(contentLayer()?.className).not.toContain('fade-in');
    });
  });
});
