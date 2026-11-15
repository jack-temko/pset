import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Bone } from '@/units/bone';
import { QUIET_FROM } from '@/units/bone/rhythm';
import { Button } from '@/units/button';
import { Link } from '@/units/link';
import { List } from '@/units/list';
import { ListRow } from '@/units/list-row';
import { Menu, MoreMenu } from '@/units/menu';
import { ProgressBar } from '@/units/progress-bar';
import { DueStatus } from '@/units/set-line';
import { dueBadge } from '@/units/set-line/badge';
import { timeLeft } from '@/units/set-line/dates';
import { TextField } from '@/units/text-field';
import { TopBar } from '@/units/top-bar';
import { CourseRow } from '@/units/course-row';
import {
  matching,
  startFilters,
  STATES,
  type Filters,
  type Option,
} from './filter';
import type { PageCourse, PageData, PageMemory, PageSet } from './sample';

/** The "..." menu's slot at a row's end, as on Course: its 32px button and the gap. */
const MENU_SLOT = 44;

/** With the "..." menu, as Course's Work rows are, so the two pages match. */
const MENU_ASIDE_WIDTH = 'clamp(200px, 24cqw, 360px)';

const DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const SORTS: Record<PageData['kind'], readonly Option[]> = {
  work: [
    { id: 'due', label: 'Due date' },
    { id: 'recent', label: 'Newest finished' },
    { id: 'name', label: 'Name' },
  ],
  memories: [
    { id: 'newest', label: 'Newest first' },
    { id: 'oldest', label: 'Oldest first' },
  ],
  courses: [
    { id: 'name', label: 'Name' },
    { id: 'todo', label: 'Most to do' },
  ],
};

const WORDS = {
  work: {
    title: 'Assignments',
    search: 'Search assignments',
    none: 'No assignments match',
  },
  memories: {
    title: 'Memories',
    search: 'Search memories',
    none: 'No memories match',
  },
  courses: {
    title: 'Courses',
    search: 'Search courses',
    none: 'No courses match',
  },
};

/** Work by due date while to do and newest finished once done; memories
 *  newest first (A5 of the grill). */
function defaultSort(kind: PageData['kind'], state: string) {
  if (kind === 'memories') return 'newest';
  if (kind === 'courses') return 'name';
  return state === 'done' ? 'recent' : 'due';
}

const stamp = (d: Date | undefined, none: number) => d?.getTime() ?? none;

function sortSets(items: readonly PageSet[], sort: string): PageSet[] {
  const by: Record<string, (a: PageSet, b: PageSet) => number> = {
    due: (a, b) => stamp(a.due, Infinity) - stamp(b.due, Infinity),
    recent: (a, b) => stamp(b.finished, 0) - stamp(a.finished, 0),
    name: (a, b) =>
      a.name.localeCompare(b.name, 'en', { numeric: true }) ||
      a.course.localeCompare(b.course),
  };
  return [...items].sort(by[sort] ?? by.due);
}

/** A menu that shows what it is set to: "Course  All courses". */
function Choice({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: string;
  options: readonly Option[];
  onPick: (id: string) => void;
}) {
  const [at, setAt] = useState<{ x: number; y: number }>();
  return (
    <>
      <button
        type="button"
        data-menu-trigger
        aria-haspopup="menu"
        aria-expanded={at !== undefined}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt((a) => (a ? undefined : { x: r.left, y: r.bottom + 4 }));
        }}
        className="ds-body inline-flex h-(--ds-control) shrink-0 items-center gap-2 rounded-(--ds-radius-control) border border-(--ds-border) bg-transparent px-3 whitespace-nowrap hover:bg-(--ds-hover) active:bg-(--ds-pressed)"
      >
        <span className="text-(--ds-fg-muted)">{label}</span>
        <span className="font-medium text-(--ds-fg)">{value}</span>
        <ChevronDown
          size={14}
          aria-hidden
          className="shrink-0 text-(--ds-fg-muted)"
        />
      </button>
      {at && (
        <Menu
          at={at}
          label={label}
          groups={[{ items: options }]}
          onClose={() => {
            setAt(undefined);
          }}
          onPick={(id) => {
            setAt(undefined);
            onPick(id);
          }}
        />
      )}
    </>
  );
}

