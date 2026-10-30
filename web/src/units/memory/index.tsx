import { Sparkles, X } from 'lucide-react';
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

export type MemoryOption = 'list' | 'two-lists' | 'chips' | 'review';

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

const matches = (m: Memory, q: string) =>
  m.text.toLowerCase().includes(q.trim().toLowerCase());

function Intro({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-1">
      <SectionHeading count={count > 0 ? count : undefined}>
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

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <TextField
      label="Search"
      placeholder="Search memories"
      value={value}
      onChange={onChange}
      note={false}
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
      titleField={
        <div className="w-160 max-w-full">
          <TextField
            label="Edit memory"
            inline="row"
            autoFocus
            value={draft}
            onChange={setDraft}
            onCommit={(v) => {
              mem.save(m.id, v);
            }}
            onCancel={mem.stopEdit}
          />
        </div>
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

function OneList({
  mem,
  query,
  setQuery,
  review,
  filter,
  setFilter,
}: {
  mem: Memories;
  query: string;
  setQuery: (v: string) => void;
  review?: boolean;
  filter: string;
  setFilter: (v: string) => void;
}) {
  const shown = mem.items.filter(
    (m) => (filter === 'all' || m.source === filter) && matches(m, query),
  );
  const fresh = review === true ? mem.items.filter((m) => m.fresh).length : 0;
  return (
    <div className="flex flex-col gap-4">
      <Intro count={mem.items.length} />
      {fresh > 0 && (
        <p className="ds-small text-(--ds-attention)">
          {fresh === 1
            ? 'Ask saved 1 preference. Keep it or change it.'
            : `Ask saved ${String(fresh)} preferences. Keep them or change them.`}
        </p>
      )}
      <AddField onAdd={mem.add} />
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-80 flex-1">
          <SearchField value={query} onChange={setQuery} />
        </div>
        <SegmentedControl
          label="Show"
          options={FILTERS}
          value={filter}
          onChange={setFilter}
        />
      </div>
      <List
        empty={
          query.trim()
            ? `No memory matches “${query.trim()}”`
            : 'Nothing here yet'
        }
      >
        {shown.map((m) => (
          <Row key={m.id} m={m} mem={mem} label review={review} />
        ))}
      </List>
      <UndoLine m={mem} />
    </div>
  );
}

function TwoLists({
  mem,
  query,
  setQuery,
}: {
  mem: Memories;
  query: string;
  setQuery: (v: string) => void;
}) {
  const part = (kind: 'you' | 'ask') =>
    mem.items.filter((m) => m.source === kind && matches(m, query));
  const yours = part('you');
  const asked = part('ask');
  const none = query.trim() ? 'No match' : 'Nothing here yet';
  return (
    <div className="flex flex-col gap-4">
      <Intro count={mem.items.length} />
      <div className="max-w-80">
        <SearchField value={query} onChange={setQuery} />
      </div>
      <List title="Yours" count={yours.length}>
        {[
          ...yours.map((m) => <Row key={m.id} m={m} mem={mem} label={false} />),
          yours.length === 0 ? (
            <p key="none" className="ds-small px-4 py-3 text-(--ds-fg-muted)">
              {none}
            </p>
          ) : null,
          <div key="add" className="bg-(--ds-bg-raised) px-4 py-2">
            <AddField onAdd={mem.add} />
          </div>,
        ]}
      </List>
      <List title="Saved from Ask" count={asked.length} empty={none}>
        {asked.map((m) => (
          <Row key={m.id} m={m} mem={mem} label={false} />
        ))}
      </List>
      <UndoLine m={mem} />
    </div>
  );
}

function Chip({ m, mem }: { m: Memory; mem: Memories }) {
  const [draft, setDraft] = useState(m.text);
  if (mem.editId === m.id) {
    return (
      <div
        className="flex h-8 w-96 max-w-full items-center rounded-full border border-(--ds-accent) px-2"
        onBlur={mem.stopEdit}
      >
        <TextField
          label="Edit memory"
          inline="row"
          autoFocus
          value={draft}
          onChange={setDraft}
          onCommit={(v) => {
            mem.save(m.id, v);
          }}
          onCancel={mem.stopEdit}
        />
      </div>
    );
  }
  return (
    <span className="ds-body inline-flex h-8 max-w-full items-center rounded-full border border-(--ds-border) text-(--ds-fg)">
      <button
        type="button"
        title={m.source === 'ask' ? `${m.text} (saved from Ask)` : m.text}
        onClick={() => {
          mem.startEdit(m.id);
        }}
        className="inline-flex h-full min-w-0 items-center gap-1 rounded-l-full pr-1 pl-3 hover:bg-(--ds-hover)"
      >
        {m.source === 'ask' && (
          <Sparkles
            className="size-3 shrink-0 text-(--ds-fg-muted)"
            aria-hidden
          />
        )}
        <span className="min-w-0 truncate">{m.text}</span>
      </button>
      <button
        type="button"
        aria-label={`Delete “${m.text}”`}
        onClick={() => {
          mem.remove(m.id);
        }}
        className="inline-flex h-full shrink-0 items-center rounded-r-full pr-2 pl-1 text-(--ds-fg-muted) hover:bg-(--ds-hover) hover:text-(--ds-fg)"
      >
        <X className="size-4" aria-hidden />
      </button>
    </span>
  );
}

function AddChip({ mem }: { mem: Memories }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!open)
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="ds-body inline-flex h-8 items-center rounded-full border border-dashed border-(--ds-border) px-3 text-(--ds-fg-muted) hover:bg-(--ds-hover) hover:text-(--ds-fg)"
      >
        + Add
      </button>
    );
  const close = () => {
    setOpen(false);
    setText('');
  };
  return (
    <div
      className="flex h-8 w-96 max-w-full items-center rounded-full border border-(--ds-accent) px-2"
      onBlur={close}
    >
      <TextField
        label="Add a memory"
        inline="row"
        autoFocus
        placeholder="Use V_0, V_1 for nodal voltages"
        value={text}
        onChange={setText}
        onCommit={(v) => {
          mem.add(v);
          close();
        }}
        onCancel={close}
      />
    </div>
  );
}

function Chips({
  mem,
  query,
  setQuery,
}: {
  mem: Memories;
  query: string;
  setQuery: (v: string) => void;
}) {
  const part = (kind: 'you' | 'ask') =>
    mem.items.filter((m) => m.source === kind && matches(m, query));
  const yours = part('you');
  const asked = part('ask');
  const searching = query.trim() !== '';
  return (
    <div className="flex flex-col gap-4">
      <Intro count={mem.items.length} />
      <div className="max-w-80">
        <SearchField value={query} onChange={setQuery} />
      </div>
      {searching && yours.length + asked.length === 0 && (
        <p className="ds-small text-(--ds-fg-muted)">
          No memory matches “{query.trim()}”
        </p>
      )}
      <div className="flex flex-col gap-2">
        <p className="ds-small text-(--ds-fg-muted)">Yours</p>
        <div className="flex flex-wrap gap-2">
          {yours.map((m) => (
            <Chip key={m.id} m={m} mem={mem} />
          ))}
          <AddChip mem={mem} />
        </div>
      </div>
      {asked.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="ds-small text-(--ds-fg-muted)">Saved from Ask</p>
          <div className="flex flex-wrap gap-2">
            {asked.map((m) => (
              <Chip key={m.id} m={m} mem={mem} />
            ))}
          </div>
        </div>
      )}
      <UndoLine m={mem} />
    </div>
  );
}

