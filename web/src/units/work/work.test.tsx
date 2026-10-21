import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { Work } from './index';
import { pageMemory } from './memory';
import { allDone, inProgress } from './sample';
import { nextUnfinished } from './sets';

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
const press = (el: Element | null | undefined) => {
  act(() => {
    el?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
};
const button = (el: Element, name: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent === name);

describe('nextUnfinished', () => {
  it('goes on past the end, and finds nothing when all are done', () => {
    const ps = inProgress().problems;
    expect(nextUnfinished(ps, 'p8')).toBe('p4');
    expect(nextUnfinished(allDone().problems, 'p1')).toBeUndefined();
  });
});

describe('Work', () => {
  it('opens on the first problem to do, and Next marks nothing', () => {
    const { el } = render(<Work set={inProgress()} memory={pageMemory()} />);
    expect(el.querySelector('h2')?.textContent).toContain('Problem 4 ·');
    press(button(el, 'Next'));
    expect(el.querySelector('h2')?.textContent).toContain('Problem 5 ·');
    expect(el.textContent).toContain('3 of 8');
  });

  it('remembers where the student left', () => {
    const memory = pageMemory();
    const first = render(<Work set={inProgress()} memory={memory} />);
    press(button(first.el, 'Next'));
    act(() => {
      first.root.unmount();
    });
    const { el } = render(<Work set={inProgress()} memory={memory} />);
    expect(el.querySelector('h2')?.textContent).toContain('Problem 5 ·');
  });

  it('shows the finish card when the last problem is marked done', () => {
    const set = inProgress();
    set.problems = set.problems.map((p, i) => ({ ...p, done: i !== 7 }));
    const { el } = render(
      <Work set={set} startAt="p8" memory={pageMemory()} />,
    );
    press(button(el, 'Mark done'));
    expect(el.textContent).toContain('All 8 done · 2 h 10 m');
  });
});
