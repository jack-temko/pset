import { Clock } from 'lucide-react';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';
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

describe('Button', () => {
  it('runs its action on a press', () => {
    const onPress = vi.fn();
    const el = render(<Button onPress={onPress}>Go</Button>);
    act(() => el.querySelector('button')?.click());
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

  it('is never disabled: not ready, it takes focus and shows its reason', () => {
    const onPress = vi.fn();
    const el = render(
      <Button notReady="Add a file first." onPress={onPress}>
        Go
      </Button>,
    );
    const b = el.querySelector('button');
    const live = el.querySelector('[aria-live="polite"]');
    expect(b?.disabled).toBe(false);
    expect(b?.getAttribute('aria-disabled')).toBe('true');
    expect(live?.textContent).toBe('');
    act(() => b?.focus());
    expect(document.activeElement).toBe(b);
    expect(live?.textContent).toBe('Add a file first.');
    act(() => b?.blur());
    expect(live?.textContent).toBe('');
    act(() => b?.click());
    expect(live?.textContent).toBe('Add a file first.');
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Link', () => {
  it('renders an anchor with its href', () => {
    const el = render(<Link href="/course">Open</Link>);
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/course');
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
