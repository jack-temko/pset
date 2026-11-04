import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { List, LIST_CAP } from '@/units/list';
import { ListPage } from './index';
import { MANY, MEMORIES, TODAY, WORK } from './sample';

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
afterEach(() => {
  for (const r of roots.splice(0))
    act(() => {
      r.unmount();
    });
  document.body.innerHTML = '';
});

const press = (el: Element) => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};
const radio = (el: HTMLElement, text: string) =>
  [...el.querySelectorAll('[role="radio"]')].find((b) =>
    b.textContent.startsWith(text),
  ) as HTMLElement;
const links = (el: HTMLElement) =>
  el.querySelectorAll('a[href="#"]:not(header a)').length;

describe('List', () => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => <p key={i}>row {i}</p>);

  it('caps its rows and ends in "Show all N"', () => {
    const el = render(
      <List cap={LIST_CAP} showAllHref="/all">
        {rows(8)}
      </List>,
    );
    expect(el.querySelectorAll('p')).toHaveLength(LIST_CAP);
    const a = el.querySelector('a');
    expect(a?.textContent).toBe('Show all 8');
    expect(a?.getAttribute('href')).toBe('/all');
  });

  it('has no foot at or under the cap', () => {
    const el = render(<List cap={LIST_CAP}>{rows(5)}</List>);
    expect(el.querySelector('a')).toBeNull();
  });

  it('shows the switch with both counts and swaps by choice only', () => {
    const el = render(
      <List
        states={[
          { id: 'todo', label: 'To do', count: 0 },
          { id: 'done', label: 'Done', count: 6 },
        ]}
        state="todo"
        empty="Nothing to do"
      />,
    );
    expect(el.textContent).toContain('To do0');
    expect(el.textContent).toContain('Done6');
    expect(el.textContent).toContain('Nothing to do');
  });
});

describe('ListPage', () => {
  it('starts from where Show all came from', () => {
    const el = render(
      <ListPage
        page={WORK}
        today={TODAY}
        initial={{ course: 'ECE 210', state: 'done' }}
      />,
    );
    expect(el.querySelector('header')?.textContent).toContain('ECE 210');
    expect(radio(el, 'Done').getAttribute('aria-checked')).toBe('true');
    expect(el.textContent).not.toContain('Circuits I');
    expect(links(el)).toBeGreaterThan(0);
  });

  it('names the course in each row when it spans courses', () => {
    const el = render(<ListPage page={WORK} today={TODAY} />);
    expect(el.textContent).toContain('Circuits I');
  });

  it('switches state by the header switch and keeps both counts', () => {
    const el = render(<ListPage page={WORK} today={TODAY} />);
    expect(radio(el, 'To do').textContent).toBe('To do8');
    press(radio(el, 'Done'));
    expect(radio(el, 'Done').getAttribute('aria-checked')).toBe('true');
    expect(radio(el, 'To do').textContent).toBe('To do8');
    expect(el.textContent).toContain('Finished');
  });

  it('says no sets match and Clear filters brings them back', () => {
    const el = render(
      <ListPage page={WORK} today={TODAY} initial={{ query: 'zzz' }} />,
    );
    expect(el.textContent).toContain('No sets match');
    const clear = [...el.querySelectorAll('button')].find(
      (b) => b.textContent === 'Clear filters',
    );
    if (!clear) throw new Error('no Clear filters');
    press(clear);
    expect(el.textContent).not.toContain('No sets match');
    expect(el.textContent).toContain('Problem set');
  });

  it('shows every match with no cap', () => {
    const el = render(
      <ListPage page={MANY} today={TODAY} initial={{ state: 'done' }} />,
    );
    expect(el.querySelectorAll('[role="radio"]')[1].textContent).toBe(
      `Done${String(MANY.items.filter((s) => 'finished' in s && s.finished).length)}`,
    );
    expect(el.textContent).not.toContain('Show all');
    expect(links(el)).toBeGreaterThan(200);
  });

  it('puts memories behind "Yours 12" and "From Ask 8"', () => {
    const el = render(<ListPage page={MEMORIES} today={TODAY} />);
    expect(radio(el, 'Yours').textContent).toBe('Yours12');
    expect(radio(el, 'From Ask').textContent).toBe('From Ask8');
  });
});
