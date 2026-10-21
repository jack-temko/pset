import { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

import { HomeLists } from '@/units/assignment-row/home';
import { BarChart, BarChartSkeleton } from '@/units/bar-chart';
import type { GreetingSet } from '@/units/greeting/due';
import { Greeting, GreetingSkeleton } from '@/units/greeting';
import type { StudyDay } from '@/units/heatmap';
import { Heatmap, HeatmapSkeleton } from '@/units/heatmap';
import { studyDay } from '@/units/heatmap/day';
import { Sparkline } from '@/units/sparkline';
import { minutesText } from '@/units/set-line/dates';
import { TopBar } from '@/units/top-bar';

import { Beside, Caption as Line, Row } from './layouts';
import { WEEKS } from './options';
import { changeOf, homeStats, leftToDo, type Change } from './stats';

const DAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

const count = (n: number) => String(n);
const plural = (n: number, one: string, many: string) =>
  `${String(n)} ${n === 1 ? one : many}`;

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) ${className}`}
    />
  );
}

/** A change as a glyph and its words: a green up arrow or an amber down one,
 *  so colour is never the only signal. */
function ChangeText({ change }: { change: Change }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${
        change.direction === 'up'
          ? 'text-(--ds-success)'
          : 'text-(--ds-attention)'
      }`}
    >
      {change.direction === 'up' ? (
        <ArrowUp size={14} aria-hidden />
      ) : (
        <ArrowDown size={14} aria-hidden />
      )}
      {change.text}
    </span>
  );
}

const small = 'ds-small truncate text-(--ds-fg-muted)';

/** The muted line under a row's label: last week and how it moved. */
function Moved({ text, change }: { text: string; change?: Change }) {
  return (
    <p className="ds-small ds-tabular flex items-center gap-x-2 whitespace-nowrap text-(--ds-fg-muted)">
      <span className="truncate">{text}</span>
      {change && <ChangeText change={change} />}
    </p>
  );
}

const figureOf = (value: string) => (
  <p className="ds-heading ds-tabular text-(--ds-fg)">{value}</p>
);

function RowSkeleton({ first }: { first?: boolean }) {
  return (
    <Row
      first={first}
      figure={
        <p className="ds-heading flex h-(--ds-heading-line) items-center">
          <Bar className="h-5 w-8" />
        </p>
      }
      label={
        <p className="ds-small flex h-(--ds-small-line) items-center">
          <Bar className="h-3 w-24" />
        </p>
      }
      caption={
        <p className="ds-small flex h-(--ds-small-line) items-center">
          <Bar className="h-3 w-32" />
        </p>
      }
      trailing={<Bar className="h-7 w-full" />}
    />
  );
}

/** Home (S14): the info area (greeting, the heatmap and this week beside it),
 *  then the Assignments list, then the Courses list. This week sits beside
 *  the heatmap with a 14-day sparkline beside each figure (home-d10).
 *  It reads typed sample data until the backend has what it needs. */
export function Home({
  name,
  now,
  pick,
  sets,
  study,
  homeHref = '/',
  settingsHref = '/settings',
}: {
  name: string;
  now: Date;
  /** In [0, 1): which of the hour's greetings; held for the visit. */
  pick?: number;
  sets: readonly GreetingSet[];
  study: readonly StudyDay[];
  homeHref?: string;
  settingsHref?: string;
}) {
  const [held] = useState(() => Math.random());
  const today = studyDay(now);
  const s = homeStats(study, today);
  const left = leftToDo(sets, today);
  const timeChange = changeOf(s.time.week, s.time.last);

  const info = (
    <Beside
      heatmap={<Heatmap days={study} today={today} weeks={WEEKS} grow />}
      week={
        <>
          <Line>
            <p className="ds-body ds-tabular text-(--ds-fg)">
              {minutesText(s.time.week)}{' '}
              <span className="text-(--ds-fg-muted)">this week</span>
            </p>
            <p className="ds-small ds-tabular flex items-center gap-x-2 whitespace-nowrap text-(--ds-fg-muted)">
              {minutesText(s.time.last)} last week
              {timeChange && <ChangeText change={timeChange} />}
            </p>
          </Line>
          <div className="min-h-0 flex-1">
            <BarChart
              bars={s.days.map((d) => ({
                label: WEEKDAY.format(d.date),
                value: d.minutes,
                tip: `${DAY.format(d.date)}\n${d.minutes > 0 ? minutesText(d.minutes) : 'No time studied'}`,
                today: d.today,
                future: d.future,
              }))}
            />
          </div>
          <Row
            first
            figure={figureOf(count(s.questions.week))}
            label={<p className={small}>Questions done</p>}
            caption={
              <Moved
                text={`Last week: ${count(s.questions.last)}`}
                change={changeOf(s.questions.week, s.questions.last)}
              />
            }
            trailing={<Sparkline values={s.spark.questions} height={28} />}
          />
          <Row
            figure={figureOf(count(left.questions))}
            label={<p className={small}>Questions left</p>}
            caption={
              <Moved
                text={
                  left.questions > 0
                    ? `in ${plural(left.sets, 'set', 'sets')} due soon`
                    : 'Nothing due in a week'
                }
              />
            }
            trailing={<Sparkline values={s.spark.sets} height={28} />}
          />
        </>
      }
    />
  );

  return (
    <HomeFrame
      homeHref={homeHref}
      settingsHref={settingsHref}
      greeting={
        <Greeting
          name={name}
          hour={now.getHours()}
          pick={pick ?? held}
          sets={sets}
          today={now}
        />
      }
      info={info}
    >
      <HomeLists />
    </HomeFrame>
  );
}

/** The top bar, the greeting, the info area and what is under it, in the
 *  content width. Home and its skeleton share it, so they lay out alike. */
function HomeFrame({
  homeHref,
  settingsHref,
  greeting,
  info,
  children,
}: {
  homeHref: string;
  settingsHref: string;
  greeting: ReactNode;
  info: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="@container">
      <TopBar homeHref={homeHref} settingsHref={settingsHref} />
      <div className="px-(--ds-gutter) pb-16">
        <div className="@container mx-auto max-w-(--ds-page-width)">
          <div className="ds-room-display">{greeting}</div>
          <div data-info>{info}</div>
          <div className="mt-16">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Home while it loads: every part as its own skeleton, laid out as Home is,
 *  and the two lists as a heading bar over a block. */
export function HomeSkeleton({
  homeHref = '/',
  settingsHref = '/settings',
}: {
  homeHref?: string;
  settingsHref?: string;
}) {
  return (
    <HomeFrame
      homeHref={homeHref}
      settingsHref={settingsHref}
      greeting={<GreetingSkeleton />}
      info={
        <Beside
          heatmap={<HeatmapSkeleton weeks={WEEKS} grow />}
          week={
            <>
              <Line>
                <p className="ds-body flex h-(--ds-body-line) items-center">
                  <Bar className="h-4 w-28" />
                </p>
                <p className="ds-small flex h-(--ds-small-line) items-center">
                  <Bar className="h-3 w-28" />
                </p>
              </Line>
              <div className="min-h-0 flex-1">
                <BarChartSkeleton />
              </div>
              <RowSkeleton first />
              <RowSkeleton />
            </>
          }
        />
      }
    >
      <div className="space-y-10">
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
    </HomeFrame>
  );
}
