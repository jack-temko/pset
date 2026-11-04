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
const button = (el: Element, name: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent === name);

describe('summary', () => {
  it('folds the calls into one line', () => {
    expect(summary(sample.CALLS)).toBe('Read 3 pages, searched twice');
    expect(summary([])).toBe('Answered without looking anything up');
  });
});

describe('Ask', () => {
  it('turns the live line into the folded summary in the same place', () => {
    const turns = [sample.THINKING];
    const { el } = render(<Ask course="ECE 210" turns={turns} />);
    expect(el.textContent).toContain('Thinking');
    expect(button(el, 'Send')).toBeUndefined();
    expect(button(el, 'Stop')).toBeDefined();
    act(() => {
      render(<Ask course="ECE 210" turns={[sample.DONE]} />);
    });
    expect(document.body.textContent).toContain('Read 3 pages, searched twice');
  });

  it('opens the calls and tells the workspace of a page chip', () => {
    const onPage = vi.fn();
    const { el } = render(
      <Ask course="ECE 210" turns={[sample.DONE]} onPage={onPage} />,
    );
    expect(el.textContent).not.toContain("Searched 'eigenvalue'");
    press(button(el, 'Read 3 pages, searched twice'));
    expect(el.textContent).toContain("Searched 'eigenvalue'");
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
    expect(el.textContent).toContain(
      'Clear 4 questions and their answers? Memories stay.',
    );
    expect(onClear).not.toHaveBeenCalled();
    press(
      [...el.querySelectorAll('button')].find((b) => b.textContent === 'Clear'),
    );
    expect(onClear).toHaveBeenCalledOnce();
  });
});
