import { Plus } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';

import { money, plural } from '@/lib/format';
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
import type { CourseData, CourseMaterial, CourseSet } from './sample';

/** The work row's aside: the progress bar, then the row's menu. */
const WORK_ASIDE = 'clamp(200px, 24cqw, 360px)';

let nextId = 0;

/** How long a deleted row waits for Undo. */
const UNDO_MS = 10_000;

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

/** A deleted row, kept one line long until the next action or 10 seconds. */
function DeletedRow({ name, onUndo }: { name: string; onUndo: () => void }) {
  return (
    <div className="ds-small flex min-h-10 items-center gap-2 px-4 text-(--ds-fg-muted)">
      <span className="min-w-0 truncate">Deleted {name}</span>
      <span aria-hidden>·</span>
      <Button variant="quiet" onPress={onUndo}>
        Undo
      </Button>
    </div>
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
  const time = set.minutesLeft === undefined ? '' : timeLeft(set.minutesLeft);
  return (
    <ListRow
      title={set.name}
      titleField={titleField}
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

/** The course page (C1 to C13, all assumed, to confirm with Jack): the name,
 *  then Work, Materials and a quiet footer. One Add takes any file, and files
 *  dropped on the page are added too. It reads sample data; nothing is saved. */
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
  const [seen, setSeen] = useState(course);
  const [name, setName] = useState(course.name);
  const [sets, setSets] = useState(course.sets);
  const [materials, setMaterials] = useState(course.materials);
  const [memories, setMemories] = useState(course.memories);
  const [renaming, setRenaming] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<Pending>();
  const [dropping, setDropping] = useState(false);
  const [menuBox, setMenuBox] = useState<HTMLElement | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<Pending>(undefined);
  const timer = useRef<number>(undefined);

  // The page follows the course it is given when that changes.
  if (seen !== course) {
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
    timer.current = window.setTimeout(settle, UNDO_MS);
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

  const { todo, done } = split(sets);
  const empty = sets.length === 0 && materials.length === 0;

  const added = (files: readonly string[]) => {
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
  const names = (list: FileList | null) =>
    Array.from(list ?? [], (f) => f.name);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDropping(false);
    added(names(e.dataTransfer.files));
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
      <DeletedRow key={s.id} name={s.name} onUndo={undo} />
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
        path={[
          { label: 'Home', href: homeHref },
          { label: failed ? 'Course' : name },
        ]}
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
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              added(names(e.target.files));
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
              <div className="ds-room-display flex min-w-0 items-start justify-between gap-4">
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
                <div
                  ref={setMenuBox}
                  className="flex shrink-0 items-center gap-2 pt-2"
                >
                  {!empty && add}
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
              {confirming && (
                <Confirm
                  anchor={menuBox}
                  message={`This deletes ${plural(sets.length, 'set', 'sets')} and ${plural(materials.length, 'material', 'materials')}.`}
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
                    <SectionHeading
                      count={todo.length > 0 ? todo.length : undefined}
                    >
                      Work
                    </SectionHeading>
                    <div className="mt-3">
                      <List empty="No work yet. Add an assignment sheet.">
                        {[
                          ...todo.map((s) => setRow(s, false)),
                          ...(todo.length === 0 && done.length > 0
                            ? [
                                <p
                                  key="none"
                                  className="ds-small px-4 py-4 text-(--ds-fg-muted)"
                                >
                                  Nothing due
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
                                      {done.map((s) => setRow(s, true))}
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
                          pending?.kind === 'material' &&
                          pending.id === m.id ? (
                            <DeletedRow
                              key={m.id}
                              name={`${m.name}. Its work stays.`}
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
                                      settle();
                                      setMemories((all) =>
                                        all.filter((x) => x !== m),
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

/** The course page while it loads: a bar where each part will be, as tall as
 *  the part is (measured from the loaded page), laid out as the page is. */
export function CourseSkeleton({
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
        path={[{ label: 'Home', href: homeHref }, { label: 'Course' }]}
      />
      <div className="px-(--ds-gutter) pb-16">
        <div className="@container mx-auto max-w-(--ds-page-width)">
          <div className="ds-room-display flex items-start justify-between gap-4">
            <div className="flex h-(--ds-display-line) items-center">
              <Bar className="h-9 w-[288px]" />
            </div>
            <Bar className="mt-2 h-8 w-32" />
          </div>
          <div className="space-y-10">
            {SECTIONS.map((h, i) => (
              <div key={i}>
                <div className="flex min-h-8 items-center">
                  <Bar className="h-5 w-32" />
                </div>
                <div className="mt-3">
                  <div style={{ height: h }}>
                    <Bar className="h-full w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Heights of the usual course's Work, Materials and This course bodies. */
const SECTIONS = [95, 184, 80];
