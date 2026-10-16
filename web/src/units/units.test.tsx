import { Clock } from 'lucide-react';
import { act, createRef, StrictMode, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button, REASON_MS } from './button';
import { Counter } from './counter';
import { AssignmentRow } from './assignment-row';
import { ASSIGNMENT_CAP, listAssignments } from './assignment-row/listed';
import { openedAgo } from './assignment-row/opened';
import { CourseRow } from './course-row';
import { Link } from './link';
import { List } from './list';
import { ListRow } from './list-row';
import { narrowOnly } from './list-row/meta';
import { ProgressBar } from './progress-bar';
import { SectionHeading } from './section-heading';
import { SetLine } from './set-line';
import { daysUntil, dueText, parseDueDate, timeLeft } from './set-line/dates';
import { Tag } from './tag';
import { MetaStat } from './list-row/stat';
import { Tooltip } from './tooltip';
import { TopBar } from './top-bar';
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

describe('Tag tones', () => {
  it('draws danger as an outlined pill', () => {
    const { el } = render(
      <Tag tone="danger" icon={Clock}>
        Overdue
      </Tag>,
    );
    const cls = el.firstElementChild?.className ?? '';
    expect(cls).toContain('border-(--ds-danger)');
    expect(cls).toContain('rounded-full');
    expect(cls).toContain('text-(--ds-danger)');
  });
});

