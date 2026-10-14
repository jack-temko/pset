import { Clock } from 'lucide-react';
import { act, createRef, type ReactNode } from 'react';
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