/** A set as the summaries show it: the due tag, the due date and the
 *  progress bar; the course name joins line two when the page spans courses
 *  (list-page-d4). A finished set shows when it was finished instead. */
function SetRow({
  set,
  today,
  spanning,
  courseHref,
}: {
  set: PageSet;
  today: Date;
  spanning: boolean;
  courseHref: (name: string) => string;
}) {
  const finished = set.finished !== undefined;
  const time = set.minutesLeft === undefined ? '' : timeLeft(set.minutesLeft);
  return (
    <ListRow
      rowLink
      title={set.name}
      href="#"
      label={finished ? undefined : dueBadge(set.due, today)}
      status={
        finished ? (
          `Finished ${DAY.format(set.finished)}`
        ) : (
          <DueStatus due={set.due} today={today} />
        )
      }
      meta={[
        ...(spanning
          ? [
              <Link
                key="course"
                href={courseHref(set.course)}
                tone="muted"
                size="small"
                className="[overflow-wrap:normal]"
              >
                {set.course}
              </Link>,
            ]
          : []),
        ...(time ? [time] : []),
        ...(!spanning && !time ? [`${String(set.total)} problems`] : []),
      ]}
      aside={
        <div className="flex items-center gap-3">
          {/* A finished row says when in its status; a full bar would only
              repeat it (list-page-d8). */}
          <div className="min-w-0 flex-1">
            {!finished && <ProgressBar done={set.done} total={set.total} />}
          </div>
          <MoreMenu
            label={`More for ${set.name}`}
            items={
              finished
                ? [{ id: 'delete', label: 'Delete', danger: true }]
                : [
                    { id: 'open', label: 'Open' },
                    { id: 'rename', label: 'Rename' },
                    { id: 'delete', label: 'Delete', danger: true },
                  ]
            }
          />
        </div>
      }
      asideWidth={MENU_ASIDE_WIDTH}
    />
  );
}

function MemoryRow({
  memory,
  spanning,
}: {
  memory: PageMemory;
  spanning: boolean;
}) {
  return (
    <ListRow
      title={memory.text}
      meta={[
        ...(spanning ? [memory.course] : []),
        `Added ${DAY.format(memory.added)}`,
      ]}
      aside={
        <div className="flex justify-end">
          <MoreMenu
            label={`More for ${memory.text}`}
            items={[
              { id: 'edit', label: 'Edit' },
              { id: 'forget', label: 'Forget', danger: true },
            ]}
          />
        </div>
      }
      asideWidth={MENU_SLOT}
    />
  );
}

/** The one list page every list passes into (list-page-d1): a path back, a
 *  heading, a filter bar and the same list box with every match in one
 *  scroll. Filters start from where "Show all" came from and live in this
 *  component's state; the URL holds them once the page is wired
 *  (list-page-d3). */
