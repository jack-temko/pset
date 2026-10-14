import { Clock } from 'lucide-react';
import { act, createRef, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { Button, REASON_MS } from './button';
import { Link } from './link';
import { Tag } from './tag';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function render(node: ReactNode) {
  const el = document.createElement('div');
  document.body.append(el);
  act(() => {
    createRoot(el).render(node);
  });
  return el;
}

/** A pointer press: a click with a detail above 0, as a mouse or a touch makes. */
function press(b: Element | null | undefined) {
  b?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
}

/** The visible reason line, or an empty string when it is not shown. */
function reason(el: HTMLElement) {
  return el.querySelector('[aria-hidden="true"][id]')?.textContent ?? '';
}

describe('Button', () => {
  it('runs its action on a press', () => {
    const onPress = vi.fn();
    const el = render(<Button onPress={onPress}>Go</Button>);
    act(() => {
      el.querySelector('button')?.click();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores a press while busy and keeps focus', () => {
    const onPress = vi.fn();
    const el = render(
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
    const el = render(<Button busy>Go</Button>);
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
    const el = render(
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

  it('is never disabled: not ready, it takes focus and shows its reason', () => {
    const onPress = vi.fn();
    const el = render(
      <Button notReady="Add a file first." onPress={onPress}>
        Go
      </Button>,
    );
    const b = el.querySelector('button');
    expect(b?.disabled).toBe(false);
    expect(b?.getAttribute('aria-disabled')).toBe('true');
    expect(reason(el)).toBe('');
    act(() => b?.focus());
    expect(document.activeElement).toBe(b);
    expect(reason(el)).toBe('Add a file first.');
    expect(b?.getAttribute('aria-describedby')).toBeTruthy();
    // Focus alone is described, not announced a second time.
    expect(el.querySelector('[role="status"]')?.textContent).toBe('');
    act(() => b?.blur());
    expect(reason(el)).toBe('');
    act(() => {
      press(b);
    });
    expect(reason(el)).toBe('Add a file first.');
    expect(el.querySelector('[role="status"]')?.textContent).toBe(
      'Add a file first.',
    );
    expect(onPress).not.toHaveBeenCalled();
  });

  describe('the reason goes away', () => {
    function shownByClick(notReady = 'Add a file first.') {
      const el = render(<Button notReady={notReady}>Go</Button>);
      const b = el.querySelector('button');
      act(() => {
        press(b);
      });
      expect(reason(el)).toBe(notReady);
      return { el, b };
    }

    it('on Escape', () => {
      const { el, b } = shownByClick();
      act(() => {
        b?.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
      });
      expect(reason(el)).toBe('');
    });

    it('when the pointer leaves after a click-only reveal', () => {
      const { el, b } = shownByClick();
      act(() => {
        b?.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
      });
      expect(reason(el)).toBe('');
    });

    it('treats a pointer press that focuses the button as click-only too', () => {
      const el = render(<Button notReady="Add a file first.">Go</Button>);
      const b = el.querySelector('button');
      act(() => {
        b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        b?.focus();
        press(b);
      });
      expect(reason(el)).toBe('Add a file first.');
      act(() => {
        b?.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
      });
      expect(reason(el)).toBe('');
    });

    it('keeps a focus reveal when the pointer leaves', () => {
      const el = render(<Button notReady="Add a file first.">Go</Button>);
      const b = el.querySelector('button');
      act(() => b?.focus());
      act(() => {
        b?.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
      });
      expect(reason(el)).toBe('Add a file first.');
    });

    it('after 4 seconds of a click-only reveal', () => {
      vi.useFakeTimers();
      try {
        const { el } = shownByClick();
        act(() => {
          vi.advanceTimersByTime(REASON_MS - 1);
        });
        expect(reason(el)).toBe('Add a file first.');
        act(() => {
          vi.advanceTimersByTime(1);
        });
        expect(reason(el)).toBe('');
      } finally {
        vi.useRealTimers();
      }
    });

    it('when notReady changes or clears', () => {
      const el = document.createElement('div');
      document.body.append(el);
      const root = createRoot(el);
      act(() => {
        root.render(<Button notReady="First.">Go</Button>);
      });
      act(() => {
        press(el.querySelector('button'));
      });
      expect(reason(el)).toBe('First.');
      act(() => {
        root.render(<Button notReady="Second.">Go</Button>);
      });
      expect(reason(el)).toBe('');
      act(() => {
        press(el.querySelector('button'));
      });
      expect(reason(el)).toBe('Second.');
      act(() => {
        root.render(<Button>Go</Button>);
      });
      act(() => {
        root.render(<Button notReady="Second.">Go</Button>);
      });
      expect(reason(el)).toBe('');
    });
  });
});

describe('Link', () => {
  it('renders an anchor with its href', () => {
    const el = render(<Link href="/course">Open</Link>);
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/course');
  });

  it('passes onClick and a ref through to the anchor', () => {
    const onClick = vi.fn((e: { preventDefault: () => void }) => {
      e.preventDefault();
    });
    const ref = createRef<HTMLAnchorElement>();
    const el = render(
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
    const el = render(
      <Tag tone="attention" icon={Clock}>
        due Fri
      </Tag>,
    );
    expect(el.querySelector('a, button, [tabindex]')).toBeNull();
    expect(el.textContent).toBe('due Fri');
  });
});
