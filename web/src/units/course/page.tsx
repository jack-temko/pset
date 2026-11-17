import { Plus } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';

import type { Waits } from '@/design/loading';
import { money, plural } from '@/lib/format';
import { Button } from '@/units/button';
import { BarChart } from '@/units/bar-chart';
import { DangerDialog } from '@/units/danger-dialog';
import { Fold } from '@/units/fold';
import { Heatmap } from '@/units/heatmap';
import { studyDay } from '@/units/heatmap/day';
import { ChangeText, Moved } from '@/units/home/parts';
import { Beside, Caption, Row, Rows } from '@/units/home/layouts';
import { WEEKS } from '@/units/home/options';
import { changeOf, homeStats } from '@/units/home/stats';
import { List, LIST_CAP } from '@/units/list';
import { countBeside } from '@/units/list/count';
import { ListRow, UndoRow, UNDO_ROW_MS } from '@/units/list-row';
import { MoreMenu } from '@/units/menu';
import { ProgressBar } from '@/units/progress-bar';
import { SectionHeading } from '@/units/section-heading';
import { dueBadge } from '@/units/set-line/badge';
import {
  dueClause,
  dueText,
  minutesText,
  timeLeft,
} from '@/units/set-line/dates';
import { Sparkline } from '@/units/sparkline';
import { TextField } from '@/units/text-field';
import { TopBar } from '@/units/top-bar';
import { ErrorNotice } from '@/units/error-notice';
import { MemoryList } from '@/units/memory';
import type { CourseData, CourseMaterial, CourseSet } from './sample';

/** The work row's aside: the progress bar, then the row's menu. */
const WORK_ASIDE = 'clamp(200px, 24cqw, 360px)';

let nextId = 0;

/** How long a deleted row waits for Undo. */

/** To do by due date, undated last; the finished apart. */
function split(sets: readonly CourseSet[]) {
  const stamp = (s: CourseSet) => s.due?.getTime() ?? Infinity;
  return {
    todo: sets
      .filter((s) => s.done < s.total || s.readingMinutes !== undefined)
      .sort((a, b) => stamp(a) - stamp(b)),
    done: sets.filter(
      (s) => s.done >= s.total && s.readingMinutes === undefined,
    ),
  };
}

interface Pending {
  kind: 'set' | 'material';
  id: string;
  name: string;
}

/** The name being changed, in the title's place: Enter or leaving saves,
 *  Escape cancels. */
