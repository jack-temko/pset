import { Clock } from 'lucide-react';
import { act, createRef, StrictMode, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button, REASON_MS } from './button';
import { Link } from './link';
import { Tag } from './tag';
import { Tooltip } from './tooltip';
import { place } from './tooltip/place';

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
  return { el, root };
}

afterEach(() => {
  act(() => {
    for (const r of roots.splice(0)) r.unmount();
  });
  document.body.replaceChildren();
});

/** A pointer press: a click with a detail above 0, as a mouse or a touch makes. */
function press(b: Element | null | undefined) {
  b?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
}

/** The tooltip text, or an empty string when none is shown. It is drawn in
 *  the top layer or, without the Popover API, in a portal on the body. */
function tip() {
  return document.querySelector('[role="tooltip"]')?.textContent ?? '';
}

describe('Button', () => {
  it('runs its action on a press', () => {
    const onPress = vi.fn();
    const { el } = render(<Button onPress={onPress}>Go</Button>);
    act(() => el.querySelector('button')?.click());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores a press while busy and keeps focus', () => {
    const onPress = vi.fn();
    const { el } = render(
      <Button busy onPress={onPress}>
        Go
      </Button>,
    );
    const b = el.querySelector('button');
    b?.focus();
    act(() => b?.click());
    expect(onPress).not.toHaveBeenCalled();
    expect(b?.getAttribute('aria-busy')).toBe('true');
    expect(b?.disabled).toBe(false);
    expect(document.activeElement).toBe(b);
  });

  it('busy with no icon hides the label, keeps its box and says Working', () => {
    const { el } = render(<Button busy>Go</Button>);
    const label = [...el.querySelectorAll<HTMLElement>('button span')].find(
      (n) => n.style.visibility === 'hidden',
    );
    expect(label?.textContent).toBe('Go');
    // The name stays for assistive tech, and the wait is announced politely.
    expect(el.querySelector('button .sr-only')?.textContent).toBe('Go');
    // Only one copy of the label is exposed: the drawn one is aria-hidden.
    const exposed = [...el.querySelectorAll('button span')].filter(
      (n) => n.textContent === 'Go' && !n.closest('[aria-hidden="true"]'),
    );
    expect(exposed).toHaveLength(1);
    expect(el.querySelector('[role="status"]')?.textContent).toBe('Working');
  });

  it('busy with an icon keeps its label visible', () => {
    const { el } = render(
      <Button busy icon={Clock} busyLabel="Saving">
        Go
      </Button>,
    );
    expect(
      [...el.querySelectorAll<HTMLElement>('button span')].some(
        (n) => n.style.visibility === 'hidden',
      ),
    ).toBe(false);
    expect(el.querySelector('[role="status"]')?.textContent).toBe('Saving');
  });

  describe('not ready', () => {
    it('is never disabled and does not act, but a press opens the tooltip', () => {
      const onPress = vi.fn();
      const { el } = render(
        <Button notReady="Add a file first." onPress={onPress}>
          Go
        </Button>,
      );
      const b = el.querySelector('button');
      expect(b?.disabled).toBe(false);
      expect(b?.getAttribute('aria-disabled')).toBe('true');
      expect(tip()).toBe('');
      act(() => {
        press(b);
      });
      expect(tip()).toBe('Add a file first.');
      expect(onPress).not.toHaveBeenCalled();
    });

    function pressed() {
      const r = render(<Button notReady="Add a file first.">Go</Button>);
      const b = r.el.querySelector('button');
      act(() => {
        press(b);
      });
      expect(tip()).toBe('Add a file first.');
      return { ...r, b };
    }

    it('closes on Escape', () => {
      const { b } = pressed();
      act(() => {
        b?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
      });
      expect(tip()).toBe('');
    });

    it('closes when the pointer leaves the button', () => {
      const { b } = pressed();
      act(() => {
        b?.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
      });
      expect(tip()).toBe('');
    });

    it('closes on blur', () => {
      const { b } = pressed();
      act(() => {
        b?.focus();
      });
      act(() => {
        b?.blur();
      });
      expect(tip()).toBe('');
    });

    it('closes after 4 seconds', () => {
      vi.useFakeTimers();
      try {
        pressed();
        act(() => {
          vi.advanceTimersByTime(REASON_MS - 1);
        });
        expect(tip()).toBe('Add a file first.');
        act(() => {
          vi.advanceTimersByTime(1);
        });
        expect(tip()).toBe('');
      } finally {
        vi.useRealTimers();
      }
    });

    it('closes when notReady changes or clears', () => {
      const { el, root } = render(<Button notReady="First.">Go</Button>);
      act(() => {
        press(el.querySelector('button'));
      });
      expect(tip()).toBe('First.');
      act(() => {
        root.render(<Button notReady="Second.">Go</Button>);
      });
      expect(tip()).toBe('');
      act(() => {
        press(el.querySelector('button'));
      });
      expect(tip()).toBe('Second.');
      act(() => {
        root.render(<Button>Go</Button>);
      });
      expect(tip()).toBe('');
    });

    it('keeps the same button node and its focus when notReady toggles', () => {
      const { el, root } = render(<Button>Go</Button>);
      const b = el.querySelector('button');
      act(() => b?.focus());
      expect(document.activeElement).toBe(b);
      act(() => {
        root.render(<Button notReady="Add a file first.">Go</Button>);
      });
      expect(el.querySelector('button')).toBe(b);
      expect(document.activeElement).toBe(b);
      act(() => {
        root.render(<Button>Go</Button>);
      });
      expect(el.querySelector('button')).toBe(b);
      expect(document.activeElement).toBe(b);
    });

    it('closes on Escape after a press that did not focus the button', () => {
      const { el } = render(<Button notReady="Add a file first.">Go</Button>);
      act(() => {
        press(el.querySelector('button'));
      });
      expect(document.activeElement).not.toBe(el.querySelector('button'));
      expect(tip()).toBe('Add a file first.');
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
      });
      expect(tip()).toBe('');
    });

    it('is forced open by reasonOpen', () => {
      render(
        <Button notReady="Add a file first." reasonOpen>
          Go
        </Button>,
      );
      expect(tip()).toBe('Add a file first.');
    });
  });
});