describe('Link options', () => {
  const cls = (n: ReactNode) =>
    render(n).el.querySelector('a')?.className ?? '';

  it('takes a tone, a weight and a size', () => {
    expect(cls(<Link href="/x">A</Link>)).toContain('text-(--ds-accent)');
    expect(
      cls(
        <Link href="/x" tone="fg">
          A
        </Link>,
      ),
    ).toContain('text-(--ds-fg)');
    expect(
      cls(
        <Link href="/x" tone="muted">
          A
        </Link>,
      ),
    ).toContain('text-(--ds-fg-muted)');
    expect(
      cls(
        <Link href="/x" weight="medium">
          A
        </Link>,
      ),
    ).toContain('font-medium');
    expect(cls(<Link href="/x">A</Link>)).not.toContain('font-medium');
    expect(
      cls(
        <Link href="/x" size="small">
          A
        </Link>,
      ),
    ).toContain('ds-small');
    expect(
      cls(
        <Link href="/x" size="brand">
          A
        </Link>,
      ),
    ).toContain('ds-brand');
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

describe('ProgressBar', () => {
  it('sizes the count to "99 of 99", so the bar is the same on every row', () => {
    const count = (d: number, t: number) =>
      render(<ProgressBar done={d} total={t} />).el.querySelector(
        '[data-bar] + span',
      );
    for (const [d, t] of [
      [2, 6],
      [12, 30],
    ] as const) {
      expect(count(d, t)?.className).toContain("before:content-['99_of_99']");
      expect(count(d, t)?.className).toContain('items-end');
    }
  });

  const bar = (el: HTMLElement) =>
    el.querySelector<HTMLElement>('[data-bar="continuous"]');
  const fill = (el: HTMLElement) =>
    el.querySelector<HTMLElement>('[data-bar="continuous"] > span');

  it('draws one continuous bar with the count in words', () => {
    const { el } = render(<ProgressBar done={2} total={6} />);
    expect(el.querySelectorAll('[data-bar]')).toHaveLength(1);
    expect(el.querySelector('[data-segment]')).toBeNull();
    expect(el.textContent).toBe('2 of 6');
  });

  it('fills the bar to the done share', () => {
    expect(
      fill(render(<ProgressBar done={15} total={30} />).el)?.style.width,
    ).toBe('50%');
    expect(
      fill(render(<ProgressBar done={1} total={4} />).el)?.style.width,
    ).toBe('25%');
    expect(
      fill(render(<ProgressBar done={0} total={4} />).el)?.style.width,
    ).toBe('0%');
  });

  it('draws the done share in accent, grey only when every problem is done', () => {
    expect(
      fill(render(<ProgressBar done={2} total={6} />).el)?.className,
    ).toContain('--ds-accent');
    expect(
      fill(render(<ProgressBar done={6} total={6} />).el)?.className,
    ).toContain('--ds-fg-muted');
  });

  it('keeps done between 0 and total', () => {
    const { el } = render(<ProgressBar done={9} total={4} />);
    expect(el.textContent).toBe('4 of 4');
    expect(fill(el)?.style.width).toBe('100%');
  });

  it('keeps its count whole while the bar shrinks under a tiny container', () => {
    const { el } = render(
      <div className="w-[96px]">
        <ProgressBar done={1} total={30} />
      </div>,
    );
    expect(bar(el)?.className).toContain('flex-1');
    expect(bar(el)?.className).toContain('min-w-4');
    expect(el.querySelector('.shrink-0')?.textContent).toBe('1 of 30');
  });

  it('sets its count in the body step', () => {
    const { el } = render(<ProgressBar done={1} total={6} />);
    expect(el.querySelector('.shrink-0')?.className).toContain('ds-body');
  });
});

describe('Counter', () => {
  it('holds a number in a pill and never truncates it', () => {
    const { el } = render(<Counter>1,234</Counter>);
    const c = el.firstElementChild;
    expect(c?.textContent).toBe('1,234');
    expect(c?.className).toContain('rounded-full');
    expect(c?.className).toContain('--ds-pressed');
    expect(c?.className).toContain('h-5');
    expect(c?.className).toContain('px-2');
    expect(c?.className).toContain('whitespace-nowrap');
    expect(c?.className).not.toContain('truncate');
    expect(c?.className).toContain('ds-tabular');
  });
});

describe('SectionHeading', () => {
  it('shows the title as a heading, with no counter or action alone', () => {
    const { el } = render(<SectionHeading>Courses</SectionHeading>);
    expect(el.querySelector('h2')?.textContent).toBe('Courses');
    expect(el.textContent).toBe('Courses');
  });

  it('puts the Counter right after the title and the action at the right', () => {
    const { el } = render(
      <SectionHeading count={8} action={<Link href="/all">Show all</Link>}>
        Courses
      </SectionHeading>,
    );
    const title = el.querySelector('h2');
    expect(title?.parentElement?.textContent).toBe('Courses8');
    expect(title?.parentElement?.querySelector('.rounded-full')).not.toBeNull();
    // Count and action sit centred on the title's line: 28px boxes.
    const countBox =
      title?.parentElement?.querySelector('.rounded-full')?.parentElement;
    expect(countBox?.className).toContain('h-7');
    expect(countBox?.className).toContain('items-center');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/all');
    const actionBox = el.querySelector('a')?.parentElement;
    expect(actionBox?.className).toContain('h-7');
    expect(actionBox?.className).toContain('items-center');
    expect(el.querySelector('a')?.parentElement?.className).toContain(
      'shrink-0',
    );
  });

  it('is at least 32 high, has no rule and no outer margin', () => {
    const { el } = render(<SectionHeading count={1}>Courses</SectionHeading>);
    const cls = el.firstElementChild?.className ?? '';
    expect(cls).toContain('min-h-8');
    expect(cls).not.toContain('border');
    expect(cls).not.toMatch(/(^|\s)m[tby]?-/);
  });
});

describe('ListRow', () => {
  it('makes only the title a link, and plain text without an href', () => {
    const a = render(<ListRow title="Circuits I" href="/c" meta={['x']} />);
    expect(a.el.querySelectorAll('a')).toHaveLength(1);
    expect(a.el.querySelector('a')?.getAttribute('href')).toBe('/c');
    const b = render(<ListRow title="Circuits I" />);
    expect(b.el.querySelector('a')).toBeNull();
    expect(b.el.textContent).toBe('Circuits I');
  });

  it('joins its meta with a middle dot and keeps meta links out of the title link', () => {
    const { el } = render(
      <ListRow
        title="T"
        href="/c"
        meta={[
          <Link key="s" href="/s">
            Set
          </Link>,
          '2 of 6',
        ]}
      />,
    );
    expect(el.querySelector('p')?.textContent).toBe('Set \u00b7 2 of 6');
    expect(el.querySelector('a a')).toBeNull();
    expect(el.querySelectorAll('a')).toHaveLength(2);
  });

  it('shows a status, and an aside of the width it is given, hidden when narrow', () => {
    const { el } = render(
      <ListRow title="T" status="Due Fri" aside="bar" asideWidth={96} />,
    );
    expect(el.textContent).toContain('Due Fri');
    const aside = el.querySelector<HTMLElement>('[data-aside]');
    expect(aside?.style.width).toBe('96px');
    expect(aside?.className).toContain('hidden');
    expect(aside?.className).toContain('@min-[440px]:block');
  });

  it('puts a label after the title, and gives the row no hover ground', () => {
    const { el } = render(<ListRow title="T" href="/t" label="Soon" />);
    const line = el.querySelector('.min-h-6');
    expect(line?.textContent).toBe('TSoon');
    expect(line?.className).toContain('gap-2');
    expect(el.innerHTML).not.toContain('hover:bg');
    expect(el.querySelector('a')?.className).toContain('w-fit');
  });

  it('draws a MetaStat as a muted icon and number inside the meta line', () => {
    const { el } = render(
      <ListRow
        title="T"
        meta={[
          'Set',
          <MetaStat key="s" icon={Clock} value={3} label="3 sets" />,
        ]}
      />,
    );
    const p = el.querySelector('p');
    expect(p?.textContent).toBe('Set3');
    expect(p?.querySelector('span:last-child')?.className).toContain('ml-3');
    expect(p?.querySelector('svg')?.getAttribute('class')).toContain('size-3');
  });

  it('shows a narrow-only item only where the aside is not', () => {
    const { el } = render(
      <ListRow title="T" meta={['a', narrowOnly('2 of 6')]} />,
    );
    const spans = el.querySelectorAll('p > span');
    expect(spans[1]?.className).toContain('@min-[440px]:hidden');
    expect(spans[1]?.textContent).toBe(' \u00b7 2 of 6');
  });

  it('sits the status at the right of the row, out of line one', () => {
    const { el } = render(
      <ListRow title="T" status="Due Fri" aside="bar" asideWidth={96} />,
    );
    const status = el.querySelector('.h-6.items-center');
    expect(status?.textContent).toBe('Due Fri');
    // A child of the row itself, beside the aside, and never in the title's line.
    expect(status?.parentElement).toBe(
      el.querySelector('[data-aside]')?.parentElement,
    );
    expect(status?.closest('.min-h-6')).toBeNull();
    expect(el.querySelector('.min-h-6')).not.toBeNull();
  });

  it('is at least 56 high and truncates its lines', () => {
    const { el } = render(<ListRow title="T" meta={['a']} />);
    expect(el.firstElementChild?.className).toContain('min-h-14');
    expect(el.querySelector('p')?.className).toContain('truncate');
  });
});

describe('List', () => {
  it('has no header without a title, and rules between rows only', () => {
    const { el } = render(
      <List>
        <ListRow title="A" />
        <ListRow title="B" />
      </List>,
    );
    expect(el.querySelector('h2')).toBeNull();
    expect(el.querySelector('.divide-y')).not.toBeNull();
    expect(el.textContent).toBe('AB');
  });

  it('draws a header with a title, a Counter and an action', () => {
    const { el } = render(
      <List title="Courses" count={8} action={<Link href="/all">All</Link>}>
        <ListRow title="A" />
      </List>,
    );
    expect(el.querySelector('h2')?.textContent).toBe('Courses');
    expect(el.querySelector('.rounded-full')?.textContent).toBe('8');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/all');
  });

  it('says one muted line when empty, with its own text if given', () => {
    expect(render(<List title="T" />).el.textContent).toContain(
      'Nothing here yet',
    );
    expect(render(<List empty="No courses" />).el.textContent).toBe(
      'No courses',
    );
    expect(render(<List>{false}</List>).el.textContent).toBe(
      'Nothing here yet',
    );
  });
});

describe('SetLine', () => {
  const today = new Date(2026, 9, 13);
  const day = (d: number) => new Date(2026, 9, d);
  const line = (p: Partial<Parameters<typeof SetLine>[0]> = {}) =>
    render(
      <SetLine
        set="Problem set 4"
        done={2}
        total={6}
        href="/set/4"
        today={today}
        {...p}
      />,
    );

  it('opens the set from its title, carrying every fact', () => {
    const { el } = line({ minutesLeft: 70, due: day(19) });
    const a = el.querySelectorAll('a');
    expect(a).toHaveLength(1);
    expect(a[0]?.getAttribute('href')).toBe('/set/4');
    const text = el.textContent;
    for (const part of [
      'Problem set 4',
      '2 of 6',
      'About 1 h 10 m left',
      'Due Mon',
    ])
      expect(text).toContain(part);
  });

  it('badges a due date only within 2 days, and writes it by the weekday within 6', () => {
    const tag = (d: number) => line({ due: day(d) }).el.querySelector('svg');
    expect(tag(13)).not.toBeNull();
    expect(tag(15)).not.toBeNull();
    expect(tag(16)).toBeNull();
    // The badge sits beside the date, never in its place.
    const soon = line({ due: day(15) }).el.textContent;
    expect(soon).toContain('Due soon');
    expect(soon).toContain('Due Thu');
    expect(line({ due: day(16) }).el.textContent).not.toContain('Due soon');
    expect(line({ due: day(15) }).el.textContent).toContain('Due Thu');
    expect(line({ due: day(16) }).el.textContent).toContain('Due Fri');
    expect(line({ due: day(19) }).el.textContent).toContain('Due Mon');
    expect(line({ due: day(20) }).el.textContent).toContain('Due Oct 20');
    expect(line({ due: day(20) }).el.querySelector('svg')).toBeNull();
  });

  it('shows Overdue in the danger tone, beside the date', () => {
    for (const d of [12, 4]) {
      const { el } = line({ due: day(d) });
      expect(el.textContent).toContain('Overdue');
      expect(el.textContent).toContain(`Due Oct ${String(d)}`);
      expect(el.querySelector('svg')).not.toBeNull();
      expect(el.innerHTML).toContain('--ds-danger');
    }
  });

  it('counts days across a month boundary and a late evening', () => {
    const lateOct = new Date(2026, 9, 31, 23, 59);
    expect(daysUntil(new Date(2026, 10, 1), lateOct)).toBe(1);
    expect(dueText(new Date(2026, 10, 1), lateOct)).toEqual({
      kind: 'soon',
      text: 'Due Sun',
    });
    expect(dueText(new Date(2026, 10, 9), lateOct).text).toBe('Due Nov 9');
    const late = new Date(2026, 9, 13, 23, 30);
    expect(dueText(day(13), late).kind).toBe('soon');
    expect(dueText(day(12), late).kind).toBe('overdue');
  });

  it('builds a due date in local time', () => {
    const d = parseDueDate('2026-10-19');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 19]);
    expect(d.getHours()).toBe(0);
    expect(() => parseDueDate('Oct 19')).toThrow();
  });

  it('shows no status without a date, and no time when unknown', () => {
    const { el } = line({ due: undefined });
    expect(el.textContent).not.toMatch(/Due|Overdue|No date/);
    expect(el.querySelector('svg')).toBeNull();
    expect(el.textContent).not.toContain('left');
  });

  it('keeps the count in the meta where the bar is not drawn', () => {
    const { el } = line({});
    const count = [...el.querySelectorAll('p > span')].find((n) =>
      n.textContent.includes('2 of 6'),
    );
    expect(count?.className).toContain('@min-[440px]:hidden');
  });

  it('writes the time left', () => {
    expect(timeLeft(45)).toBe('About 45 m left');
    expect(timeLeft(60)).toBe('About 1 h left');
    expect(timeLeft(70)).toBe('About 1 h 10 m left');
    expect(timeLeft(59.7)).toBe('About 1 h left');
    expect(timeLeft(119.7)).toBe('About 2 h left');
    expect(timeLeft(0)).toBe('');
    expect(timeLeft(-5)).toBe('');
    expect(timeLeft(0.2)).toBe('');
  });

  it('is a two-line list row, at least 56 high', () => {
    const { el } = line({ set: 'x'.repeat(70) });
    expect(el.firstElementChild?.className).toContain('min-h-14');
    expect(el.querySelector('[data-aside]')).not.toBeNull();
  });
});

describe('CourseRow', () => {
  const today = new Date(2026, 9, 13, 12);
  const ago = (h: number) => new Date(today.getTime() - h * 3_600_000);
  const row = (p: Partial<Parameters<typeof CourseRow>[0]> = {}) =>
    render(
      <CourseRow
        name="Circuits I"
        href="/c/1"
        todo={3}
        materials={7}
        openedAt={ago(26)}
        weekMinutes={130}
        today={today}
        {...p}
      />,
    ).el;

  it('has the name alone on line one, and the stats and opened on line two', () => {
    const el = row();
    const a = el.querySelectorAll('a');
    expect(a).toHaveLength(1);
    expect(a[0]?.getAttribute('href')).toBe('/c/1');
    expect(el.querySelector('.min-h-6')?.textContent).toBe('Circuits I');
    const p = el.querySelector('p');
    expect(p?.textContent).toBe('37Opened yesterday');
    expect(p?.querySelectorAll('svg')).toHaveLength(2);
    expect(p?.textContent).not.toContain('\u00b7');
    expect(el.firstElementChild?.className).toContain('min-h-14');
  });

  it('shows the time this week in the aside, rounded, 0 m for none', () => {
    const aside = (m: number) =>
      row({ weekMinutes: m }).querySelector('[data-aside]')?.textContent;
    expect(aside(130)).toBe('2 h 10 m this week');
    expect(aside(45)).toBe('45 m this week');
    expect(aside(59.7)).toBe('1 h this week');
    expect(aside(0)).toBe('0 m this week');
    expect(row().querySelector<HTMLElement>('[data-aside]')?.style.width).toBe(
      'clamp(160px, 20cqw, 320px)',
    );
  });

  it('shows no sets, badge, bar or date, and nothing opened when never', () => {
    const el = row({ openedAt: undefined });
    expect(el.querySelector('p')?.textContent).toBe('37');
    expect(el.querySelector('[data-bar]')).toBeNull();
    expect(el.textContent).not.toMatch(/Due|Overdue/);
  });

  it('shows zero as 0', () => {
    expect(
      row({ todo: 0, materials: 0 }).querySelector('p')?.textContent,
    ).toMatch(/^00/);
  });
});

describe('AssignmentRow', () => {
  const today = new Date(2026, 9, 13, 12);
  const ago = (h: number) => new Date(today.getTime() - h * 3_600_000);
  const row = (p: Partial<Parameters<typeof AssignmentRow>[0]> = {}) =>
    render(
      <AssignmentRow
        set="Problem set 4"
        href="/s/4"
        course="Circuits I"
        courseHref="/c/1"
        done={2}
        total={6}
        minutesLeft={70}
        due={new Date(2026, 9, 18)}
        reason="due"
        today={today}
        {...p}
      />,
    ).el;

  it('opens the set from its name and the course from the meta', () => {
    const el = row();
    const a = [...el.querySelectorAll('a')];
    expect(a.map((x) => x.getAttribute('href'))).toEqual(['/s/4', '/c/1']);
    expect(el.querySelector('p')?.textContent).toBe(
      'Circuits I \u00b7 2 of 6 \u00b7 About 1 h 10 m left',
    );
    expect(el.querySelector('[data-bar]')).not.toBeNull();
  });

  it('shows the badge and the date together', () => {
    const soon = row({ due: new Date(2026, 9, 15) });
    expect(soon.textContent).toContain('Due soon');
    expect(soon.textContent).toContain('Due Thu');
    const late = row({ due: new Date(2026, 9, 10) });
    expect(late.textContent).toContain('Overdue');
    expect(late.textContent).toContain('Due Oct 10');
    const later = row();
    expect(later.textContent).toContain('Due Sun');
    expect(later.querySelector('svg')).toBeNull();
  });

  it('says when it was opened only for an opened one', () => {
    expect(row({ reason: 'due', openedAt: ago(2) }).textContent).not.toContain(
      'Opened',
    );
    const el = row({ reason: 'opened', openedAt: ago(2), due: undefined });
    expect(el.querySelector('p')?.textContent).toContain('Opened 2 h ago');
    expect(el.textContent).not.toMatch(/Due/);
    expect(openedAgo(ago(0.01), today)).toBe('Opened just now');
    expect(openedAgo(ago(0.5), today)).toBe('Opened 30 m ago');
    expect(openedAgo(ago(72), today)).toBe('Opened 3 d ago');
    expect(openedAgo(ago(30), today)).toBe('Opened yesterday');
    expect(openedAgo(ago(24 * 10), today)).toBe('Opened Oct 3');
  });

  it('leaves the time out when unknown', () => {
    expect(row({ minutesLeft: undefined }).textContent).not.toContain('left');
  });
});

describe('listAssignments', () => {
  const today = new Date(2026, 9, 13, 12);
  const ago = (d: number) => new Date(today.getTime() - d * 86_400_000);
  const due = (d: number) => new Date(2026, 9, d);
  const s = (n: string, p: { due?: Date; openedAt?: Date } = {}) => ({
    n,
    ...p,
  });

  it('lists sets due within 7 days or opened in the last 7, due ones first', () => {
    const { shown, more } = listAssignments(
      [
        s('opened', { openedAt: ago(1) }),
        s('late', { due: due(20) }),
        s('far', { due: due(21), openedAt: ago(8) }),
        s('past', { due: due(9) }),
        s('soon', { due: due(14) }),
        s('older', { openedAt: ago(5) }),
      ],
      today,
    );
    expect(shown.map((x) => `${x.n}:${x.reason}`)).toEqual([
      'past:due',
      'soon:due',
      'late:due',
      'opened:opened',
      'older:opened',
    ]);
    expect(more).toBe(0);
  });

  it('caps at five and counts the rest', () => {
    const sets = Array.from({ length: 8 }, (_, i) =>
      s(String(i), { due: due(14 + (i % 4)) }),
    );
    const { shown, more } = listAssignments(sets, today);
    expect(shown).toHaveLength(ASSIGNMENT_CAP);
    expect(more).toBe(3);
  });
});

describe('TopBar', () => {
  const links = (el: HTMLElement) =>
    [...el.querySelectorAll('a')].map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ]);

  it('on Home has the wordmark and Settings only', () => {
    const { el } = render(<TopBar homeHref="/" settingsHref="/settings" />);
    expect(links(el)).toEqual([
      ['PSet', '/'],
      ['Settings', '/settings'],
    ]);
    expect(el.querySelector('ol')?.children).toHaveLength(0);
  });

  it('links every path item but the last', () => {
    const { el } = render(
      <TopBar
        homeHref="/"
        path={[
          { label: 'Electromagnetics', href: '/c/1' },
          { label: 'Problem set 4' },
        ]}
        settingsHref="/settings"
      />,
    );
    expect(links(el)).toEqual([
      ['PSet', '/'],
      ['Electromagnetics', '/c/1'],
      ['Settings', '/settings'],
    ]);
    expect(el.querySelector('ol')?.textContent).toBe(
      '/Electromagnetics/Problem set 4',
    );
  });

  it('never links the last item, even when it has an href', () => {
    const { el } = render(
      <TopBar
        homeHref="/"
        path={[{ label: 'Electromagnetics', href: '/c/1' }]}
        settingsHref="/s"
      />,
    );
    expect(links(el).map((l) => l[0])).toEqual(['PSet', 'Settings']);
  });

  it('truncates the middle items before the ends and pins the sides', () => {
    const { el } = render(
      <TopBar
        homeHref="/"
        path={[
          { label: 'A', href: '/a' },
          { label: 'B', href: '/b' },
          { label: 'C' },
        ]}
        settingsHref="/s"
      />,
    );
    const items = [...el.querySelectorAll('li')].map((li) => li.className);
    expect(items[1]).toContain('shrink-[4]');
    expect(items[0]).not.toContain('shrink-[4]');
    expect(items[2]).not.toContain('shrink-[4]');
    expect(el.querySelector('a')?.className).toContain('shrink-0');
    expect(el.querySelector('header > a')?.className).toContain('shrink-0');
    expect(el.querySelector('header')?.className).toContain('sticky');
  });
});
