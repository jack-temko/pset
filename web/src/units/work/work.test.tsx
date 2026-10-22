import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { Work } from './index';
import { pageMemory } from './memory';
import { allDone, inProgress } from './sample';
import { nextToDo } from './sets';

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

describe('nextToDo', () => {
  it('goes forward only, and finds nothing after the last', () => {
    const ps = inProgress().problems;
    expect(nextToDo(ps, 'p3')).toBe('p4');
    expect(nextToDo(ps, 'p8')).toBeUndefined();
    expect(nextToDo(allDone().problems, 'p1')).toBeUndefined();
  });
});

describe('Work', () => {
  it('opens on the first problem to do, and Next marks nothing', () => {
    const { el } = render(<Work set={inProgress()} memory={pageMemory()} />);
    expect(el.querySelector('h2')?.textContent).toContain('Problem 3');
    press(button(el, 'Next'));
    expect(el.querySelector('h2')?.textContent).toContain('Problem 4 ·');
    expect(el.querySelectorAll('[aria-label$="· Done"]')).toHaveLength(2);
  });

  it('remembers where the student left', () => {
    const memory = pageMemory();
    const first = render(<Work set={inProgress()} memory={memory} />);
    press(button(first.el, 'Next'));
    act(() => {
      first.root.unmount();
    });
    const { el } = render(<Work set={inProgress()} memory={memory} />);
    expect(el.querySelector('h2')?.textContent).toContain('Problem 4 ·');
  });

  it('opens a finished set on the summary, and a segment goes back', () => {
    const { el } = render(<Work set={allDone()} memory={pageMemory()} />);
    expect(el.textContent).toContain('All 8 done');
    expect(el.textContent).toContain('finished Tue');
    press(el.querySelector('[aria-label^="Problem 2"]'));
    expect(el.querySelector('h2')?.textContent).toContain('Problem 2 ·');
  });

  it('opens the summary from the label, and Next on the last problem goes there', () => {
    const { el } = render(
      <Work set={inProgress()} startAt="p8" memory={pageMemory()} />,
    );
    press(button(el, 'Next'));
    expect(el.textContent).toContain('2 of 8 done');
    press(el.querySelector('[aria-label^="Problem 3"]'));
    press(button(el, 'Summary'));
    expect(el.textContent).toContain('2 of 8 done');
  });

  it('shows the summary when the last problem is marked done', () => {
    const set = inProgress();
    set.problems = set.problems.map((p, i) => ({ ...p, done: i !== 7 }));
    const { el } = render(
      <Work set={set} startAt="p8" memory={pageMemory()} />,
    );
    press(button(el, 'Mark done'));
    expect(el.textContent).toContain('All 8 done');
  });

  it('warns before turning in an unfinished set', () => {
    const { el } = render(
      <Work set={inProgress()} startSummary memory={pageMemory()} />,
    );
    press(button(el, 'Turn in'));
    expect(el.textContent).toContain("6 of 8 aren't done");
  });
});