function NameField({
  value,
  inline,
  onDone,
  onCancel,
}: {
  value: string;
  inline: 'row' | 'heading';
  onDone: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(value);
  return (
    <TextField
      label="Name"
      value={name}
      onChange={setName}
      onCommit={onDone}
      onCancel={onCancel}
      inline={inline}
      autoFocus
    />
  );
}

function WorkRow({
  set,
  today,
  finished,
  titleField,
  onPick,
}: {
  set: CourseSet;
  today: Date;
  /** A finished set offers only what works: Delete. */
  finished?: boolean;
  titleField?: ReactNode;
  onPick: (id: string) => void;
}) {
  const reading = set.readingMinutes;
  const time = set.minutesLeft === undefined ? '' : timeLeft(set.minutesLeft);
  return (
    <ListRow
      title={set.name}
      titleField={titleField}
      href="#"
      rowLink
      label={reading === undefined ? dueBadge(set.due, today) : undefined}
      status={reading === undefined && set.due && dueText(set.due, today).text}
      meta={
        reading !== undefined
          ? [`Reading, about ${String(reading)} min`]
          : time
            ? [time]
            : finished
              ? [plural(set.total, 'problem', 'problems')]
              : []
      }
      aside={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {/* A finished row is all done: a full bar would say nothing. */}
            {reading === undefined && !finished && (
              <ProgressBar done={set.done} total={set.total} />
            )}
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
            onSelect={onPick}
          />
        </div>
      }
      asideWidth={WORK_ASIDE}
    />
  );
}

function MaterialRow({
  material,
  titleField,
  onPick,
}: {
  material: CourseMaterial;
  titleField?: ReactNode;
  onPick: (id: string) => void;
}) {
  const reading = material.readingMinutes;
  return (
    <ListRow
      title={material.name}
      titleField={titleField}
      href="#"
      rowLink
      meta={[
        material.kind,
        reading === undefined
          ? plural(material.pages, 'page', 'pages')
          : `Reading, about ${String(reading)} min`,
      ]}
      aside={
        <div className="flex justify-end">
          <MoreMenu
            label={`More for ${material.name}`}
            items={[
              { id: 'open', label: 'Open' },
              { id: 'rename', label: 'Rename' },
              { id: 'remove', label: 'Remove' },
            ]}
            onSelect={onPick}
          />
        </div>
      }
      asideWidth={32}
    />
  );
}

/** The Add at the right end of a list's heading line (course-d27). */
function AddButton({ label, onPick }: { label: string; onPick: () => void }) {
  return (
    <Button icon={Plus} onPress={onPick}>
      {label}
    </Button>
  );
}

/** The line under the name says only what the list cannot: when the next set
 *  is due, as "Next due Thu". With nothing dated it is empty, and the Work
 *  list says "Nothing to do" (course-d26). With one assignment to do, its row
 *  already says the date, so the line stays empty, its height kept (course-d30). */
function standing(todo: readonly CourseSet[], today: Date): string {
  if (todo.length === 1) return '';
  const dated = todo.flatMap((s) => (s.due ? [s.due] : []));
  const next = dated.sort((a, b) => a.getTime() - b.getTime())[0] as
    | Date
    | undefined;
  if (!next) return '';
  const due = dueClause(next, today);
  return `${due.overdue ? 'Was' : 'Next'} ${due.text}`;
}

const figureOf = (value: string) => (
  <p className="ds-heading ds-tabular text-(--ds-fg)">{value}</p>
);

const small = 'ds-small truncate text-(--ds-fg-muted)';

/** The stats box, as Home's: the heatmap and this week beside it, with the
 *  questions done and the cost so far under the bars. A course with no study
 *  keeps the box and says so, at the same height (course-d18). */
function Stats({ course, today }: { course: CourseData; today: Date }) {
  const day = studyDay(today);
  const s = homeStats(course.study, day);
  const none = s.days.every((d) => d.minutes === 0) && course.cost === 0;
  const total = course.study.reduce(
    (n, d) => n + d.courses.reduce((m, c) => m + c.minutes, 0),
    0,
  );
  const timeChange = changeOf(s.time.week, s.time.last);
  const questionsChange = changeOf(s.questions.week, s.questions.last);
  return (
    <Beside
      heatmap={<Heatmap days={course.study} today={day} weeks={WEEKS} grow />}
      week={
        <>
          <Caption>
            {total === 0 ? (
              <>
                <p className="ds-body text-(--ds-fg)">No study time yet</p>
                <p className="ds-small text-(--ds-fg-muted)">It shows here</p>
              </>
            ) : (
              <>
                <p className="ds-body ds-tabular text-(--ds-fg)">
                  {minutesText(s.time.week)}{' '}
                  <span className="text-(--ds-fg-muted)">this week</span>
                </p>
                <p className="ds-small ds-tabular flex flex-wrap items-center gap-x-2 text-(--ds-fg-muted)">
                  {`Last week by now: ${minutesText(s.time.last)}`}
                  {timeChange && <ChangeText change={timeChange} />}
                </p>
              </>
            )}
          </Caption>
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
              figure={figureOf(String(s.questions.week))}
              label={
                <p className="ds-small flex items-center gap-x-2 whitespace-nowrap text-(--ds-fg-muted)">
                  <span>Problems done</span>
                  {questionsChange && <ChangeText change={questionsChange} />}
                </p>
              }
              caption={
                <Moved text={`Last week by now: ${String(s.questions.last)}`} />
              }
              trailing={<Sparkline values={s.spark.questions} height={28} />}
            />
            <Row
              figure={figureOf(money(course.cost))}
              label={<p className={small}>Cost so far</p>}
              caption={
                <Moved
                  text={
                    none
                      ? 'Nothing spent yet'
                      : `${money(course.monthCost)} this month`
                  }
                />
              }
              trailing={<Sparkline values={course.costSpark} height={28} />}
            />
          </Rows>
        </>
      }
    />
  );
}

const DAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

/** The course page, loaded or as its quiet form: the name, when the link
 *  carried it, under the top bar, and nothing past it (loading D2). A failed
 *  read keeps that and says so under the name (A3). */
export function CoursePage({
  course,
  name: known,
  failed,
  today,
  unfolded,
  workHref,
  materialsHref,
  memoriesHref = '#',
  homeHref = '/',
  settingsHref = '/settings',
  loading,
}: Waits<
  {
    /** The course's name, from the link that was clicked; drawn while the
     *  course loads. */
    name?: string;
    /** The read failed: the page says so and offers Try again. */
    failed?: boolean;
    /** The moment due dates count from. */
    today: Date;
    /** Opens every fold (the design page only). */
    unfolded?: boolean;
    /** Where Work's "Show all" goes. */
    workHref: string;
    /** Where Materials' "Show all" goes. */
    materialsHref: string;
    /** Where the memories' "Show all" goes. */
    memoriesHref?: string;
    homeHref?: string;
    settingsHref?: string;
  },
  { course: CourseData }
>) {
  const [seen, setSeen] = useState(course);
  const [name, setName] = useState(course?.name ?? known ?? '');
  const [sets, setSets] = useState(course?.sets ?? []);
  const [materials, setMaterials] = useState(course?.materials ?? []);
  const [memories, setMemories] = useState(course?.memories ?? []);
  const [side, setSide] = useState('todo');
  const [renaming, setRenaming] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<Pending>();
  const [dropping, setDropping] = useState(false);
  const workPicker = useRef<HTMLInputElement>(null);
  const materialPicker = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<Pending>(undefined);
  const timer = useRef<number>(undefined);

  // The page follows the course it is given when that changes.
  if (seen !== course && course !== undefined) {
    setSeen(course);
    setName(course.name);
    setSets(course.sets);
    setMaterials(course.materials);
    setMemories(course.memories);
    setRenaming(undefined);
    setConfirming(false);
    setPending(undefined);
  }

  // The ref follows the state; it is what the timer and the handlers read.
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );

  /** Lets go of the deleted row: it is gone for good. */
  const settle = () => {
    window.clearTimeout(timer.current);
    const p = pendingRef.current;
    pendingRef.current = undefined;
    setPending(undefined);
    if (!p) return;
    if (p.kind === 'set') setSets((all) => all.filter((x) => x.id !== p.id));
    else setMaterials((all) => all.filter((x) => x.id !== p.id));
  };
  const mark = (p: Pending) => {
    settle();
    pendingRef.current = p;
    setPending(p);
    timer.current = window.setTimeout(settle, UNDO_ROW_MS);
  };
  const undo = () => {
    window.clearTimeout(timer.current);
    pendingRef.current = undefined;
    setPending(undefined);
  };
  const rename = (id: string) => {
    settle();
    setRenaming(id);
  };

  // What is drawn past the name: the course, once it is in and read.
  const body = loading === true || failed === true ? undefined : course;
  const { todo, done } = split(sets);
  const switchProps =
    done.length > 0
      ? {
          states: [
            { id: 'todo', label: 'To do', count: todo.length },
            { id: 'done', label: 'Done', count: done.length },
          ],
        }
      : {};
  // A list with no finished set has no switch and stays on To do; the list
  // never switches by itself.
  const shownSide = done.length > 0 ? side : 'todo';
  if (side !== shownSide) setSide(shownSide);

  const addedMaterials = (files: readonly string[]) => {
    if (files.length === 0) return;
    settle();
    setMaterials((all) => [
      ...all,
      ...files.map((f, i) => ({
        id: `new-${String(nextId++)}-${String(i)}`,
        name: f,
        kind: 'New file',
        pages: 0,
        readingMinutes: 2,
      })),
    ]);
  };
  const addedWork = (files: readonly string[]) => {
    if (files.length === 0) return;
    settle();
    setSets((all) => [
      ...all,
      ...files.map((f, i) => ({
        id: `new-${String(nextId++)}-${String(i)}`,
        name: f,
        done: 0,
        total: 0,
        readingMinutes: 2,
      })),
    ]);
  };
  const names = (list: FileList | null) =>
    Array.from(list ?? [], (f) => f.name);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDropping(false);
    addedMaterials(names(e.dataTransfer.files));
  };

  const nameField = (id: string, value: string, apply: (n: string) => void) =>
    renaming === id ? (
      <NameField
        value={value}
        inline="row"
        onDone={(n) => {
          apply(n.trim() || value);
          setRenaming(undefined);
        }}
        onCancel={() => {
          setRenaming(undefined);
        }}
      />
    ) : undefined;

  const setRow = (s: CourseSet, finished: boolean) =>
    pending?.kind === 'set' && pending.id === s.id ? (
      <UndoRow key={s.id} text={`Deleted ${s.name}`} onUndo={undo} />
    ) : (
      <WorkRow
        key={s.id}
        set={s}
        today={today}
        finished={finished}
        titleField={nameField(s.id, s.name, (n) => {
          setSets((all) =>
            all.map((x) => (x.id === s.id ? { ...x, name: n } : x)),
          );
        })}
        onPick={(id) => {
          if (id === 'rename') rename(s.id);
          if (id === 'delete') mark({ kind: 'set', id: s.id, name: s.name });
        }}
      />
    );

  return (
    <div>
      <TopBar
        homeHref={homeHref}
        settingsHref={settingsHref}
        path={name === '' ? [] : [{ label: name }]}
      />
      <div className="px-(--ds-gutter) pb-16">
        <div
          className={`@container mx-auto max-w-(--ds-page-width) rounded-(--ds-radius-control) ${dropping ? 'outline-2 outline-dashed outline-(--ds-accent)' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDropping(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null))
              setDropping(false);
          }}
          onDrop={onDrop}
        >
          <input
            ref={workPicker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addedWork(names(e.target.files));
              e.target.value = '';
            }}
          />
          <input
            ref={materialPicker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              addedMaterials(names(e.target.files));
              e.target.value = '';
            }}
          />
          <>
            <div className="ds-room-display">
              <div className="flex min-w-0 items-start justify-between gap-4">
                {renaming === 'course' ? (
                  <div className="min-w-0 flex-1">
                    <NameField
                      value={name}
                      inline="heading"
                      onDone={(n) => {
                        setName(n.trim() || name);
                        setRenaming(undefined);
                      }}
                      onCancel={() => {
                        setRenaming(undefined);
                      }}
                    />
                  </div>
                ) : (
                  <h1 className="ds-display min-w-0 text-(--ds-fg) [overflow-wrap:anywhere]">
                    {name}
                  </h1>
                )}
                <div className="shrink-0 pt-2">
                  <MoreMenu
                    label={`More for ${name}`}
                    items={[
                      { id: 'rename', label: 'Rename' },
                      { id: 'delete', label: 'Delete course', danger: true },
                    ]}
                    onSelect={(id) => {
                      if (id === 'rename') rename('course');
                      else {
                        settle();
                        setConfirming(true);
                      }
                    }}
                  />
                </div>
              </div>
              {body && (
                <p className="ds-body mt-2 min-h-(--ds-body-line) text-(--ds-fg-muted) [overflow-wrap:anywhere]">
                  {standing(todo, today)}
                </p>
              )}
            </div>
            {failed === true && (
              <ErrorNotice
                error={{
                  what: `Couldn't load ${name === '' ? 'this course' : name}`,
                  why: "PSet couldn't read this course from your library. Nothing in it was lost.",
                  chain: ['course.load'],
                }}
                actions={[{ label: 'Try again' }]}
              />
            )}
            {body && (
              <>
                {confirming && (
                  <DangerDialog
                    title={`Delete ${name}`}
                    message={`This deletes ${plural(sets.length, 'assignment', 'assignments')} and ${plural(materials.length, 'material', 'materials')}.`}
                    word={name}
                    confirmLabel="Delete course"
                    onConfirm={() => {
                      setConfirming(false);
                      settle();
                      setSets([]);
                      setMaterials([]);
                    }}
                    onCancel={() => {
                      setConfirming(false);
                    }}
                  />
                )}

                {/* The work first, then the stats box, then memories
                  (course-d31): the assignment is above the fold. */}
                <div className="space-y-10">
                  <div>
                    <SectionHeading
                      count={
                        done.length === 0 && todo.length > 0
                          ? countBeside(todo.length)
                          : undefined
                      }
                      button={
                        <AddButton
                          label="Add assignment"
                          onPick={() => {
                            workPicker.current?.click();
                          }}
                        />
                      }
                    >
                      Assignments
                    </SectionHeading>
                    <div className="mt-3">
                      <List
                        {...switchProps}
                        state={shownSide}
                        onState={setSide}
                        cap={LIST_CAP}
                        showAllHref={workHref}
                        empty={
                          sets.length === 0
                            ? 'No assignments yet. Add an assignment sheet.'
                            : shownSide === 'done'
                              ? 'Nothing done yet'
                              : 'Nothing to do'
                        }
                      >
                        {shownSide === 'done'
                          ? done.map((s) => setRow(s, true))
                          : todo.map((s) => setRow(s, false))}
                      </List>
                    </div>
                  </div>

                  <div>
                    <SectionHeading
                      count={countBeside(materials.length)}
                      button={
                        <AddButton
                          label="Add material"
                          onPick={() => {
                            materialPicker.current?.click();
                          }}
                        />
                      }
                    >
                      Materials
                    </SectionHeading>
                    <div className="mt-3">
                      <List
                        cap={LIST_CAP}
                        showAllHref={materialsHref}
                        empty="No materials yet. Add a textbook or slides."
                      >
                        {materials.map((m) =>
                          pending?.kind === 'material' &&
                          pending.id === m.id ? (
                            <UndoRow
                              key={m.id}
                              text={`Deleted ${m.name}. Its work stays.`}
                              onUndo={undo}
                            />
                          ) : (
                            <MaterialRow
                              key={m.id}
                              material={m}
                              titleField={nameField(m.id, m.name, (n) => {
                                setMaterials((all) =>
                                  all.map((x) =>
                                    x.id === m.id ? { ...x, name: n } : x,
                                  ),
                                );
                              })}
                              onPick={(id) => {
                                if (id === 'rename') rename(m.id);
                                if (id === 'remove')
                                  mark({
                                    kind: 'material',
                                    id: m.id,
                                    name: m.name,
                                  });
                              }}
                            />
                          ),
                        )}
                      </List>
                    </div>
                  </div>
                </div>

                <div className="mt-16">
                  <Stats course={body} today={today} />
                </div>

                <div className="mt-10">
                  {/* Hidden with nothing to show (a zero says nothing); the rows
                    are the Memory unit's own (course-d29). */}
                  {memories.length > 0 && (
                    <Fold
                      label={`PSet remembers ${plural(memories.length, 'thing', 'things')}`}
                      defaultOpen={unfolded}
                    >
                      <MemoryList
                        memories={memories.map((text, i) => ({
                          id: `${body.name}-${String(i)}`,
                          text,
                          source: 'you',
                          at: '2026-11-01',
                        }))}
                        showAllHref={memoriesHref}
                      />
                    </Fold>
                  )}
                </div>
              </>
            )}
          </>
        </div>
      </div>
    </div>
  );
}
