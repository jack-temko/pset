import { Plus } from 'lucide-react';
import { useRef, useState, type DragEvent, type ReactNode } from 'react';

import { Button } from '@/units/button';
import { Confirm } from '@/units/confirm';
import { Fold } from '@/units/fold';
import { List } from '@/units/list';
import { ListRow } from '@/units/list-row';
import { MoreMenu } from '@/units/menu';
import { ProgressBar } from '@/units/progress-bar';
import { SectionHeading } from '@/units/section-heading';
import { dueBadge } from '@/units/set-line/badge';
import { dueText, minutesText, timeLeft } from '@/units/set-line/dates';
import { TextField } from '@/units/text-field';
import { TopBar } from '@/units/top-bar';
import { plural, standing } from './standing';
import type { CourseData, CourseMaterial, CourseSet } from './sample';

const money = (n: number) => `$${n.toFixed(2)}`;

/** The work row's aside: the progress bar, then the row's menu. */
const WORK_ASIDE = 'clamp(200px, 24cqw, 360px)';

/** To do by due date, undated last; the finished apart. */
function split(sets: readonly CourseSet[]) {
  const stamp = (s: CourseSet) => s.due?.getTime() ?? Infinity;
  return {
    todo: sets
      .filter((s) => s.done < s.total)
      .sort((a, b) => stamp(a) - stamp(b)),
    done: sets.filter((s) => s.done >= s.total),
  };
}

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) ${className}`}
    />
  );
}

interface Undo {
  what: string;
  restore: () => void;
}

function WorkRow({
  set,
  today,
  onPick,
}: {
  set: CourseSet;
  today: Date;
  onPick: (id: 'open' | 'rename' | 'delete') => void;
}) {
  const time = set.minutesLeft === undefined ? '' : timeLeft(set.minutesLeft);
  return (
    <ListRow
      title={set.name}
      href="#"
      label={dueBadge(set.due, today)}
      status={set.due && dueText(set.due, today).text}
      meta={time ? [time] : []}
      aside={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <ProgressBar done={set.done} total={set.total} />
          </div>
          <MoreMenu
            label={`More for ${set.name}`}
            items={[
              { id: 'open', label: 'Open' },
              { id: 'rename', label: 'Rename' },
              { id: 'delete', label: 'Delete', danger: true },
            ]}
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
  onPick,
}: {
  material: CourseMaterial;
  onPick: (id: 'open' | 'rename' | 'remove') => void;
}) {
  const reading = material.readingMinutes;
  return (
    <ListRow
      title={material.name}
      href="#"
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

/** A row while its name is being changed: the field, committed on Enter or
 *  on leaving it. */
function Renaming({
  value,
  onDone,
}: {
  value: string;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState(value);
  return (
    <div className="px-4 pt-2">
      <TextField
        label="Name"
        value={name}
        onChange={setName}
        onCommit={onDone}
      />
    </div>
  );
}

/** The course page (C1 to C13, all assumed, to confirm with Jack): the name,
 *  one muted line of where it stands, then Work, Materials and a quiet
 *  footer. One Add takes any file, and files dropped on the page are added
 *  too. It reads sample data; nothing is saved. */
export function Course({
  course,
  failed,
  today,
  unfolded,
  homeHref = '/',
  settingsHref = '/settings',
}: {
  course: CourseData;
  /** The read failed: the page says so and offers Try again. */
  failed?: boolean;
  /** The moment due dates count from. */
  today: Date;
  /** Opens every fold (the design page only). */
  unfolded?: boolean;
  homeHref?: string;
  settingsHref?: string;
}) {
  const [name, setName] = useState(course.name);
  const [sets, setSets] = useState(course.sets);
  const [materials, setMaterials] = useState(course.materials);
  const [memories, setMemories] = useState(course.memories);
  const [renaming, setRenaming] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [undo, setUndo] = useState<Undo>();
  const [dropping, setDropping] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const { todo, done } = split(sets);
  const empty = sets.length === 0 && materials.length === 0;

  const added = (n: number) => {
    if (n === 0) return;
    setUndo(undefined);
    setNotice(
      `Added ${plural(n, 'file', 'files')}. PSet is sorting work from materials.`,
    );
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDropping(false);
    added(e.dataTransfer.files.length);
  };

  const removeSet = (s: CourseSet) => {
    const before = sets;
    setSets(sets.filter((x) => x.id !== s.id));
    setNotice(undefined);
    setUndo({
      what: `Deleted ${s.name}.`,
      restore: () => {
        setSets(before);
      },
    });
  };
  const removeMaterial = (m: CourseMaterial) => {
    const before = materials;
    setMaterials(materials.filter((x) => x.id !== m.id));
    setNotice(undefined);
    setUndo({
      what: `Removed ${m.name}. Its work stays.`,
      restore: () => {
        setMaterials(before);
      },
    });
  };

  const add = (
    <Button
      variant="primary"
      icon={Plus}
      onPress={() => picker.current?.click()}
    >
      Add
    </Button>
  );

  let line: ReactNode = (
    <p className="ds-body text-(--ds-fg-muted)">{standing(sets, today)}</p>
  );
  if (undo)
    line = (
      <p className="ds-body flex items-center gap-2 text-(--ds-fg-muted)">
        <span className="min-w-0 truncate">{undo.what}</span>
        <Button
          variant="quiet"
          onPress={() => {
            undo.restore();
            setUndo(undefined);
          }}
        >
          Undo
        </Button>
      </p>
    );
  else if (notice) line = <p className="ds-body text-(--ds-fg)">{notice}</p>;

  return (
    <div className="@container">
      <TopBar
        homeHref={homeHref}
        settingsHref={settingsHref}
        path={[
          { label: 'Home', href: homeHref },
          { label: failed ? 'Course' : name },
        ]}
      />
      <div className="px-(--ds-gutter) pb-16">
        <div
          className={`mx-auto max-w-(--ds-page-width) rounded-(--ds-radius-control) ${dropping ? 'outline-2 outline-dashed outline-(--ds-accent)' : ''}`}
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
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              added(e.target.files?.length ?? 0);
              e.target.value = '';
            }}
          />
          {failed ? (
            <div className="flex flex-col items-center py-32 text-center">
              <p className="ds-heading text-(--ds-fg)">
                Could not load this course
              </p>
              <p className="ds-body mt-2 mb-6 text-(--ds-fg-muted)">
                PSet could not read it. Try again in a moment.
              </p>
              <Button>Try again</Button>
            </div>
          ) : (
            <>
              <div className="ds-room-display">
                <div className="flex min-w-0 items-start justify-between gap-4">
                  {renaming === 'course' ? (
                    <div className="min-w-0 flex-1">
                      <Renaming
                        value={name}
                        onDone={(n) => {
                          setName(n.trim() || name);
                          setRenaming(undefined);
                        }}
                      />
                    </div>
                  ) : (
                    <h1 className="ds-display min-w-0 text-(--ds-fg) [overflow-wrap:anywhere]">
                      {name}
                    </h1>
                  )}
                  <div className="flex shrink-0 items-center gap-2 pt-2">
                    {!empty && add}
                    <MoreMenu
                      label={`More for ${name}`}
                      items={[
                        { id: 'rename', label: 'Rename' },
                        { id: 'delete', label: 'Delete course', danger: true },
                      ]}
                      onSelect={(id) => {
                        if (id === 'rename') setRenaming('course');
                        else setConfirming(true);
                      }}
                    />
                  </div>
                </div>
                <div className="mt-2 flex min-h-8 items-center">
                  {confirming ? null : line}
                </div>
                {confirming && (
                  <div className="mt-2">
                    <Confirm
                      message={`This deletes ${plural(sets.length, 'set', 'sets')} and ${plural(materials.length, 'material', 'materials')}.`}
                      confirmLabel="Delete course"
                      onConfirm={() => {
                        setConfirming(false);
                        setSets([]);
                        setMaterials([]);
                        setNotice('Deleted the course.');
                      }}
                      onCancel={() => {
                        setConfirming(false);
                      }}
                    />
                  </div>
                )}
              </div>

              {empty ? (
                <div className="flex flex-col items-center py-24 text-center">
                  <p className="ds-heading text-(--ds-fg)">Nothing here yet</p>
                  <p className="ds-body mt-2 mb-6 text-(--ds-fg-muted)">
                    Add a textbook, slides or an assignment sheet
                  </p>
                  {add}
                </div>
              ) : (
                <div className="space-y-10">
                  <div>
                    <SectionHeading count={todo.length}>Work</SectionHeading>
                    <div className="mt-3">
                      <List empty="No work yet. Add an assignment sheet.">
                        {[
                          ...todo.map((s) =>
                            renaming === s.id ? (
                              <Renaming
                                key={s.id}
                                value={s.name}
                                onDone={(n) => {
                                  setSets(
                                    sets.map((x) =>
                                      x.id === s.id
                                        ? { ...x, name: n.trim() || x.name }
                                        : x,
                                    ),
                                  );
                                  setRenaming(undefined);
                                }}
                              />
                            ) : (
                              <WorkRow
                                key={s.id}
                                set={s}
                                today={today}
                                onPick={(id) => {
                                  if (id === 'rename') setRenaming(s.id);
                                  if (id === 'delete') removeSet(s);
                                }}
                              />
                            ),
                          ),
                          ...(todo.length === 0 && done.length > 0
                            ? [
                                <p
                                  key="none"
                                  className="ds-small px-4 py-4 text-(--ds-fg-muted)"
                                >
                                  Nothing to do
                                </p>,
                              ]
                            : []),
                          ...(done.length > 0
                            ? [
                                <div key="done" className="px-2">
                                  <Fold
                                    label={`Done (${String(done.length)})`}
                                    defaultOpen={unfolded}
                                  >
                                    <div className="-mx-2 divide-y divide-(--ds-border-muted) border-t border-(--ds-border-muted)">
                                      {done.map((s) => (
                                        <WorkRow
                                          key={s.id}
                                          set={s}
                                          today={today}
                                          onPick={(id) => {
                                            if (id === 'delete') removeSet(s);
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </Fold>
                                </div>,
                              ]
                            : []),
                        ]}
                      </List>
                    </div>
                  </div>

                  <div>
                    <SectionHeading count={materials.length}>
                      Materials
                    </SectionHeading>
                    <div className="mt-3">
                      <List empty="No materials yet. Add a textbook or slides.">
                        {materials.map((m) =>
                          renaming === m.id ? (
                            <Renaming
                              key={m.id}
                              value={m.name}
                              onDone={(n) => {
                                setMaterials(
                                  materials.map((x) =>
                                    x.id === m.id
                                      ? { ...x, name: n.trim() || x.name }
                                      : x,
                                  ),
                                );
                                setRenaming(undefined);
                              }}
                            />
                          ) : (
                            <MaterialRow
                              key={m.id}
                              material={m}
                              onPick={(id) => {
                                if (id === 'rename') setRenaming(m.id);
                                if (id === 'remove') removeMaterial(m);
                              }}
                            />
                          ),
                        )}
                      </List>
                    </div>
                  </div>

                  <div>
                    <SectionHeading>This course</SectionHeading>
                    <div className="mt-3 space-y-1">
                      <p className="ds-small ds-tabular text-(--ds-fg-muted)">
                        {minutesText(course.studiedMinutes)} studied ·{' '}
                        {minutesText(course.weekMinutes)} this week
                      </p>
                      <p className="ds-small ds-tabular text-(--ds-fg-muted)">
                        {money(course.cost)} so far
                      </p>
                      <Fold
                        label={`PSet remembers ${plural(memories.length, 'thing', 'things')}`}
                        defaultOpen={unfolded}
                      >
                        <List empty="PSet remembers nothing yet.">
                          {memories.map((m) => (
                            <ListRow
                              key={m}
                              title={m}
                              aside={
                                <div className="flex justify-end">
                                  <Button
                                    variant="quiet"
                                    onPress={() => {
                                      setMemories(
                                        memories.filter((x) => x !== m),
                                      );
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              }
                              asideWidth={96}
                            />
                          ))}
                        </List>
                      </Fold>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** The course page while it loads: bars where the name, the line and the
 *  lists will be, laid out as the page is. */
export function CourseSkeleton({
  homeHref = '/',
  settingsHref = '/settings',
}: {
  homeHref?: string;
  settingsHref?: string;
}) {
  return (
    <div className="@container">
      <TopBar
        homeHref={homeHref}
        settingsHref={settingsHref}
        path={[{ label: 'Home', href: homeHref }, { label: 'Course' }]}
      />
      <div className="px-(--ds-gutter) pb-16">
        <div className="mx-auto max-w-(--ds-page-width)">
          <div className="ds-room-display">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-(--ds-display-line) items-center">
                <Bar className="h-9 w-72" />
              </div>
              <Bar className="mt-2 h-8 w-32" />
            </div>
            <div className="mt-2 flex min-h-8 items-center">
              <Bar className="h-4 w-64" />
            </div>
          </div>
          <div className="space-y-10">
            {[0, 1].map((i) => (
              <div key={i}>
                <div className="flex min-h-8 items-center">
                  <Bar className="h-5 w-32" />
                </div>
                <div className="mt-3 h-[170px]">
                  <Bar className="h-full w-full" />
                </div>
              </div>
            ))}
            <div>
              <div className="flex min-h-8 items-center">
                <Bar className="h-5 w-32" />
              </div>
              <div className="mt-3 space-y-1">
                <Bar className="h-4 w-72" />
                <Bar className="h-4 w-40" />
                <Bar className="h-4 w-56" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
