import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { Button, IconButton } from '@/components/button';
import { Dialog } from '@/components/dialog';
import { Field, Input } from '@/components/input';
import { Skeleton } from '@/components/skeleton';
import { StepAction } from '@/components/transcript';
import { ApiError } from '@/api/client';
import {
  useAddMemory,
  useMemories,
  useRemoveMemory,
  type Memory,
  type Source,
} from '@/api/memory';

/**
 * The book's preferences in the workspace: the Undo on a save in Ask, and
 * the Memory dialog. Spec: design/memory.md.
 */

/** Undo for a step that saved a memory; "Undone" once it's gone, however
 *  it went. Nothing while the list is still loading. */
export function MemoryUndo({
  bookId,
  memoryId,
}: {
  bookId: string;
  memoryId: string;
}) {
  const memories = useMemories(bookId);
  const remove = useRemoveMemory(bookId);
  if (!memories.data) return null;
  if (!memories.data.some((m) => m.id === memoryId)) return <span>Undone</span>;
  return (
    <StepAction
      onClick={() => {
        remove.mutate(memoryId);
      }}
    >
      Undo
    </StepAction>
  );
}

const SOURCE: Record<Source, string> = { you: 'You', tutor: 'Tutor' };

/**
 * Memory: how you want answers in this book, and yours to prune. Add a
 * sentence at the top; below, every preference with who saved it and when,
 * and Delete. Deletes are immediate, so the one button is Done.
 */
export function MemoryDialog({
  open,
  bookId,
  onClose,
}: {
  open: boolean;
  bookId: string;
  onClose: () => void;
}) {
  const memories = useMemories(bookId);
  const add = useAddMemory(bookId);
  const remove = useRemoveMemory(bookId);
  const [text, setText] = useState('');
  // Adding a sentence that's already here brings back the one there is.
  const [already, setAlready] = useState(false);

  useEffect(() => {
    if (open) {
      setText('');
      setAlready(false);
      add.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const error = add.error instanceof ApiError ? add.error : null;

  const submit = () => {
    if (!text.trim()) return;
    add.mutate(
      { text: text.trim() },
      {
        onSuccess: (m) => {
          setAlready(all.some((x) => x.id === m.id));
          setText('');
        },
      },
    );
  };

  const all = memories.data ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Memory"
      width="wide"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="space-y-5">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex items-start gap-2">
            <Field
              label="Add a preference"
              error={error?.field === 'text' ? error.message : undefined}
              hint={already ? 'That one is already remembered.' : undefined}
              className="min-w-0 flex-1"
            >
              <Input
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setAlready(false);
                }}
                placeholder="Use SI units"
              />
            </Field>
            {/* Level with the input, under its label. */}
            <Button
              type="submit"
              variant="secondary"
              className="mt-6 shrink-0"
              disabled={!text.trim() || add.isPending}
            >
              Add
            </Button>
          </div>
        </form>

        <div className="space-y-3">
          {!memories.data ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : all.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No preferences yet. How you want answers, like units or notation:
              add one above, or tell Ask to remember it.
            </p>
          ) : (
            <ul className="divide-y divide-border-muted">
              {all.map((m) => (
                <MemoryRow
                  key={m.id}
                  m={m}
                  onDelete={() => {
                    remove.mutate(m.id);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function MemoryRow({ m, onDelete }: { m: Memory; onDelete: () => void }) {
  const meta = [
    SOURCE[m.source],
    new Date(m.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }),
  ];
  return (
    <li className="flex items-start gap-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm">{m.text}</p>
        <p className="text-xs text-muted-foreground">{meta.join(' · ')}</p>
      </div>
      <IconButton
        variant="ghost"
        size="sm"
        aria-label="Delete this preference"
        onClick={onDelete}
      >
        <Trash2 />
      </IconButton>
    </li>
  );
}
