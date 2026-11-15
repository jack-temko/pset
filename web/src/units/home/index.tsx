import { useState } from 'react';

import { UNKNOWN, waits, type Loads, type Waits } from '@/design/loading';
import { HomeLists } from '@/units/assignment-row/home';
import {
  listsShape,
  type CourseSummary,
  type HomeSet,
  type ListsShape,
} from '@/units/assignment-row/lists';
import { Bone, Ticker } from '@/units/bone';
import { BarChart, weekShape } from '@/units/bar-chart';
import { Greeting } from '@/units/greeting';
import type { StudyDay } from '@/units/heatmap';
import { Heatmap } from '@/units/heatmap';
import { studyDay } from '@/units/heatmap/day';
import { Sparkline } from '@/units/sparkline';
import { minutesText } from '@/units/set-line/dates';

import { Beside, Caption as Line, HomeFrame, Row, Rows } from './layouts';
import { ChangeText, Moved, small } from './parts';
import { WEEKS } from './options';
import { changeOf, homeStats, leftToDo } from './stats';

const DAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

const count = (n: number) => String(n);
const plural = (n: number, one: string, many: string) =>
  `${String(n)} ${n === 1 ? one : many}`;

/** A figure under the bars: a bar at the shape's width while it loads, then
 *  the number rolling to its value (bone-d5). */
const figureOf = (value: string | undefined, digits: number) => (
  <p className="ds-heading ds-tabular text-(--ds-fg)">
    <Ticker ch={digits}>{value}</Ticker>
  </p>
);

interface HomeData {
  name: string;
  sets: readonly HomeSet[];
  study: readonly StudyDay[];
  courses: readonly CourseSummary[];
}

/** What sizes Home while it loads: how many rows each list holds, and how
 *  many digits each figure under the bars has, since the labels beside them
 *  align to the widest. The greeting and the heatmap's heading load as one
 *  bar line each and grow if they wrap (bone-d4). */
export interface HomeShape {
  lists: ListsShape;
  figures: readonly [number, number];
}

const digits = (n: number) => String(n).length;

/** Home (S14): the info area (greeting, the heatmap and this week beside it),
 *  then the Assignments list, then the Courses list. This week sits beside
 *  the heatmap with a 14-day sparkline beside each figure (home-d10).
 *  It reads typed sample data until the backend has what it needs. Loading,
 *  every part draws its own loading form at the shape, and the headings,
 *  labels and links are real (home-d19). */
