import { useState, type ReactNode } from 'react';

import { Button } from '@/units/button';
import { Link } from '@/units/link';
import { List } from '@/units/list';
import { ListRow } from '@/units/list-row';
import { MoreMenu } from '@/units/menu';
import { SectionHeading } from '@/units/section-heading';
import { SegmentedControl } from '@/units/segmented-control';
import { Tag } from '@/units/tag';
import { TextField } from '@/units/text-field';
import { SAMPLE, TODAY, when, type Memory } from './sample';

const ROW_MENU = [
  { id: 'edit', label: 'Edit' },
  { id: 'delete', label: 'Delete', danger: true },
] as const;

interface Undo {
  memory: Memory;
  index: number;
}

/** The sample's memories and what can be done to them. Nothing is saved. */
function useMemories(
  start: readonly Memory[],
  deleted: string | undefined,
  editing: string | undefined,
) {
  const [items, setItems] = useState<readonly Memory[]>(() =>
    start.filter((m) => m.id !== deleted),
  );
  const [undo, setUndo] = useState<Undo | null>(() => {
    const index = start.findIndex((m) => m.id === deleted);
    const memory = start.at(index);
    return memory && index >= 0 ? { memory, index } : null;
  });
  const [editId, setEditId] = useState<string | null>(editing ?? null);
  const [next, setNext] = useState(1);

  return {
    items,
    undo,
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
      setItems((all) => [
        { id: `new${String(next)}`, text: t, source: 'you', at: TODAY },
        ...all,
      ]);
      setNext(next + 1);
    },
    save: (id: string, text: string) => {
      const t = text.trim();
      setEditId(null);
      if (!t) return;
      setItems((all) => all.map((m) => (m.id === id ? { ...m, text: t } : m)));
    },
    remove: (id: string) => {
      const index = items.findIndex((m) => m.id === id);
      const memory = items.at(index);
      if (!memory || index < 0) return;
      setItems((all) => all.filter((m) => m.id !== id));
      setUndo({ memory, index });
      setEditId(null);
    },
    restore: () => {
      if (!undo) return;
      setItems((all) => [
        ...all.slice(0, undo.index),
        undo.memory,
        ...all.slice(undo.index),
      ]);
      setUndo(null);
    },
    keep: (id: string) => {
      setItems((all) =>
        all.map((m) => (m.id === id ? { ...m, fresh: false } : m)),
      );
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

function UndoLine({ m }: { m: Memories }) {
  return (
    <div className="ds-small flex min-h-8 items-center gap-2 text-(--ds-fg-muted)">
      {m.undo && (
        <>
          <span className="min-w-0 truncate">
            Deleted “{m.undo.memory.text}”
          </span>
          <Button variant="quiet" onPress={m.restore}>
            Undo
          </Button>
        </>
      )}
    </div>
  );
}

function source(m: Memory, label: boolean): ReactNode[] {
  const date = when(m.at);
  if (m.source === 'you') return label ? ['You', date] : [date];
  return [
    <Link key="s" href={m.chat ?? '#'} tone="muted" size="small">
      {label ? 'Saved from Ask' : 'From Ask'}
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
      label={fresh ? <Tag tone="attention">New</Tag> : undefined}
      meta={source(m, label)}
      asideWidth="auto"
      aside={
        fresh ? (
          <div className="flex gap-2">
            <Button
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

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'you', label: 'Yours' },
  { id: 'ask', label: 'From Ask' },
];

function EmptyMemory({ mem }: { mem: Memories }) {
  return (
    <div className="flex flex-col gap-4">
      <Intro count={0} />
      <p className="ds-body text-(--ds-fg)">
        PSet remembers how you like things explained, such as “use V_0, V_1 for
        nodal voltages” or “no PSpice”. Add one below, or ask in a chat to
        remember a preference.
      </p>
      <AddField onAdd={mem.add} />
    </div>
  );
}

/** How many of Ask's older and the student's own memories show before
 *  "Show all", as Home's lists show five (memory-d3). */
export const MEMORY_CAP = 5;

/** The memory area (memory-d1): Ask's new saves wait above the rest with Keep
 *  and Edit, then the list, capped, with the add field over it. Sample data
 *  only: add, edit, keep and delete work on it and nothing is kept. */
export function MemoryArea({
  empty,
  editing,
  deleted,
  showAll: startShowAll = false,
}: {
  /** Nothing remembered yet. */
  empty?: boolean;
  /** The id of the memory that starts being edited. */
  editing?: string;
  /** The id of the memory that starts deleted, with Undo showing. */
  deleted?: string;
  /** Starts with every memory shown, not the first five. */
  showAll?: boolean;
}) {
  const mem = useMemories(empty ? [] : SAMPLE, deleted, editing);
  const [filter, setFilter] = useState('all');
  const [all, setAll] = useState(startShowAll);
  if (mem.items.length === 0 && mem.undo === null)
    return (
      <div className="min-w-0">
        <EmptyMemory mem={mem} />
      </div>
    );
  const kept = mem.items.filter((m) => filter === 'all' || m.source === filter);
  const fresh = kept.filter((m) => m.fresh === true);
  const rest = kept.filter((m) => m.fresh !== true);
  const shown = [...fresh, ...(all ? rest : rest.slice(0, MEMORY_CAP))];
  const waiting = mem.items.filter((m) => m.fresh === true).length;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Intro
        count={mem.items.length}
        action={
          rest.length > MEMORY_CAP ? (
            <Link
              href="#"
              size="small"
              onClick={(e) => {
                e.preventDefault();
                setAll(!all);
              }}
            >
              {all ? 'Show fewer' : 'Show all'}
            </Link>
          ) : undefined
        }
      />
      {waiting > 0 && (
        <p className="ds-small text-(--ds-attention)">
          {waiting === 1
            ? 'Ask saved 1 preference. Keep it or change it.'
            : `Ask saved ${String(waiting)} preferences. Keep them or change them.`}
        </p>
      )}
      <AddField onAdd={mem.add} />
      <div className="flex justify-end">
        <SegmentedControl
          label="Show"
          options={FILTERS}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <List empty="Nothing here yet">
        {shown.map((m) => (
          <Row key={m.id} m={m} mem={mem} label review />
        ))}
      </List>
      <UndoLine m={mem} />
    </div>
  );
}
