import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Ask } from './index';
import * as sample from './sample';
import { summary } from './types';

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
  return { el };
}
afterEach(() => {
  act(() => {
    for (const r of roots.splice(0)) r.unmount();
  });
  document.body.replaceChildren();
});
const press = (el: Element | null | undefined) => {
  act(() => {
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
};
/** A button by its text, or by its name when it is only an icon. */
const button = (el: Element, name: string) =>
  [...el.querySelectorAll('button')].find(
    (b) => b.textContent === name || b.getAttribute('aria-label') === name,
  );

describe('summary', () => {
  it('folds the calls into one line', () => {
    expect(summary(sample.CALLS)).toBe('Searched twice, read 3 pages');
    expect(summary([])).toBe('');
  });
});

describe('Ask', () => {
  it('shows Thinking, then the first step in its place', () => {
    const turns = [sample.THINKING];
    const { el } = render(<Ask course="ECE 210" turns={turns} />);
    expect(el.textContent).toContain('Thinking');
    expect(button(el, 'Send')).toBeUndefined();
    expect(button(el, 'Stop')).toBeDefined();
    act(() => {
      render(<Ask course="ECE 210" turns={[sample.DONE]} />);
    });
    expect(document.body.textContent).toContain('Searched twice, read 3 pages');
  });

  it('opens the calls and tells the workspace of a page chip', () => {
    const onPage = vi.fn();
    const { el } = render(
      <Ask course="ECE 210" turns={[sample.DONE]} onPage={onPage} />,
    );
    expect(el.textContent).not.toContain("Searched 'time constant'");
    press(button(el, 'Searched twice, read 3 pages'));
    expect(el.textContent).toContain("Searched 'time constant'");
    press(button(el, 'p. 142'));
    expect(onPage).toHaveBeenCalledWith('griffiths', 142);
  });

  it('sends the text and the chip, and the box stays editable while answering', () => {
    const onSend = vi.fn();
    const { el } = render(
      <Ask course="ECE 210" turns={[]} about="3.A.4" onSend={onSend} />,
    );
    const box = el.querySelector('textarea');
    expect(box).not.toBeNull();
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )?.set?.call(box, 'Why?');
      box?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    press(button(el, 'Send'));
    expect(onSend).toHaveBeenCalledWith({
      text: 'Why?',
      about: '3.A.4',
      image: undefined,
    });
  });

  it('asks before Clear and counts the turns', () => {
    const onClear = vi.fn();
    const { el } = render(
      <Ask course="ECE 210" turns={sample.HISTORY} onClear={onClear} />,
    );
    press(button(el, 'Clear'));
    expect(el.textContent).toContain('Clear 4 messages? Memories stay.');
    expect(onClear).not.toHaveBeenCalled();
    // The Confirm popover's own Clear, after the trigger.
    press(
      [...el.querySelectorAll('button')]
        .filter((b) => b.textContent === 'Clear')
        .at(-1),
    );
    expect(onClear).toHaveBeenCalledOnce();
  });

  const lineOf = (el: Element, text: string) =>
    [...el.querySelectorAll('p, button')].find(
      (n) => n.textContent === text && n.className.includes('ds-small-line'),
    );

  it('keeps a step row the same height running, done and with nothing before it', () => {
    const live = render(<Ask course="ECE 210" turns={[sample.IN_FLIGHT]} />);
    expect(lineOf(live.el, "Searching 'time constant'")).toBeDefined();
    const think = render(<Ask course="ECE 210" turns={[sample.THINKING]} />);
    expect(lineOf(think.el, 'Thinking')).toBeDefined();
    const done = render(<Ask course="ECE 210" turns={[sample.MID]} />);
    expect(lineOf(done.el, 'Searched twice, read 3 pages')).toBeDefined();
  });

  it('has no step row for an answer with no steps, and only a mark while writing', () => {
    const none = render(
      <Ask course="ECE 210" turns={[sample.REMEMBERED, sample.FAILED_SETUP]} />,
    );
    expect(none.el.textContent).not.toContain('Answered without');
    expect(none.el.textContent).toContain('Open Settings');
    const writing = render(<Ask course="ECE 210" turns={[sample.STREAMING]} />);
    expect(writing.el.textContent).not.toContain('Writing');
    expect(writing.el.querySelector('[aria-label="Writing"]')).not.toBeNull();
    const stopped = render(<Ask course="ECE 210" turns={[sample.STOPPED]} />);
    expect(stopped.el.textContent).toContain('Stopped');
    expect(stopped.el.querySelector('[aria-label="Writing"]')).toBeNull();
  });

  it('puts steps where they happened and tags what is not from the course', () => {
    const { el } = render(<Ask course="ECE 210" turns={[sample.DONE]} />);
    const rows = [...el.querySelectorAll('[data-copy-skip]')];
    expect(rows).toHaveLength(2);
    expect(rows[0].nextElementSibling?.textContent).toContain('The voltage');
    expect(el.textContent).toContain('Not from your course');
  });

  it('keeps the box editable while answering, and Stop stops', () => {
    const onStop = vi.fn();
    const { el } = render(
      <Ask course="ECE 210" turns={[sample.THINKING]} onStop={onStop} />,
    );
    expect(el.querySelector('textarea')?.disabled).toBe(false);
    press(button(el, 'Stop'));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('opens with the chip in and the cursor in the box', () => {
    const { el } = render(
      <Ask course="ECE 210" turns={[]} about="3.A.4" focusBox />,
    );
    expect(el.textContent).toContain('About 3.A.4');
    expect(document.activeElement).toBe(el.querySelector('textarea'));
  });

  it('stops the text at 680 and lets a table use the width', () => {
    const { el } = render(<Ask course="ECE 210" turns={[sample.DONE]} />);
    expect(el.querySelector('p.ds-reading')?.className).toContain(
      'max-w-[680px]',
    );
    expect(el.querySelector('table')?.parentElement?.className).not.toContain(
      '680',
    );
  });

  it('retries a failed turn, and clearing asks with the action before Cancel', () => {
    const onRetry = vi.fn();
    const failed = render(
      <Ask course="ECE 210" turns={[sample.FAILED]} onRetry={onRetry} />,
    );
    press(button(failed.el, 'Try again'));
    expect(onRetry).toHaveBeenCalledWith('e');
    const { el } = render(<Ask course="ECE 210" turns={sample.HISTORY} />);
    press(button(el, 'Clear'));
    const order = [...el.querySelectorAll('[role="alertdialog"] button')].map(
      (b) => b.textContent,
    );
    expect(order).toEqual(['Clear', 'Cancel']);
  });

  it('takes a pasted image and removes it', async () => {
    const { el } = render(<Ask course="ECE 210" turns={[]} />);
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', {
      value: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    act(() => {
      el.querySelector('textarea')?.dispatchEvent(paste);
    });
    await vi.waitFor(() => {
      expect(el.querySelector('img')).not.toBeNull();
    });
    press(el.querySelector('[aria-label="Remove the image"]'));
    expect(el.querySelector('img')).toBeNull();
  });
});