export const Home = waits(
  {
    data: ['name', 'sets', 'study', 'courses'],
    shapeOf: (d: HomeData & { now: Date }): HomeShape => {
      const today = studyDay(d.now);
      const s = homeStats(d.study, today);
      return {
        lists: listsShape(d.sets, d.courses, d.now),
        figures: [
          digits(s.questions.week),
          digits(leftToDo(d.sets, today).questions),
        ],
      };
    },
  } satisfies Loads<HomeData & { now: Date }, HomeShape>,
  function Home({
    name,
    now,
    pick,
    sets,
    study,
    courses,
    workHref,
    coursesHref,
    homeHref = '/',
    settingsHref = '/settings',
    loading,
  }: Waits<
    {
      now: Date;
      /** In [0, 1): which of the hour's greetings; held for the visit. */
      pick?: number;
      /** Where Assignments' "Show all" goes. */
      workHref: string;
      /** Where Courses' "Show all" goes. */
      coursesHref: string;
      homeHref?: string;
      settingsHref?: string;
    },
    HomeData,
    HomeShape
  >) {
    const [held] = useState(() => Math.random());
    const today = studyDay(now);
    const shape = loading === UNKNOWN ? undefined : loading;
    const figures = shape?.figures ?? [2, 2];

    const greeting =
      loading === undefined ? (
        <Greeting
          name={name}
          hour={now.getHours()}
          pick={pick ?? held}
          sets={sets}
          today={now}
        />
      ) : (
        <Greeting
          loading={{}}
          hour={now.getHours()}
          pick={pick ?? held}
          today={now}
        />
      );

    const heatmap =
      loading === undefined ? (
        <Heatmap days={study} today={today} weeks={WEEKS} grow />
      ) : (
        <Heatmap loading={{}} today={today} weeks={WEEKS} grow />
      );

    const lists =
      loading === undefined ? (
        <HomeLists
          workHref={workHref}
          coursesHref={coursesHref}
          today={now}
          sets={sets}
          courses={courses}
        />
      ) : (
        <HomeLists
          workHref={workHref}
          coursesHref={coursesHref}
          today={now}
          loading={shape?.lists ?? UNKNOWN}
        />
      );

    if (loading !== undefined)
      return (
        <HomeFrame
          homeHref={homeHref}
          settingsHref={settingsHref}
          greeting={greeting}
          info={
            <Beside
              heatmap={heatmap}
              week={
                <>
                  <Line>
                    <p className="ds-body">
                      <Bone ch={14} />
                    </p>
                    <p className="ds-small">
                      <Bone ch={22} />
                    </p>
                  </Line>
                  <div className="min-h-0 flex-1">
                    <BarChart loading={weekShape(today)} />
                  </div>
                  <Rows>
                    <Row
                      first
                      figure={figureOf(undefined, figures[0])}
                      label={
                        <p className="ds-small whitespace-nowrap text-(--ds-fg-muted)">
                          Problems done
                        </p>
                      }
                      caption={
                        <p className="ds-small">
                          <Bone ch={20} />
                        </p>
                      }
                      trailing={<Sparkline loading height={28} />}
                    />
                    <Row
                      figure={figureOf(undefined, figures[1])}
                      label={<p className={small}>Problems left</p>}
                      caption={
                        <p className="ds-small">
                          <Bone ch={24} />
                        </p>
                      }
                      trailing={<Sparkline loading height={28} />}
                    />
                  </Rows>
                </>
              }
            />
          }
        >
          {lists}
        </HomeFrame>
      );

    const s = homeStats(study, today);
    const left = leftToDo(sets, today);
    // Today's point is the live number, so the line ends where the figure is.
    const leftSpark = [...s.spark.left.slice(0, -1), left.questions];
    const questionsChange = changeOf(s.questions.week, s.questions.last);
    const timeChange = changeOf(s.time.week, s.time.last);

    const info = (
      <Beside
        heatmap={heatmap}
        week={
          <>
            <Line>
              <p className="ds-body ds-tabular text-(--ds-fg)">
                <Ticker ch={6}>{minutesText(s.time.week)}</Ticker>{' '}
                <span className="text-(--ds-fg-muted)">this week</span>
              </p>
              <p className="ds-small ds-tabular flex flex-wrap items-center gap-x-2 text-(--ds-fg-muted)">
                {`Last week by now: ${minutesText(s.time.last)}`}
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
            <Rows>
              <Row
                first
                figure={figureOf(count(s.questions.week), figures[0])}
                label={
                  <p className="ds-small flex items-center gap-x-2 whitespace-nowrap text-(--ds-fg-muted)">
                    <span>Problems done</span>
                    {questionsChange && <ChangeText change={questionsChange} />}
                  </p>
                }
                caption={
                  <Moved
                    text={`Last week by now: ${count(s.questions.last)}`}
                  />
                }
                trailing={<Sparkline values={s.spark.questions} height={28} />}
              />
              <Row
                figure={figureOf(count(left.questions), figures[1])}
                label={<p className={small}>Problems left</p>}
                caption={
                  <Moved
                    text={
                      left.questions > 0
                        ? `in ${plural(left.sets, 'assignment', 'assignments')} due soon`
                        : 'Nothing due in a week'
                    }
                  />
                }
                trailing={<Sparkline values={leftSpark} height={28} />}
              />
            </Rows>
          </>
        }
      />
    );

    return (
      <HomeFrame
        homeHref={homeHref}
        settingsHref={settingsHref}
        greeting={greeting}
        info={info}
      >
        {lists}
      </HomeFrame>
    );
  },
);
