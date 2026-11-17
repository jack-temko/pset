import { useState } from 'react';

import { waits, type Loads, type Waits } from '@/design/loading';
import { HomeLists } from '@/units/assignment-row/home';
import type { CourseSummary, HomeSet } from '@/units/assignment-row/lists';
import { Ticker } from '@/units/bone';
import { BarChart } from '@/units/bar-chart';
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

/** A figure under the bars, rolling to its value (bone-d5). */
const figureOf = (value: string) => (
  <p className="ds-heading ds-tabular text-(--ds-fg)">
    <Ticker>{value}</Ticker>
  </p>
);

interface HomeData {
  name: string;
  sets: readonly HomeSet[];
  study: readonly StudyDay[];
  courses: readonly CourseSummary[];
}

/** Home (S14): the info area (greeting, the heatmap and this week beside it),
 *  then the Assignments list, then the Courses list. This week sits beside
 *  the heatmap with a 14-day sparkline beside each figure (home-d10).
 *  It reads typed sample data until the backend has what it needs. Its
 *  quiet form, when its read outlasts the grace, is the top bar alone: the
 *  greeting is data, so nothing below it is known (loading D2, A2). */
export const Home = waits(
  {
    data: ['name', 'sets', 'study', 'courses'],
  } satisfies Loads<HomeData>,
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
    HomeData
  >) {
    const [held] = useState(() => Math.random());
    if (loading === true)
      return (
        <HomeFrame
          homeHref={homeHref}
          settingsHref={settingsHref}
          greeting={null}
          info={null}
        >
          {null}
        </HomeFrame>
      );
    const today = studyDay(now);
    const greeting = (
      <Greeting
        name={name}
        hour={now.getHours()}
        pick={pick ?? held}
        sets={sets}
        today={now}
      />
    );
    const heatmap = <Heatmap days={study} today={today} weeks={WEEKS} grow />;
    const lists = (
      <HomeLists
        workHref={workHref}
        coursesHref={coursesHref}
        today={now}
        sets={sets}
        courses={courses}
      />
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
                <Ticker>{minutesText(s.time.week)}</Ticker>{' '}
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
                figure={figureOf(count(s.questions.week))}
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
                figure={figureOf(count(left.questions))}
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
