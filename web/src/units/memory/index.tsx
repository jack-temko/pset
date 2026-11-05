import { useState, type ReactNode } from 'react';

import { Button } from '@/units/button';
import { Link } from '@/units/link';
import { List, LIST_CAP } from '@/units/list';
import { ListRow } from '@/units/list-row';
import { MoreMenu } from '@/units/menu';
import { SectionHeading } from '@/units/section-heading';
import { TextField } from '@/units/text-field';
import { SAMPLE, TODAY, when, type Memory } from './sample';

const ROW_MENU = [
  { id: 'edit', label: 'Edit' },
  { id: 'forget', label: 'Forget', danger: true },
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
            Forgot “{m.undo.memory.text}”
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

/** The memory area (memory-d1, memory-d5): what Ask just saved waits in its
 *  own box with Keep and Edit, never hidden by the switch or the cap; then the
 *  add field and the list, with "Yours" and "From Ask" as its header switch,
 *  five rows and "Show all N" to the list page (the list pattern). Sample data
 *  only: add, edit, keep and forget work on it and nothing is kept. */
export function MemoryArea({
  empty,
  editing,
  deleted,
  side: startSide = 'you',
  showAllHref,
}: {
  /** Nothing remembered yet. */
  empty?: boolean;
  /** The id of the memory that starts being edited. */
  editing?: string;
  /** The id of the memory that starts forgotten, with Undo showing. */
  deleted?: string;
  /** Which side of the switch starts chosen. */
  side?: 'you' | 'ask';
  /** Where "Show all" goes: the list page's memories. */
  showAllHref: string;
}) {
  const mem = useMemories(empty ? [] : SAMPLE, deleted, editing);
  const [side, setSide] = useState<string>(startSide);
  if (mem.items.length === 0 && mem.undo === null)
    return (
      <div className="min-w-0">
        <EmptyMemory mem={mem} />
      </div>
    );
  const fresh = mem.items.filter((m) => m.fresh === true);
  const rest = mem.items.filter((m) => m.fresh !== true);
  const states = SIDES.map((s) => ({
    id: s.id,
    label: s.label,
    count: rest.filter((m) => m.source === s.id).length,
  }));
  const shown = rest.filter((m) => m.source === side);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Intro count={mem.items.length} />
      {fresh.length > 0 && (
        <List title="New from Ask" count={fresh.length}>
          {fresh.map((m) => (
            <Row key={m.id} m={m} mem={mem} label={false} review />
          ))}
        </List>
      )}
      <AddField onAdd={mem.add} />
      <List
        states={states}
        state={side}
        onState={setSide}
        cap={LIST_CAP}
        showAllHref={showAllHref}
        empty={
          side === 'you'
            ? 'You have not added any yet'
            : 'Ask has not saved any yet'
        }
      >
        {shown.map((m) => (
          <Row key={m.id} m={m} mem={mem} label={false} />
        ))}
      </List>
      <UndoLine m={mem} />
    </div>
  );
}
