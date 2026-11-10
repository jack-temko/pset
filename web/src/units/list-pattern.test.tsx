import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { sampleStudy } from '@/design/study-sample';
import { SETS, TODAY } from '@/units/assignment-row/sample';
import { Course } from '@/units/course';
import { ECE, NOTHING_DUE, STRESS } from '@/units/course/sample';
import { Home } from '@/units/home';
import { PLACEHOLDER } from '@/units/list-page/hrefs';

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

const foot = (el: HTMLElement, text: string) =>
  [...el.querySelectorAll('a')].find((a) => a.textContent === text);
const radio = (el: HTMLElement, text: string) =>
  [...el.querySelectorAll('[role="radio"]')].find((b) =>
    b.textContent.startsWith(text),
  );

const course = (c = ECE) => (
  <Course
    course={c}
    today={TODAY}
    workHref="/work"
    materialsHref="/materials"
  />
);

describe('Course lists', () => {
  it('caps Work at 5 with a Show all foot, and Materials too', () => {
    const el = render(course(STRESS));
    expect(foot(el, 'Show all 8')?.getAttribute('href')).toBe('/work');
    expect(foot(el, 'Show all 9')?.getAttribute('href')).toBe('/materials');
    expect(radio(el, 'To do')?.textContent).toBe('To do8');
    expect(radio(el, 'Done')?.textContent).toBe('Done4');
  });

  it('has no foot when the list fits', () => {
    const el = render(course());
    expect(foot(el, 'Show all 1')).toBeUndefined();
    expect(el.textContent).not.toContain('Show all');
  });

  it('says only the next due date under the name, and nothing when none is due or the one row says it', () => {
    const h1 = (el: HTMLElement) =>
      el.querySelector('h1')?.parentElement?.parentElement;
    expect(h1(render(course(STRESS)))?.textContent).toContain('Next due Wed');
    expect(h1(render(course(STRESS)))?.textContent).not.toContain('set to do');
    // One assignment to do: its row already says the date (course-d30).
    expect(h1(render(course()))?.textContent).not.toContain('due');
    expect(h1(render(course(NOTHING_DUE)))?.textContent).not.toContain('due');
  });

  it('stays on To do when To do is empty, and Done keeps its count', () => {
    const el = render(course(NOTHING_DUE));
    expect(radio(el, 'To do')?.getAttribute('aria-checked')).toBe('true');
    expect(radio(el, 'Done')?.textContent).toBe('Done6');
    expect(el.textContent).toContain('Nothing to do');
    expect(el.textContent).not.toContain('Problem set 1');
  });
});

describe('Home lists', () => {
  it('end in Show all N, going to the list pages', () => {
    const el = render(
      <Home
        name="Jack"
        now={new Date(2026, 9, 13, 18)}
        pick={0}
        sets={SETS}
        study={sampleStudy()}
        workHref={PLACEHOLDER.work}
        coursesHref={PLACEHOLDER.courses}
      />,
    );
    expect(foot(el, 'Show all 6')?.getAttribute('href')).toBe(PLACEHOLDER.work);
    expect(foot(el, 'Show all 8')?.getAttribute('href')).toBe(
      PLACEHOLDER.courses,
    );
  });
});
