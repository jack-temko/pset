import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TODAY } from '@/units/work/sample';
import { Workspace } from './index';
import { COURSE } from './sample';
import { STATES } from './states';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
function render(node: ReactNode) {
  const el = document.createElement('div');
  document.body.append(el);
  const root = createRoot(el);
  roots.push(root);
  act(() => {
    root.render(node);
  });
  return el;
}

beforeEach(() => {
  vi.useFakeTimers();
  Element.prototype.setPointerCapture = () => {};
});
afterEach(() => {
  act(() => {
    for (const r of roots.splice(0)) r.unmount();
  });
  document.body.replaceChildren();
  vi.useRealTimers();
});

const open = (id: keyof typeof STATES) =>
  render(<Workspace course={COURSE} initial={STATES[id]()} today={TODAY} />);
const press = (el: Element | null | undefined) => {
  act(() => {
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
};
const wait = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
const tabs = (el: Element) =>
  [...el.querySelectorAll('[role=tab]')].map((t) => t.textContent);
/** The work's page link, an anchor "p. N". */
const link = (el: Element) =>
  [...el.querySelectorAll('a')].find((a) => /^p\. \d+$/.test(a.textContent));
const scroller = (el: Element) =>
  el.querySelector<HTMLElement>('[data-scroller]');
const scrollTo = (s: HTMLElement | null, top: number) => {
  act(() => {
    if (s) s.scrollTop = top;
    s?.dispatchEvent(new Event('scroll'));
  });
};
const hasFlash = (el: Element) => el.querySelector('[data-flash]') !== null;

describe('the workspace and its material', () => {
  it('flashes the box on a page link, and a second link restarts the 2 s', () => {
    const el = open('opening');
    wait(300);
    press(link(el));
    wait(10);
    expect(hasFlash(el)).toBe(true);
    wait(1500);
    expect(hasFlash(el)).toBe(true);
    press(link(el));
    wait(10);
    wait(1500);
    expect(hasFlash(el)).toBe(true);
    wait(700);
    expect(hasFlash(el)).toBe(false);
  });

  it('opens boxing on the material from Box one on the page', () => {
    const el = open('opening');
    wait(300);
    const more = [...el.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'More for this set',
    );
    press(more);
    const item = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Box one on the page',
    );
    press(item);
    expect(el.textContent).toContain('Draw a box around');
  });

  it('draws boxes, and Done keeps them for the page link', () => {
    const el = open('opening');
    wait(300);
    const more = [...el.querySelectorAll('button')].find(
      (b) => b.getAttribute('aria-label') === 'More for this set',
    );
    press(more);
    press(
      [...document.querySelectorAll('button')].find(
        (b) => b.textContent === 'Box one on the page',
      ),
    );
    wait(300);
    const page = el.querySelector<HTMLElement>('[data-pdf]');
    if (!page) throw new Error('no page');
    page.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect;
    const fire = (type: string, x: number, y: number) => {
      act(() => {
        page.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            button: 0,
            clientX: x,
            clientY: y,
          }),
        );
      });
    };
    fire('pointerdown', 10, 10);
    fire('pointermove', 60, 40);
    fire('pointerup', 60, 40);
    expect(el.querySelectorAll('[data-box]').length).toBe(1);
    const done = [...el.querySelectorAll('button')].find(
      (b) => b.textContent === 'Done',
    );
    press(done);
    expect(el.textContent).not.toContain('Draw a box around');
    // The page link now flashes the box that was drawn.
    press(link(el));
    wait(10);
    expect(el.querySelector<HTMLElement>('[data-flash]')?.style.left).toBe(
      '10%',
    );
  });

  it('shows the page scrolled to on the tab', () => {
    const el = open('opening');
    wait(300);
    expect(tabs(el)[0]).toContain('p. 111');
    scrollTo(scroller(el), 154 * 757);
    wait(10);
    const n = Number(/p\. (\d+)/.exec(tabs(el)[0] ?? '')?.[1]);
    expect(n).toBeGreaterThan(125);
  });

  it('restores a tab’s place after a tab switch', () => {
    const el = open('two-materials');
    wait(300);
    const first = scroller(el);
    scrollTo(first, 12 * 757);
    wait(10);
    const was = scroller(el)?.scrollTop;
    const t = [...el.querySelectorAll<HTMLElement>('[role=tab]')];
    press(t[1]);
    wait(300);
    press(t[0]);
    wait(300);
    expect(scroller(el)?.scrollTop).toBe(was);
  });
});