describe('Tooltip', () => {
  it('shows on hover after 50ms and hides on pointer leave', () => {
    vi.useFakeTimers();
    try {
      const { el } = render(
        <Tooltip text="Why">
          <button type="button">Go</button>
        </Tooltip>,
      );
      const anchor = el.querySelector('button')?.parentElement;
      act(() => {
        anchor?.dispatchEvent(
          new PointerEvent('pointerover', { bubbles: true }),
        );
      });
      act(() => {
        vi.advanceTimersByTime(49);
      });
      expect(tip()).toBe('');
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(tip()).toBe('Why');
      act(() => {
        anchor?.dispatchEvent(
          new PointerEvent('pointerout', { bubbles: true }),
        );
      });
      expect(tip()).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows on focus at once and hides on blur and on Escape', () => {
    const { el } = render(
      <Tooltip text="Why">
        <button type="button">Go</button>
      </Tooltip>,
    );
    const b = el.querySelector('button');
    act(() => b?.focus());
    expect(tip()).toBe('Why');
    act(() => b?.blur());
    expect(tip()).toBe('');
    act(() => b?.focus());
    act(() => {
      b?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });
    expect(tip()).toBe('');
  });

  it('is bounded to 250 wide', () => {
    render(
      <Tooltip text="Why" open>
        <button type="button">Go</button>
      </Tooltip>,
    );
    const cls = document.querySelector('[role="tooltip"]')?.className ?? '';
    expect(cls).toContain('max-w-[250px]');
  });

  it('calls onClose for its own Escape, pointer leave and blur', () => {
    const onClose = vi.fn();
    const { el } = render(
      <Tooltip text="Why" onClose={onClose}>
        <button type="button">Go</button>
      </Tooltip>,
    );
    const b = el.querySelector('button');
    const anchor = b?.parentElement;
    act(() => b?.focus());
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => {
      anchor?.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);
    act(() => b?.blur());
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('draws nothing without text', () => {
    render(
      <Tooltip text={undefined} open>
        <button type="button">Go</button>
      </Tooltip>,
    );
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('takes the popover path and shows once, even under StrictMode', () => {
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
    const open = new WeakSet<Element>();
    const show = vi.fn(function (this: Element) {
      open.add(this);
    });
    const hide = vi.fn();
    // oxlint-disable-next-line typescript/unbound-method -- called back with its own `this` below
    const realMatches = Element.prototype.matches;
    proto.showPopover = show;
    proto.hidePopover = hide;
    const matches = vi
      .spyOn(Element.prototype, 'matches')
      .mockImplementation(function (this: Element, q: string) {
        return q === ':popover-open'
          ? open.has(this)
          : realMatches.call(this, q);
      });
    try {
      render(
        <StrictMode>
          <Tooltip text="Why" open>
            <button type="button">Go</button>
          </Tooltip>
        </StrictMode>,
      );
      const t = document.querySelector('[role="tooltip"]');
      expect(t?.getAttribute('popover')).toBe('manual');
      // Drawn where it is rendered, not in a portal on the body.
      expect(t?.parentElement?.tagName).not.toBe('BODY');
      expect(show).toHaveBeenCalledTimes(1);
    } finally {
      matches.mockRestore();
      delete proto.showPopover;
      delete proto.hidePopover;
    }
  });

  describe('in document coordinates', () => {
    function stubViewport(scrollX: number, scrollY: number) {
      const rect = {
        left: 100,
        top: 100,
        right: 180,
        bottom: 132,
        width: 80,
        height: 32,
      } as DOMRect;
      const r = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockReturnValue(rect);
      const w = vi
        .spyOn(document.documentElement, 'clientWidth', 'get')
        .mockReturnValue(1000);
      const h = vi
        .spyOn(document.documentElement, 'clientHeight', 'get')
        .mockReturnValue(800);
      Object.defineProperty(window, 'scrollX', {
        value: scrollX,
        configurable: true,
      });
      Object.defineProperty(window, 'scrollY', {
        value: scrollY,
        configurable: true,
      });
      return () => {
        r.mockRestore();
        w.mockRestore();
        h.mockRestore();
        Object.defineProperty(window, 'scrollX', {
          value: 0,
          configurable: true,
        });
        Object.defineProperty(window, 'scrollY', {
          value: 0,
          configurable: true,
        });
      };
    }

    it('places itself at the control rect plus the scroll offset, absolutely', () => {
      const restore = stubViewport(20, 300);
      try {
        render(
          <Tooltip text="Why" open>
            <button type="button">Go</button>
          </Tooltip>,
        );
        const t = document.querySelector<HTMLElement>('[role="tooltip"]');
        // Below, centred on the control (width 0 here): 100 + 40, 132 + 4.
        expect(t?.style.left).toBe(`${String(140 + 20)}px`);
        expect(t?.style.top).toBe(`${String(136 + 300)}px`);
        expect(t?.className).toContain('absolute');
        expect(t?.className).not.toContain('fixed');
      } finally {
        restore();
      }
    });

    describe('when its control is covered', () => {
      function setup(forced: boolean) {
        const raf = vi
          .spyOn(window, 'requestAnimationFrame')
          .mockImplementation((cb) => {
            cb(0);
            // Ran synchronously, so there is no frame left to cancel.
            return 0;
          });
        const at = vi.fn<(x: number, y: number) => Element | null>();
        Object.defineProperty(document, 'elementFromPoint', {
          value: at,
          configurable: true,
        });
        const onClose = vi.fn();
        const { el } = render(
          <Tooltip text="Why" open={forced} onClose={onClose}>
            <button type="button">Go</button>
          </Tooltip>,
        );
        const control = el.querySelector('button');
        if (!forced) act(() => control?.focus());
        const scroll = () => {
          act(() => {
            document.dispatchEvent(new Event('scroll'));
          });
        };
        const cleanup = () => {
          raf.mockRestore();
          Reflect.deleteProperty(document, 'elementFromPoint');
        };
        return { at, control, scroll, onClose, cleanup };
      }

      it('closes a hover or focus tooltip on a scroll, and checks the control centre', () => {
        const restore = stubViewport(0, 0);
        const { at, control, scroll, onClose, cleanup } = setup(false);
        try {
          at.mockReturnValue(control);
          scroll();
          expect(tip()).toBe('Why');
          expect(at).toHaveBeenCalledWith(140, 116);
          at.mockReturnValue(document.body);
          scroll();
          expect(tip()).toBe('');
          expect(onClose).toHaveBeenCalledTimes(1);
        } finally {
          cleanup();
          restore();
        }
      });

      it('hides a forced tooltip while covered and shows it again after', () => {
        const restore = stubViewport(0, 0);
        const { at, control, scroll, cleanup } = setup(true);
        try {
          const visibility = () =>
            document.querySelector<HTMLElement>('[role="tooltip"]')?.style
              .visibility;
          at.mockReturnValue(document.body);
          scroll();
          expect(visibility()).toBe('hidden');
          expect(tip()).toBe('Why');
          at.mockReturnValue(control);
          scroll();
          expect(visibility()).toBe('visible');
        } finally {
          cleanup();
          restore();
        }
      });

      it('counts a control outside the window as covered', () => {
        const restore = stubViewport(0, 0);
        const { at, control, scroll, cleanup } = setup(false);
        try {
          at.mockReturnValue(control);
          Object.defineProperty(document.documentElement, 'clientHeight', {
            value: 50,
            configurable: true,
          });
          scroll();
          expect(tip()).toBe('');
        } finally {
          cleanup();
          restore();
        }
      });

      it('removes its listeners once it has closed', () => {
        const restore = stubViewport(0, 0);
        const remove = vi.spyOn(window, 'removeEventListener');
        const { at, scroll, cleanup } = setup(false);
        try {
          at.mockReturnValue(document.body);
          scroll();
          expect(tip()).toBe('');
          expect(remove.mock.calls.some((c) => c[0] === 'scroll')).toBe(true);
          expect(remove.mock.calls.some((c) => c[0] === 'resize')).toBe(true);
        } finally {
          remove.mockRestore();
          cleanup();
          restore();
        }
      });
    });

    it('does nothing for a document scroll, and closes for a nested one', () => {
      const restore = stubViewport(0, 0);
      try {
        const onClose = vi.fn();
        const { el } = render(
          <div id="scroller">
            <Tooltip text="Why" onClose={onClose}>
              <button type="button">Go</button>
            </Tooltip>
          </div>,
        );
        act(() => el.querySelector('button')?.focus());
        const t = document.querySelector<HTMLElement>('[role="tooltip"]');
        const top = t?.style.top;
        act(() => {
          document.dispatchEvent(new Event('scroll'));
        });
        expect(tip()).toBe('Why');
        expect(t?.style.top).toBe(top);
        expect(onClose).not.toHaveBeenCalled();
        act(() => {
          el.querySelector('#scroller')?.dispatchEvent(new Event('scroll'));
        });
        expect(tip()).toBe('');
        expect(onClose).toHaveBeenCalledTimes(1);
      } finally {
        restore();
      }
    });
  });

  it('removes its scroll and resize listeners when it unmounts open', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    try {
      const { root } = render(
        <Tooltip text="Why" open>
          <button type="button">Go</button>
        </Tooltip>,
      );
      for (const type of ['scroll', 'resize']) {
        const added = add.mock.calls.filter((c) => c[0] === type);
        expect(added.length, type).toBeGreaterThan(0);
      }
      act(() => {
        root.unmount();
      });
      roots.splice(roots.indexOf(root), 1);
      for (const type of ['scroll', 'resize']) {
        const added = add.mock.calls.filter((c) => c[0] === type);
        const removed = remove.mock.calls.filter((c) => c[0] === type);
        for (const [, fn] of added)
          expect(
            removed.some(([, f]) => f === fn),
            type,
          ).toBe(true);
      }
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });

  it('fires nothing when it unmounts during the hover delay', () => {
    vi.useFakeTimers();
    try {
      const { el, root } = render(
        <Tooltip text="Why">
          <button type="button">Go</button>
        </Tooltip>,
      );
      act(() => {
        el.querySelector('button')?.parentElement?.dispatchEvent(
          new PointerEvent('pointerover', { bubbles: true }),
        );
      });
      expect(vi.getTimerCount()).toBe(1);
      act(() => {
        root.unmount();
      });
      roots.splice(roots.indexOf(root), 1);
      expect(vi.getTimerCount()).toBe(0);
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(tip()).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  describe('place', () => {
    const view = { width: 1000, height: 800 };
    const size = { width: 100, height: 28 };
    const rect = (x: number, y: number, w = 80, h = 32) =>
      ({
        left: x,
        top: y,
        right: x + w,
        bottom: y + h,
        width: w,
        height: h,
      }) as DOMRect;

    it('goes below, centred, 4 away', () => {
      expect(place(rect(400, 100), size, view, 'below')).toEqual({
        side: 'below',
        left: 390,
        top: 136,
      });
    });

    it('flips above when there is no room below', () => {
      const p = place(rect(400, 780), size, view, 'below');
      expect(p.side).toBe('above');
      expect(p.top).toBe(780 - 4 - 28);
    });

    it('shifts inward at the right edge, keeping 8 from the viewport', () => {
      const p = place(rect(920, 100), size, view, 'below');
      expect(p.side).toBe('below');
      expect(p.left).toBe(1000 - 8 - 100);
    });

    it('shifts inward at the left edge', () => {
      expect(place(rect(0, 100, 20), size, view, 'below').left).toBe(8);
    });

    it('clamps top into the viewport when no side fits', () => {
      const tall = { width: 100, height: 800 };
      const p = place(
        rect(450, 300),
        tall,
        { width: 300, height: 800 },
        'below',
      );
      expect(p.top).toBeGreaterThanOrEqual(8);
      expect(p.top + 800).toBeLessThanOrEqual(800 + 800);
      const small = place(
        rect(100, 10),
        { width: 100, height: 900 },
        view,
        'below',
      );
      expect(small.top).toBe(8);
    });

    it('takes right, then left, when neither above nor below fits', () => {
      const tall = { width: 100, height: 800 };
      expect(place(rect(100, 300), tall, view, 'below').side).toBe('right');
      expect(place(rect(880, 300), tall, view, 'below').side).toBe('left');
    });
  });
});

// jsdom has no layout, so these only prove the classes that bound the width
// are present. The real proof is the stress page in a browser, dragged from
// wide to narrow.
describe('width bounds', () => {
  it('a button never outgrows its container and truncates its label', () => {
    const { el } = render(<Button>A very long label</Button>);
    const b = el.querySelector('button');
    expect(b?.className).toContain('max-w-full');
    expect(b?.className).toContain('whitespace-nowrap');
    expect(b?.parentElement?.className).toContain('max-w-full');
    expect(b?.parentElement?.className).toContain('min-w-0');
    expect(b?.querySelector('span.truncate')?.className).toContain('min-w-0');
  });

  it('a link wraps inside its container, even a long word', () => {
    for (const inline of [true, false]) {
      const { el } = render(
        <Link href="/x" inline={inline}>
          Long
        </Link>,
      );
      const cls = el.querySelector('a')?.className ?? '';
      expect(cls).toContain('max-w-full');
      expect(cls).toContain('[overflow-wrap:anywhere]');
    }
  });

  it('a tag truncates inside its container', () => {
    const { el } = render(<Tag>A very long tag</Tag>);
    const t = el.firstElementChild;
    expect(t?.className).toContain('max-w-full');
    expect(t?.className).toContain('min-w-0');
    expect(t?.querySelector('span.truncate')).not.toBeNull();
  });
});

describe('Link', () => {
  it('renders an anchor with its href', () => {
    const { el } = render(<Link href="/course">Open</Link>);
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/course');
  });

  it('passes onClick and a ref through to the anchor', () => {
    const onClick = vi.fn((e: { preventDefault: () => void }) => {
      e.preventDefault();
    });
    const ref = createRef<HTMLAnchorElement>();
    const { el } = render(
      <Link href="/course" onClick={onClick} ref={ref}>
        Open
      </Link>,
    );
    act(() => el.querySelector('a')?.click());
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(el.querySelector('a'));
  });
});

describe('Tag', () => {
  it('is not focusable', () => {
    const { el } = render(
      <Tag tone="attention" icon={Clock}>
        Due Fri
      </Tag>,
    );
    expect(el.querySelector('a, button, [tabindex]')).toBeNull();
    expect(el.textContent).toBe('Due Fri');
  });
});
