import { useState, type ReactNode } from 'react';

import type { StudyDay } from '@/units/heatmap';
import { Heatmap, HeatmapSkeleton } from '@/units/heatmap';
import { addDays, dayKey, mondayOf, studyDay } from '@/units/heatmap/day';
import { HomeLists } from '@/units/assignment-row/home';
import type { GreetingSet } from '@/units/greeting/due';
import { Greeting, GreetingSkeleton } from '@/units/greeting';
import { StatTile, StatTileSkeleton } from '@/units/stat-tile';
import { minutesText } from '@/units/set-line/dates';
import { TopBar } from '@/units/top-bar';

import { SPAN_WEEKS, type Layout, type Tiles, type Span } from './options';

/** Minutes studied from `from` up to, not including, `to`. */
function minutesBetween(days: readonly StudyDay[], from: Date, to: Date) {
  const lo = dayKey(from);
  const hi = dayKey(to);
  let total = 0;
  for (const d of days)
    if (d.date >= lo && d.date < hi)
      for (const c of d.courses) total += c.minutes;
  return total;
}

/** The tiles and the heatmap under the greeting: beside each other, or
 *  stacked as tiles row then heatmap. Under 760 wide, beside gives way to the
 *  tiles above the heatmap (home-info-grill D9). */
function Arranged({
  layout,
  tiles,
  children,
}: {
  layout: Layout;
  tiles: ReactNode;
  children: ReactNode;
}) {
  if (layout === 'beside')
    return (
      <div className="grid items-start gap-6 @min-[760px]:grid-cols-[220px_minmax(0,max-content)]">
        <div className="grid gap-3">{tiles}</div>
        {children}
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="grid gap-3 @min-[560px]:grid-cols-2">{tiles}</div>
      {children}
    </div>
  );
}

/** Home (S14): the info area (greeting, stat tiles, heatmap), then the
 *  Assignments list, then the Courses list. The three picks the design page
 *  compares are props: the heatmap `span`, how many `tiles`, and the `layout`
 *  (home-info-grill D2, D3, D9). It reads typed sample data until the backend
 *  has what it needs. */
export function Home({
  name,
  now,
  pick,
  sets,
  study,
  questions,
  span = 'six-months',
  tiles = 'two',
  layout = 'beside',
  homeHref = '/',
  settingsHref = '/settings',
}: {
  name: string;
  now: Date;
  /** In [0, 1): which of the hour's greetings; held for the visit. */
  pick?: number;
  sets: readonly GreetingSet[];
  study: readonly StudyDay[];
  questions: { thisWeek: number; lastWeek: number };
  span?: Span;
  tiles?: Tiles;
  layout?: Layout;
  homeHref?: string;
  settingsHref?: string;
}) {
  const [held] = useState(() => Math.random());
  const today = studyDay(now);
  const monday = mondayOf(today);
  const thisWeek = minutesBetween(study, monday, addDays(today, 1));
  const lastWeek = minutesBetween(study, addDays(monday, -7), monday);

  const tileList = (
    <>
      <StatTile
        label="Time this week"
        value={minutesText(thisWeek)}
        note={`Last week: ${minutesText(lastWeek)}`}
      />
      {tiles === 'two' && (
        <StatTile
          label="Questions done"
          value={String(questions.thisWeek)}
          note={`Last week: ${String(questions.lastWeek)}`}
        />
      )}
    </>
  );
  const heatmap = (
    <Heatmap days={study} today={today} weeks={SPAN_WEEKS[span]} />
  );

  return (
    <div className="@container">
      <TopBar homeHref={homeHref} settingsHref={settingsHref} />
      <div className="px-(--ds-gutter) pb-16">
        <div className="@container mx-auto max-w-(--ds-page-width)">
          <div className="ds-room-display">
            <Greeting
              name={name}
              hour={now.getHours()}
              pick={pick ?? held}
              sets={sets}
              today={now}
            />
          </div>
          <Arranged layout={layout} tiles={tileList}>
            {heatmap}
          </Arranged>
          <div className="mt-16">
            <HomeLists />
          </div>
        </div>
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

/** Home while it loads: every part as its own skeleton, laid out as Home is,
 *  and the two lists as a heading bar over a block. */
export function HomeSkeleton({
  tiles = 'two',
  layout = 'beside',
  homeHref = '/',
  settingsHref = '/settings',
}: {
  tiles?: Tiles;
  layout?: Layout;
  homeHref?: string;
  settingsHref?: string;
}) {
  const tileList = (
    <>
      <StatTileSkeleton />
      {tiles === 'two' && <StatTileSkeleton />}
    </>
  );
  return (
    <div className="@container">
      <TopBar homeHref={homeHref} settingsHref={settingsHref} />
      <div className="px-(--ds-gutter) pb-16">
        <div className="@container mx-auto max-w-(--ds-page-width)">
          <div className="ds-room-display">
            <GreetingSkeleton />
          </div>
          <Arranged layout={layout} tiles={tileList}>
            <HeatmapSkeleton />
          </Arranged>
          <div className="mt-16 space-y-10">
            {[0, 1].map((i) => (
              <div key={i}>
                <div className="flex min-h-8 items-center">
                  <Bar className="h-5 w-40" />
                </div>
                <div className="mt-3 h-[282px]">
                  <Bar className="h-full w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
