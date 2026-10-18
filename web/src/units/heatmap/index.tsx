import { useLayoutEffect, useRef, useState } from 'react';

import { minutesText } from '@/units/set-line/dates';
import { Tooltip } from '@/units/tooltip';
import { addDays, dayKey, mondayOf, shade } from './day';
import {
  GAP,
  GRID_HEIGHT,
  ROWS,
  SQUARE,
  spanName,
  weeksThatFit,
} from './layout';

/** One day's study, by course. */
export interface StudyDay {
  /** The study day, "2026-10-13" (see `studyDay`). */
  date: string;
  courses: readonly { course: string; minutes: number }[];
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const dayTotal = (d: StudyDay | undefined) =>
  d ? d.courses.reduce((n, c) => n + c.minutes, 0) : 0;

/** The tooltip: the day, its total, then each course, most time first (D7). */
function dayTip(date: Date, day: StudyDay | undefined): string {
  const head = DAY_FORMAT.format(date);
  const total = dayTotal(day);
  if (!day || total <= 0) return `${head}\nNo time studied`;
  const courses = [...day.courses]
    .filter((c) => c.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .map((c) => `${c.course}: ${minutesText(c.minutes)}`);
  return [head, minutesText(total), ...courses].join('\n');
}

/** "41 h" for a long total, "50 m" for a short one. */
function totalText(minutes: number): string {
  return minutes >= 60
    ? `${String(Math.round(minutes / 60))} h`
    : minutesText(minutes);
}

/** Time studied per day (D1): columns of weeks from Monday, today in the
 *  last, five shades, a heading with the total, and a tooltip on each
 *  square. It shows `weeks` at most and fewer when its container is
 *  narrower, ending today, never scrolling sideways (heatmap-d3). */
export function Heatmap({
  days,
  today,
  weeks = 26,
  openDay,
}: {
  days: readonly StudyDay[];
  /** The study day that is today: the last column's last square. */
  today: Date;
  /** The most weeks to show: 26 for about 6 months, 53 for a year (D2). */
  weeks?: number;
  /** A date "2026-10-13" whose tooltip is held open: the design page. */
  openDay?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth);
    };
    measure();
    // Without the API (jsdom) the width stays as first measured.
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  const shown = weeksThatFit(width, weeks);
  const first = addDays(mondayOf(today), -(shown - 1) * 7);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cells: { date: Date; day?: StudyDay }[] = [];
  let total = 0;
  for (let i = 0; i < shown * 7; i++) {
    const date = addDays(first, i);
    if (date > today) break;
    const day = byDate.get(dayKey(date));
    total += dayTotal(day);
    cells.push({ date, day });
  }

  return (
    <div ref={box} className="min-w-0">
      <p className="ds-body ds-tabular text-(--ds-fg)">
        {total > 0
          ? `${totalText(total)} studied in the last ${spanName(shown)}`
          : 'No time studied yet'}
      </p>
      <div
        className="mt-3 grid grid-flow-col"
        style={{
          gridTemplateRows: `repeat(${String(ROWS)}, ${String(SQUARE)}px)`,
          gridAutoColumns: `${String(SQUARE)}px`,
          gap: GAP,
        }}
      >
        {cells.map(({ date, day }) => (
          <Tooltip
            key={dayKey(date)}
            text={dayTip(date, day)}
            open={dayKey(date) === openDay}
          >
            <span
              className="block rounded-(--ds-radius-segment)"
              style={{
                width: SQUARE,
                height: SQUARE,
                background: `var(--ds-heat-${String(shade(dayTotal(day)))})`,
              }}
            />
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) ${className}`}
    />
  );
}

/** The heatmap while the days load: the heading line and a block the height
 *  of the grid. */
export function HeatmapSkeleton() {
  return (
    <div className="min-w-0">
      <p className="ds-body flex h-(--ds-body-line) items-center">
        <Bar className="h-4 w-2/5 max-w-60" />
      </p>
      <div className="mt-3" style={{ height: GRID_HEIGHT }}>
        <Bar className="h-full w-full" />
      </div>
    </div>
  );
}
