import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { List, LIST_CAP } from '@/units/list';
import { ListPage } from './index';
import {
  COURSE_LIST,
  MANY,
  MANY_SETS,
  MEMORIES,
  TODAY,
  WORK,
  WORK_SETS,
} from './sample';

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
const course = () => '#';
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
    const el = render(
      <List cap={LIST_CAP} showAllHref="/all">
        {rows(5)}
      </List>,
    );
    expect(el.querySelector('a')).toBeNull();
  });

  it('shows both counts and swaps the rows when the other side is pressed', () => {
    function Wrapper() {
      const [state, setState] = useState('todo');
      return (
        <List
          states={[
            { id: 'todo', label: 'To do', count: 1 },
            { id: 'done', label: 'Done', count: 2 },
          ]}
          state={state}
          onState={setState}
        >
          {state === 'todo' ? (
            <p>open row</p>
          ) : (
            [<p key="a">closed a</p>, <p key="b">closed b</p>]
          )}
        </List>
      );
    }
    const el = render(<Wrapper />);
    expect(radio(el, 'To do').textContent).toBe('To do1');
    expect(radio(el, 'Done').textContent).toBe('Done2');
    expect(el.textContent).toContain('open row');
    press(radio(el, 'Done'));
    expect(el.textContent).not.toContain('open row');
    expect(el.textContent).toContain('closed a');
    expect(radio(el, 'Done').getAttribute('aria-checked')).toBe('true');
    expect(radio(el, 'To do').textContent).toBe('To do1');
  });

  it('stays on an empty side with one quiet line', () => {
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
    expect(radio(el, 'Done').textContent).toBe('Done6');
    expect(radio(el, 'To do').getAttribute('aria-checked')).toBe('true');
    expect(el.textContent).toContain('Nothing to do');
  });
});

describe('ListPage', () => {
  it('starts from where Show all came from', () => {
    const el = render(
      <ListPage
        page={WORK}
        today={TODAY}
        courseHref={course}
        initial={{ course: 'ECE 210', state: 'done' }}
      />,
    );
    expect(el.querySelector('header')?.textContent).toContain('ECE 210');
    expect(radio(el, 'Done').getAttribute('aria-checked')).toBe('true');
    expect(el.textContent).not.toContain('Circuits I');
    expect(links(el)).toBeGreaterThan(0);
  });

  it('has no State menu: the header switch is the only state control', () => {
    const el = render(
      <ListPage page={WORK} today={TODAY} courseHref={course} />,
    );
    const menus = [...el.querySelectorAll('button[aria-haspopup]')].map((b) =>
      b.textContent.slice(0, 4),
    );
    expect(menus).toEqual(['Cour', 'Sort']);
  });

  it('names the course in each row when it spans courses', () => {
    const el = render(
      <ListPage page={WORK} today={TODAY} courseHref={course} />,
    );
    expect(el.textContent).toContain('Circuits I');
  });

  it('switches state by the header switch and keeps both counts', () => {
    const el = render(
      <ListPage page={WORK} today={TODAY} courseHref={course} />,
    );
    expect(radio(el, 'To do').textContent).toBe('To do8');
    press(radio(el, 'Done'));
    expect(radio(el, 'Done').getAttribute('aria-checked')).toBe('true');
    expect(radio(el, 'To do').textContent).toBe('To do8');
    expect(el.textContent).toContain('Finished');
  });

  it('says no sets match and Clear filters brings them back', () => {
    const el = render(
      <ListPage
        page={WORK}
        today={TODAY}
        courseHref={course}
        initial={{ query: 'zzz' }}
      />,
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
      <ListPage
        page={MANY}
        today={TODAY}
        courseHref={course}
        initial={{ state: 'done' }}
      />,
    );
    expect(el.querySelectorAll('[role="radio"]')[1].textContent).toBe(
      `Done${String(MANY_SETS.filter((s) => s.finished !== undefined).length)}`,
    );
    expect(el.textContent).not.toContain('Show all');
    expect(links(el)).toBeGreaterThan(200);
  });

  it('shows the side’s own line, not No sets match, when it is empty and nothing is searched', () => {
    const done = WORK_SETS.filter((x) => x.finished !== undefined);
    const el = render(
      <ListPage
        page={{ kind: 'work', items: done }}
        today={TODAY}
        courseHref={course}
      />,
    );
    expect(el.textContent).toContain('Nothing to do');
    expect(el.textContent).not.toContain('No sets match');
  });

  it('lists courses with no switch', () => {
    const el = render(
      <ListPage page={COURSE_LIST} today={TODAY} courseHref={course} />,
    );
    expect(el.querySelector('[role="radio"]')).toBeNull();
    expect(el.textContent).toContain('Thermodynamics');
  });

  it('puts memories behind "Yours 12" and "From Ask 8"', () => {
    const el = render(
      <ListPage page={MEMORIES} today={TODAY} courseHref={course} />,
    );
    expect(radio(el, 'Yours').textContent).toBe('Yours12');
    expect(radio(el, 'From Ask').textContent).toBe('From Ask8');
  });
});
