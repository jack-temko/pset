import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/units/button';
import { Link } from '@/units/link';
import { List, LIST_CAP } from '@/units/list';
import { ListRow, UndoRow, UNDO_ROW_MS } from '@/units/list-row';
import { MoreMenu } from '@/units/menu';
import { SectionHeading } from '@/units/section-heading';
import { TextField } from '@/units/text-field';
import { SAMPLE, TODAY, when, type Memory } from './sample';

const ROW_MENU = [
  { id: 'edit', label: 'Edit' },
  { id: 'forget', label: 'Forget', danger: true },
] as const;

/** The sample's memories and what can be done to them. Nothing is saved.
 *  A forgotten memory stays in its place as an Undo row for 10 seconds, or
 *  until the next one is forgotten, then goes (memory-d8). */
function useMemories(
  start: readonly Memory[],
  deleted: string | undefined,
  editing: string | undefined,
) {
  const [all, setAll] = useState<readonly Memory[]>(start);
  const [gone, setGone] = useState<string | null>(deleted ?? null);
  const [editId, setEditId] = useState<string | null>(editing ?? null);
  const [next, setNext] = useState(1);
  const timer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );
  const settle = (id: string | null) => {
    if (id !== null) setAll((xs) => xs.filter((m) => m.id !== id));
    setGone((g) => (g === id ? null : g));
  };

  return {
    /** Every memory still kept: what counts and lists use. */
    items: all.filter((m) => m.id !== gone),
    /** In order with the forgotten one, which draws as its Undo row. */
    all,
    gone,
    editId,
    startEdit: (id: string) => {
      setEditId(id);
    },
    stopEdit: () => {
      setEditId(null);
    },
    add: (text: string) => {
      const t = text.trim();
      if (!t) return;
      setAll((xs) => [
        { id: `new${String(next)}`, text: t, source: 'you', at: TODAY },
        ...xs,
      ]);
      setNext(next + 1);
    },
    save: (id: string, text: string) => {
      const t = text.trim();
      setEditId(null);
      if (!t) return;
      setAll((xs) => xs.map((m) => (m.id === id ? { ...m, text: t } : m)));
    },
    remove: (id: string) => {
      window.clearTimeout(timer.current);
      if (gone !== null) settle(gone);
      setGone(id);
      setEditId(null);
      timer.current = window.setTimeout(() => {
        settle(id);
      }, UNDO_ROW_MS);
    },
    restore: () => {
      window.clearTimeout(timer.current);
      setGone(null);
    },
    keep: (id: string) => {
      setAll((xs) => xs.map((m) => (m.id === id ? { ...m, fresh: false } : m)));
    },
  };
}

type Memories = ReturnType<typeof useMemories>;

function Intro({ count, action }: { count: number; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <SectionHeading count={count > 0 ? count : undefined} action={action}>
        Memory
      </SectionHeading>
      <p className="ds-small text-(--ds-fg-muted)">
        How you like things explained. PSet follows these in every answer.
      </p>
    </div>
  );
}

function AddField({
  onAdd,
  note,
}: {
  onAdd: (text: string) => void;
  note?: ReactNode;
}) {
  const [text, setText] = useState('');
  const [round, setRound] = useState(0);
  const add = (v: string) => {
    if (!v.trim()) return;
    onAdd(v);
    setText('');
    setRound(round + 1);
  };
  return (
    <TextField
      key={round}
      label="Add a memory"
      placeholder="Use V_0, V_1 for nodal voltages"
      multiline
      value={text}
      onChange={setText}
      onCommit={add}
      note={note ?? false}
      action={
        <Button
          onPress={() => {
            add(text);
          }}
        >
          Add
        </Button>
      }
    />
  );
}

function source(m: Memory, label: boolean): ReactNode[] {
  const date = when(m.at);
  if (m.source === 'you') return label ? ['You', date] : [date];
  return [
    <Link key="s" href={m.chat ?? '#'} tone="muted" size="small">
      {label ? 'Saved from Ask' : 'Open the chat'}
    </Link>,
    date,
  ];
}

function EditingRow({ m, mem }: { m: Memory; mem: Memories }) {
  const [draft, setDraft] = useState(m.text);
  return (
    <ListRow
      title={m.text}
      wrap
      titleField={
        <TextField
          label="Edit memory"
          inline="row"
          multiline
          autoFocus
          value={draft}
          onChange={setDraft}
          onCommit={(v) => {
            mem.save(m.id, v);
          }}
          onCancel={mem.stopEdit}
        />
      }
      meta={source(m, true)}
      asideWidth="auto"
      aside={
        <div className="flex gap-2">
          <Button
            variant="primary"
            onPress={() => {
              mem.save(m.id, draft);
            }}
          >
            Save
          </Button>
          <Button variant="quiet" onPress={mem.stopEdit}>
            Cancel
          </Button>
        </div>
      }
    />
  );
}

