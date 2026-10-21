import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { addDays, dayKey, mondayOf, shade, studyDay } from './day';
import { Heatmap } from './index';
import { gridFor, monthColumns, spanName, weeksThatFit } from './layout';

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
  act(() => {
    for (const r of roots.splice(0)) r.unmount();
  });
  document.body.replaceChildren();
});

describe('studyDay', () => {
  it('counts work until 4am for the day before', () => {
    expect(dayKey(studyDay(new Date(2026, 9, 14, 3, 59)))).toBe('2026-10-13');
    expect(dayKey(studyDay(new Date(2026, 9, 14, 4, 0)))).toBe('2026-10-14');
    expect(dayKey(studyDay(new Date(2026, 9, 13, 23, 59)))).toBe('2026-10-13');
  });

  it('crosses a month and a year', () => {
    expect(dayKey(studyDay(new Date(2026, 10, 1, 2)))).toBe('2026-10-31');
    expect(dayKey(studyDay(new Date(2027, 0, 1, 0, 30)))).toBe('2026-12-31');
  });
});

describe('weeks and shades', () => {
  it('starts a week on Monday', () => {
    expect(dayKey(mondayOf(new Date(2026, 9, 13)))).toBe('2026-10-12');
    expect(dayKey(mondayOf(new Date(2026, 9, 18)))).toBe('2026-10-12');
    expect(dayKey(mondayOf(new Date(2026, 9, 12)))).toBe('2026-10-12');
    expect(dayKey(addDays(new Date(2026, 9, 30), 3))).toBe('2026-11-02');
  });

  it('steps at 30 m, 1 h and 2 h', () => {
    expect([0, 1, 29, 30, 59, 60, 119, 120, 400].map(shade)).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4, 4,
    ]);
  });
});

describe('the grown grid', () => {
  it('stretches the gap to reach the edge, the square capped at 32', () => {
    const g = gridFor(32 + 938, 26, true);
    expect(g.size).toBe(32);
    expect(26 * g.size + 25 * g.gap).toBeCloseTo(938);
  });

  it('keeps the natural square and gap when not grown', () => {
    expect(gridFor(600, 26, false)).toEqual({ weeks: 26, size: 14, gap: 3 });
  });

  it('names a month where it begins, and leaves out a crowded one', () => {
    const mondays = [28, 5, 12].map((d, i) =>
      i === 0 ? new Date(2026, 8, d) : new Date(2026, 9, d),
    );
    // Sep 28 is crowded by Oct 5 and Oct 5 is not last: only Oct shows.
    expect(monthColumns(mondays)).toEqual([{ col: 1, name: 'Oct' }]);
  });
});

describe('how many weeks fit', () => {
  it('shows the whole span until the width is known or short', () => {
    expect(weeksThatFit(0, 26)).toBe(26);
    expect(weeksThatFit(2000, 26)).toBe(26);
    expect(weeksThatFit(263, 53)).toBe(15);
    expect(weeksThatFit(5, 53)).toBe(1);
  });

  it('names the weeks on show', () => {
    expect(spanName(26)).toBe('6 months');
    expect(spanName(53)).toBe('year');
    expect(spanName(15)).toBe('3 months');
    expect(spanName(4)).toBe('1 month');
    expect(spanName(2)).toBe('2 weeks');
  });
});

describe('Heatmap', () => {
  const today = new Date(2026, 9, 13); // a Tuesday
  const days = [
    {
      date: '2026-10-12',
      courses: [
        { course: 'Linear algebra', minutes: 25 },
        { course: 'Circuits I', minutes: 70 },
      ],
    },
    { date: '2026-10-13', courses: [{ course: 'Circuits I', minutes: 130 }] },
  ];

  it('ends in today and counts the total in the heading', () => {
    const el = render(<Heatmap days={days} today={today} weeks={2} />);
    expect(el.querySelector('p')?.textContent).toBe(
      '4 h studied in the last 2 weeks',
    );
    // Two weeks from Monday, today a Tuesday: 7 + 2 squares and 5 empty ones to the end of the week.
    expect(el.querySelectorAll('.grid-flow-col > span')).toHaveLength(14);
  });

  it('says so when nothing is studied', () => {
    const el = render(<Heatmap days={[]} today={today} weeks={26} />);
    expect(el.querySelector('p')?.textContent).toBe('No time studied yet');
  });

  it('opens a tooltip with the day, its total and courses, most first', () => {
    render(
      <Heatmap days={days} today={today} weeks={2} openDay="2026-10-12" />,
    );
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
      'Mon, Oct 12\n1 h 35 m\nCircuits I: 1 h 10 m\nLinear algebra: 25 m',
    );
  });
});