export function Page({
  kind,
  page,
  count,
  initial,
  today,
  courseHref,
  homeHref,
  settingsHref,
}: {
  kind: PageData['kind'];
  /** The items; undefined while they load. */
  page: PageData | undefined;
  /** While loading: how many rows match the filters the page opens with. */
  count?: number;
  /** Where the filters start: what "Show all" came from. */
  initial?: Partial<Filters>;
  /** The moment due dates count from. */
  today: Date;
  /** Where a course's name goes (a placeholder until the course screen is wired). */
  courseHref: (name: string) => string;
  homeHref: string;
  settingsHref: string;
}) {
  const start = startFilters(kind, initial);
  const [seen, setSeen] = useState({ page, initial });
  const [f, setF] = useState(start);
  // The page follows what it is given when that changes.
  if (seen.page !== page || seen.initial !== initial) {
    setSeen({ page, initial });
    setF(start);
  }

  const words = WORDS[kind];
  const items: readonly (PageSet | PageMemory | PageCourse)[] =
    page?.items ?? [];
  const courses = [...new Set(items.map((i) => i.course))];
  const { needle, side, matches } = matching(items, f);
  const states = STATES[kind].map((s) => ({
    id: s.id,
    label: s.label,
    count: side(s.id).length,
  }));
  const sort = f.sort ?? defaultSort(kind, f.state);
  const sorts = SORTS[kind];
  const spanning = f.course === 'all';
  const set = (patch: Partial<Filters>) => {
    setF((v) => ({ ...v, ...patch }));
  };

  // A search that matches nothing says so and offers Clear filters; an empty
  // side with no search says its own quiet line, and the list stays on it (L8).
  const empty =
    needle !== '' ? (
      <>
        <span>{words.none}</span>
        <Button
          variant="quiet"
          onPress={() => {
            set({ query: '', course: 'all' });
          }}
        >
          Clear filters
        </Button>
      </>
    ) : kind === 'work' ? (
      f.state === 'done' ? (
        'Nothing done yet'
      ) : (
        'Nothing to do'
      )
    ) : (
      'Nothing here yet'
    );

  const header: { states: typeof states } | { states?: undefined } =
    kind === 'courses' ? {} : { states };
  const rows = () => {
    if (kind === 'work')
      return sortSets(matches as PageSet[], sort).map((s) => (
        <SetRow
          key={s.id}
          set={s}
          today={today}
          spanning={spanning}
          courseHref={courseHref}
        />
      ));
    if (kind === 'courses')
      return [...(matches as PageCourse[])]
        .sort((a, b) =>
          sort === 'todo'
            ? b.todo - a.todo || a.name.localeCompare(b.name)
            : a.name.localeCompare(b.name),
        )
        .map((c) => (
          <CourseRow
            key={c.id}
            name={c.name}
            href={courseHref(c.name)}
            todo={c.todo}
            materials={c.materials}
            weekMinutes={c.weekMinutes}
          />
        ));
    const memories = matches as PageMemory[];
    return (sort === 'oldest' ? [...memories].reverse() : memories).map((m) => (
      <MemoryRow key={m.id} memory={m} spanning={spanning} />
    ));
  };

  return (
    <div>
      <TopBar
        homeHref={homeHref}
        settingsHref={settingsHref}
        path={[
          ...(spanning
            ? []
            : [{ label: f.course, href: courseHref(f.course) }]),
          { label: words.title },
        ]}
      />
      <div className="px-(--ds-gutter) pb-16">
        <div className="@container mx-auto max-w-(--ds-page-width)">
          <div className="ds-room-display">
            <h1 className="ds-display text-(--ds-fg)">{words.title}</h1>
          </div>
          <div className="mb-4 flex min-w-0 items-center gap-3">
            <div className="min-w-0 flex-1">
              <TextField
                label="Search"
                labelHidden
                note={false}
                placeholder={words.search}
                value={f.query}
                onChange={(query) => {
                  set({ query });
                }}
              />
            </div>
            {kind !== 'courses' && (
              <Choice
                label="Course"
                value={spanning ? 'All courses' : f.course}
                options={[
                  { id: 'all', label: 'All courses' },
                  ...courses.map((c) => ({ id: c, label: c })),
                ]}
                onPick={(course) => {
                  set({ course });
                }}
              />
            )}
            <Choice
              label="Sort"
              value={sorts.find((s) => s.id === sort)?.label ?? ''}
              options={sorts}
              onPick={(next) => {
                set({ sort: next });
              }}
            />
          </div>
          <List
            {...header}
            state={f.state}
            onState={(state) => {
              set({ state, sort: undefined });
            }}
            empty={empty}
            loading={count === undefined ? undefined : { count }}
            row={(i) => <RowWaiting key={i} kind={kind} row={i} />}
          >
            {rows()}
          </List>
        </div>
      </div>
    </div>
  );
}

/** The menu's place in a row while it loads: as big as its button. */
const MENU = <span className="block size-(--ds-control) shrink-0" />;

/** One row while the list loads, as the kind draws it. Past the 20th a row
 *  keeps its height and drops its bars, so a long list holds its place
 *  without hundreds of pulsing bars (list-page-d9). */
function RowWaiting({ kind, row }: { kind: PageData['kind']; row: number }) {
  const quiet = row >= QUIET_FROM;
  if (kind === 'courses') return <CourseRow loading={{ row }} />;
  if (kind === 'memories')
    return (
      <ListRow
        loading={{ row, lines: 2 }}
        aside={<div className="flex justify-end">{MENU}</div>}
        asideWidth={MENU_SLOT}
      />
    );
  return (
    <ListRow
      loading={{ row, lines: 2 }}
      status={quiet ? undefined : <Bone ch={7} />}
      aside={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {!quiet && <ProgressBar loading />}
          </div>
          {MENU}
        </div>
      }
      asideWidth={MENU_ASIDE_WIDTH}
    />
  );
}
