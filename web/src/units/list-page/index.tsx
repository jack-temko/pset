import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/units/button';
import { Link } from '@/units/link';
import { List } from '@/units/list';
import { ListRow } from '@/units/list-row';
import { Menu } from '@/units/menu';
import { ProgressBar } from '@/units/progress-bar';
import { DueStatus } from '@/units/set-line';
import { dueBadge } from '@/units/set-line/badge';
import { timeLeft } from '@/units/set-line/dates';
import { TextField } from '@/units/text-field';
import { TopBar } from '@/units/top-bar';
import type { PageData, PageMemory, PageSet } from './sample';

/** The aside is a fifth of the row, as on Home, so the bars align. */
const ASIDE_WIDTH = 'clamp(160px, 20cqw, 320px)';

const DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

export interface Filters {
  /** Matches names. */
  query: string;
  /** A course's name, or 'all'. */
  course: string;
  /** The list's state: 'todo' or 'done' for work, 'yours' or 'ask' for memories. */
  state: string;
  /** A sort id; without one the state's own default (list-page-d5). */
  sort?: string;
}

interface Option {
  id: string;
  label: string;
}

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
};

const STATES: Record<PageData['kind'], readonly Option[]> = {
  work: [
    { id: 'todo', label: 'To do' },
    { id: 'done', label: 'Done' },
  ],
  memories: [
    { id: 'yours', label: 'Yours' },
    { id: 'ask', label: 'From Ask' },
  ],
};

const WORDS = {
  work: {
    title: 'Work',
    search: 'Search sets',
    none: 'No sets match',
  },
  memories: {
    title: 'Memories',
    search: 'Search memories',
    none: 'No memories match',
  },
};

/** Work by due date while to do and newest finished once done; memories
 *  newest first (A5 of the grill). */
function defaultSort(kind: PageData['kind'], state: string) {
  if (kind === 'memories') return 'newest';
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

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) ${className}`}
    />
  );
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
}: {
  set: PageSet;
  today: Date;
  spanning: boolean;
}) {
  const finished = set.finished !== undefined;
  const time = set.minutesLeft === undefined ? '' : timeLeft(set.minutesLeft);
  return (
    <ListRow
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
                href="#"
                tone="muted"
                size="small"
                className="[overflow-wrap:normal]"
              >
                {set.course}
              </Link>,
            ]
          : []),
        ...(time ? [time] : []),
        ...(!spanning && !time ? [`${String(set.total)} questions`] : []),
      ]}
      aside={<ProgressBar done={set.done} total={set.total} />}
      asideWidth={ASIDE_WIDTH}
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
    />
  );
}

/** The one list page every list passes into (list-page-d1): a path back, a
 *  heading, a filter bar and the same list box with every match in one
 *  scroll. Filters start from where "Show all" came from and live in this
 *  component's state; the URL holds them once the page is wired
 *  (list-page-d3). */
export function ListPage({
  page,
  initial,
  today,
  homeHref = '/',
  settingsHref = '/settings',
}: {
  page: PageData;
  /** Where the filters start: what "Show all" came from. */
  initial?: Partial<Filters>;
  /** The moment due dates count from. */
  today: Date;
  homeHref?: string;
  settingsHref?: string;
}) {
  const kind = page.kind;
  const start: Filters = {
    query: '',
    course: 'all',
    state: STATES[kind][0].id,
    ...initial,
  };
  const [seen, setSeen] = useState({ page, initial });
  const [f, setF] = useState(start);
  // The page follows what it is given when that changes.
  if (seen.page !== page || seen.initial !== initial) {
    setSeen({ page, initial });
    setF(start);
  }

  const words = WORDS[kind];
  const courses = [...new Set(page.items.map((i) => i.course))];
  const needle = f.query.trim().toLowerCase();
  const names = (i: PageSet | PageMemory) =>
    ('name' in i ? i.name : i.text).toLowerCase();
  const narrowed = page.items.filter(
    (i) =>
      (f.course === 'all' || i.course === f.course) &&
      names(i).includes(needle),
  );
  const side = (id: string) =>
    narrowed.filter((i) =>
      'source' in i
        ? i.source === id
        : id === 'done'
          ? i.finished !== undefined
          : i.finished === undefined,
    );
  const states = STATES[kind].map((s) => ({
    id: s.id,
    label: s.label,
    count: side(s.id).length,
  }));
  const sort = f.sort ?? defaultSort(kind, f.state);
  const sorts = SORTS[kind];
  const matches = side(f.state);
  const spanning = f.course === 'all';
  const filtered = needle !== '' || f.course !== 'all';
  const set = (patch: Partial<Filters>) => {
    setF((v) => ({ ...v, ...patch }));
  };

  const empty = filtered ? (
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

  return (
    <div>
      <TopBar
        homeHref={homeHref}
        settingsHref={settingsHref}
        path={[
          { label: 'Home', href: homeHref },
          ...(spanning ? [] : [{ label: f.course, href: '#' }]),
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
            <Choice
              label="State"
              value={STATES[kind].find((s) => s.id === f.state)?.label ?? ''}
              options={STATES[kind]}
              onPick={(state) => {
                set({ state, sort: undefined });
              }}
            />
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
            states={states}
            state={f.state}
            onState={(state) => {
              set({ state, sort: undefined });
            }}
            empty={empty}
          >
            {page.kind === 'work'
              ? sortSets(matches as PageSet[], sort).map((s) => (
                  <SetRow
                    key={s.id}
                    set={s}
                    today={today}
                    spanning={spanning}
                  />
                ))
              : (sort === 'oldest'
                  ? [...(matches as PageMemory[])].reverse()
                  : (matches as PageMemory[])
                ).map((m) => (
                  <MemoryRow key={m.id} memory={m} spanning={spanning} />
                ))}
          </List>
        </div>
      </div>
    </div>
  );
}

/** The page while it loads: a bar where the heading, the filter bar and the
 *  list's rows will be, laid out as the page is. The list's height is that of
 *  a few rows: the real one depends on how many match. */
export function ListPageSkeleton({
  homeHref = '/',
  settingsHref = '/settings',
}: {
  homeHref?: string;
  settingsHref?: string;
}) {
  return (
    <div>
      <TopBar
        homeHref={homeHref}
        settingsHref={settingsHref}
        path={[{ label: 'Home', href: homeHref }, { label: 'Work' }]}
      />
      <div className="px-(--ds-gutter) pb-16">
        <div className="@container mx-auto max-w-(--ds-page-width)">
          <div className="ds-room-display">
            <div className="flex h-(--ds-display-line) items-center">
              <Bar className="h-9 w-[160px]" />
            </div>
          </div>
          <div className="mb-4 flex h-(--ds-control) items-center">
            <Bar className="h-full w-full" />
          </div>
          <div className="h-[383px]">
            <Bar className="h-full w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
