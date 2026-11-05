import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GRACE_MS } from '@/lib/settled';
import type { Variant } from '@/variants';
import { Loaded } from '.';
import { REVEAL_MS, resetRevealTrain } from './reveal';

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
  resetRevealTrain();
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

  it('makes the skeleton inert, so nothing in it is focusable or clickable', () => {
    show(pending);
    expect(skeletonLayer()?.hasAttribute('inert')).toBe(true);
    act(() => void vi.advanceTimersByTime(GRACE_MS));
    show(loaded);
    // Through the crossfade too.
    expect(skeletonLayer()?.hasAttribute('inert')).toBe(true);
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

  describe('the reveal train', () => {
    const two = (a: Q, b: Q) => {
      act(() => {
        root.render(
          <>
            <Loaded query={a} skeleton={<span>...</span>}>
              {(d) => <span data-testid="a">{d}</span>}
            </Loaded>
            <Loaded query={b} skeleton={<span>...</span>}>
              {(d) => <span data-testid="b">{d}</span>}
            </Loaded>
          </>,
        );
      });
    };
    const text = (id: string) =>
      host.querySelector(`[data-testid=${id}]`)?.textContent;

    it('reveals two boxes resolving 100ms apart together', () => {
      two(pending, pending);
      act(() => void vi.advanceTimersByTime(GRACE_MS + 50));
      two(loaded, pending); // the first reveals at once: nothing revealed lately
      expect(text('a')).toBe('hello');
      act(() => void vi.advanceTimersByTime(100));
      two(loaded, { ...loaded, data: 'there' }); // the second joins the next reveal
      expect(text('b')).toBeUndefined();
      act(() => void vi.advanceTimersByTime(REVEAL_MS - 100));
      expect(text('b')).toBe('there');
    });

    it('reveals a box alone at once', () => {
      show(pending);
      act(() => void vi.advanceTimersByTime(GRACE_MS + 50));
      show(loaded);
      expect(contentLayer()?.textContent).toBe('hello');
    });

    it('does not hold data that landed inside the grace', () => {
      show(loaded);
      two(loaded, loaded);
      expect(text('a')).toBe('hello');
      expect(text('b')).toBe('hello');
    });

    it('lets a held box unmount: it leaves the train and nothing fires after', () => {
      two(pending, pending);
      act(() => void vi.advanceTimersByTime(GRACE_MS + 50));
      two(loaded, pending);
      two(loaded, loaded); // the second is held
      expect(text('b')).toBeUndefined();
      act(() => {
        root.render(
          <Loaded query={loaded} skeleton={<span>...</span>}>
            {(d) => <span data-testid="a">{d}</span>}
          </Loaded>,
        );
      });
      act(() => void vi.advanceTimersByTime(REVEAL_MS * 2));
      expect(text('a')).toBe('hello');
      expect(text('b')).toBeUndefined();
    });

    it('does not hold a box that failed: its one line is there at once', () => {
      two(pending, pending);
      act(() => void vi.advanceTimersByTime(GRACE_MS + 50));
      two(loaded, pending);
      two(loaded, failed);
      expect(host.textContent).toMatch(/Couldn't load/);
    });

    it('lets a held box go when its query goes pending again', () => {
      two(pending, pending);
      act(() => void vi.advanceTimersByTime(GRACE_MS + 50));
      two(loaded, pending);
      two(loaded, loaded);
      two(loaded, pending);
      act(() => void vi.advanceTimersByTime(REVEAL_MS));
      expect(text('b')).toBeUndefined();
    });
  });

  describe('several queries', () => {
    const many = (a: Q, b: Q) => {
      act(() => {
        root.render(
          <Loaded query={a} queries={[b]} skeleton={<span>...</span>}>
            {(d) => <span>{d}</span>}
          </Loaded>,
        );
      });
    };

    it('waits for all of them and shows the first one data', () => {
      many(loaded, pending);
      expect(host.textContent).toBe('...');
      many(loaded, { data: 'x', isPending: false, isError: false });
      expect(host.textContent).toBe('hello');
    });

    it('says one line when the main one failed', () => {
      many(failed, loaded);
      expect(host.textContent).toMatch(/Couldn't load/);
    });

    it('does not take the box down when another one failed: the content draws its own line', () => {
      many(loaded, failed);
      expect(host.textContent).toBe('hello');
      expect(host.querySelector('[role=status]')).toBeNull();
    });
  });

  describe('variants', () => {
    type V = Variant<'ask'>;
    const skeletons = {
      empty: <span>skeleton a</span>,
      turns: <span>skeleton b</span>,
    };
    const shape = (variant: V | undefined, q: Q) => {
      act(() => {
        root.render(
          <Loaded
            query={q}
            view="ask"
            variant={variant}
            skeletons={skeletons}
            neutral={<span>neutral</span>}
            variantOf={(d: string) => (d === 'hello' ? 'empty' : 'turns')}
          >
            {(d) => <span>{d}</span>}
          </Loaded>,
        );
      });
    };

    it('draws the skeleton of the known variant, and stamps both layers', () => {
      shape('turns', pending);
      expect(host.textContent).toBe('skeleton b');
      expect(skeletonLayer()?.getAttribute('data-variant')).toBe('turns');
      expect(skeletonLayer()?.getAttribute('data-view')).toBe('ask');
      act(() => void vi.advanceTimersByTime(GRACE_MS));
      shape('turns', { ...loaded, data: 'other' });
      expect(contentLayer()?.getAttribute('data-variant')).toBe('turns');
      expect(contentLayer()?.getAttribute('data-view')).toBe('ask');
    });

    it('draws the neutral skeleton when the variant is not known', () => {
      shape(undefined, pending);
      expect(host.textContent).toBe('neutral');
    });

    it('warns on screen and in the console when the skeleton was another variant', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      shape('turns', pending);
      act(() => void vi.advanceTimersByTime(GRACE_MS));
      shape('turns', loaded);
      expect(host.querySelector('[role=alert]')?.textContent).toMatch(
        /skeleton was "turns" but the content is "empty"/,
      );
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('does not warn after the neutral skeleton, or when they agree', () => {
      shape(undefined, pending);
      act(() => void vi.advanceTimersByTime(GRACE_MS));
      shape(undefined, loaded);
      shape('empty', pending);
      act(() => void vi.advanceTimersByTime(GRACE_MS));
      shape('empty', loaded);
      expect(host.querySelector('[role=alert]')).toBeNull();
    });

    it('warns when the content switches variant just after it appeared', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      shape(undefined, loaded);
      act(() => void vi.advanceTimersByTime(100));
      shape(undefined, { ...loaded, data: 'other' });
      expect(host.querySelector('[role=alert]')?.textContent).toMatch(
        /switched from "empty" to "turns"/,
      );
      warn.mockRestore();
    });
  });
});