/** Mocks of the memory area, one option per state (memory-d1). Sample
 *  data only: add, search, edit and delete work on it and nothing is kept. */
export function MemoryArea({
  option,
  empty,
  query: startQuery = '',
  editing,
  deleted,
}: {
  option: MemoryOption;
  /** Nothing remembered yet. */
  empty?: boolean;
  /** What the search starts with. */
  query?: string;
  /** The id of the memory that starts being edited. */
  editing?: string;
  /** The id of the memory that starts deleted, with Undo showing. */
  deleted?: string;
}) {
  const mem = useMemories(empty ? [] : SAMPLE, deleted, editing);
  const [query, setQuery] = useState(startQuery);
  const [filter, setFilter] = useState('all');
  const frame = (body: ReactNode) => <div className="min-w-0">{body}</div>;
  if (mem.items.length === 0 && mem.undo === null && !query)
    return frame(<EmptyMemory mem={mem} />);
  if (option === 'two-lists')
    return frame(<TwoLists mem={mem} query={query} setQuery={setQuery} />);
  if (option === 'chips')
    return frame(<Chips mem={mem} query={query} setQuery={setQuery} />);
  return frame(
    <OneList
      mem={mem}
      query={query}
      setQuery={setQuery}
      review={option === 'review'}
      filter={filter}
      setFilter={setFilter}
    />,
  );
}