function Row({
  m,
  mem,
  label,
  review,
}: {
  m: Memory;
  mem: Memories;
  label: boolean;
  review?: boolean;
}) {
  if (mem.editId === m.id) return <EditingRow m={m} mem={mem} />;
  const fresh = review === true && m.fresh === true;
  const menu = (
    <MoreMenu
      label={`More for “${m.text}”`}
      items={ROW_MENU}
      onSelect={(id) => {
        if (id === 'edit') mem.startEdit(m.id);
        else mem.remove(m.id);
      }}
    />
  );
  return (
    <ListRow
      title={m.text}
      wrap
      meta={source(m, label)}
      asideWidth="auto"
      aside={
        fresh ? (
          <div className="flex gap-2">
            <Button
              variant="quiet"
              onPress={() => {
                mem.keep(m.id);
              }}
            >
              Keep
            </Button>
            <Button
              variant="quiet"
              onPress={() => {
                mem.startEdit(m.id);
              }}
            >
              Edit
            </Button>
            {menu}
          </div>
        ) : (
          menu
        )
      }
    />
  );
}

/** The list's two sides, as a switch in its header (L11 of
 *  ideas/list-pattern-grill.md): the student's own and what Ask saved. */
const SIDES = [
  { id: 'new', label: 'New' },
  { id: 'you', label: 'Yours' },
  { id: 'ask', label: 'From Ask' },
] as const;

function EmptyMemory({ mem }: { mem: Memories }) {
  return (
    <div className="flex flex-col gap-4">
      <Intro count={0} />
      <p className="ds-body text-(--ds-fg)">
        PSet remembers how you like things explained, such as “use V_0, V_1 for
        nodal voltages” or “no PSpice”. Add one below, or ask Ask to remember
        something.
      </p>
      <AddField onAdd={mem.add} />
    </div>
  );
}

/** The memory area (memory-d1, memory-d6): the add field, then one list with
 *  New, Yours and From Ask as its header switch, five rows and "Show all N" to
 *  the list page (the list pattern). New, what Ask just saved, with Keep and
 *  Edit, shows only while it holds something, and the list opens on it. Sample
 *  data only: add, edit, keep and forget work on it and nothing is kept. */
export function MemoryArea({
  empty,
  editing,
  deleted,
  side: startSide,
  showAllHref,
}: {
  /** Nothing remembered yet. */
  empty?: boolean;
  /** The id of the memory that starts being edited. */
  editing?: string;
  /** The id of the memory that starts forgotten, with Undo showing. */
  deleted?: string;
  /** Which side of the switch starts chosen; New when Ask saved something and none is given. */
  side?: 'new' | 'you' | 'ask';
  /** Where "Show all" goes: the list page's memories. */
  showAllHref: string;
}) {
  const mem = useMemories(empty ? [] : SAMPLE, deleted, editing);
  const waiting = mem.items.some((m) => m.fresh === true);
  const [picked, setPicked] = useState<string>(
    startSide ?? (waiting ? 'new' : 'you'),
  );
  if (mem.items.length === 0 && mem.gone === null)
    return (
      <div className="min-w-0">
        <EmptyMemory mem={mem} />
      </div>
    );
  const sideOf = (m: Memory) => (m.fresh === true ? 'new' : m.source);
  const states = SIDES.map((s) => ({
    id: s.id,
    label: s.label,
    count: mem.items.filter((m) => sideOf(m) === s.id).length,
  })).filter((s) => s.id !== 'new' || s.count > 0);
  // New goes once its last memory is kept; the list falls back to Yours.
  const side = states.some((s) => s.id === picked) ? picked : 'you';
  const shown = mem.all.filter((m) => sideOf(m) === side);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Intro count={mem.items.length} />
      <AddField onAdd={mem.add} />
      <List
        states={states}
        state={side}
        onState={setPicked}
        cap={LIST_CAP}
        showAllHref={showAllHref}
        empty={
          side === 'you'
            ? 'You have not added any yet'
            : 'Ask has not saved any yet'
        }
      >
        {shown.map((m) =>
          m.id === mem.gone ? (
            <UndoRow
              key={m.id}
              text={`Forgot “${m.text}”`}
              onUndo={mem.restore}
            />
          ) : (
            <Row
              key={m.id}
              m={m}
              mem={mem}
              label={false}
              review={side === 'new'}
            />
          ),
        )}
      </List>
    </div>
  );
}

/** The Memory list alone, for a fold on another screen (Course): the same
 *  rows (whole text, the "..." menu, Undo), capped with "Show all", with no
 *  intro, add field or switch (memory-d7). */
export function MemoryList({
  memories,
  showAllHref,
}: {
  memories: readonly Memory[];
  /** Where "Show all" goes: the list page's memories for this course. */
  showAllHref: string;
}) {
  const mem = useMemories(memories, undefined, undefined);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <List cap={LIST_CAP} showAllHref={showAllHref} empty="Nothing remembered">
        {mem.all.map((m) =>
          m.id === mem.gone ? (
            <UndoRow
              key={m.id}
              text={`Forgot “${m.text}”`}
              onUndo={mem.restore}
            />
          ) : (
            <Row key={m.id} m={m} mem={mem} label={false} />
          ),
        )}
      </List>
    </div>
  );
}
