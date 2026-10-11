import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Box, BoxRow } from '@/components/box';
import { ProgressBar } from '@/components/progress-bar';
import { DoorAction } from '@/components/door';
import { HomeworkStatusLabel } from '@/components/homework-status';
import { Skeleton } from '@/components/skeleton';
import { HomeworkDialog } from '@/pages/workspace/dialogs';
import { AddHomeworkDialog } from '@/pages/workspace/add-homework';
import { AssignmentReads } from '@/pages/workspace/assignment-reads';
import {
  useBookHomework,
  useDeleteHomework,
  useHomeworkSet,
  useUpdateHomework,
} from '@/api/homework';
import type { About } from '@/api/ask';
import type { PendingSel } from '@/components/document/selection';
import { dueLine, dueStatus } from '@/lib/due';
import { cn } from '@/lib/utils';
import {
  setBarLabel,
  listSegments,
  timeLeftWords,
  type HomeworkSet,
} from './progress';
import { Walkthrough } from './walkthrough';

/** A set's row in the list: its title, the bar (as in its header), how many
 *  are done and how long is left, or when it is due when that is not known.
 *  A turned-in set is a fact, so no bar. */
function SetRow({
  h,
  onOpen,
  bar = true,
}: {
  h: HomeworkSet;
  onOpen: () => void;
  bar?: boolean;
}) {
  const status = dueStatus(h);
  const left = timeLeftWords(h);
  return (
    <BoxRow
      onClick={onOpen}
      title={h.title}
      description={
        <span className="block space-y-2 pt-1">
          {bar && h.total > 0 && (
            <ProgressBar segments={listSegments(h)} label={setBarLabel(h)} />
          )}
          <span className="block tabular-nums">
            {h.done} of {h.total} done · {left ?? dueLine(h)}
          </span>
        </span>
      }
      trailing={<HomeworkStatusLabel status={status} />}
    />
  );
}

/** The homework list: active sets, then turned-in ones under a quiet
 *  label. Opening a set fills the panel with its walkthrough. */
export function HomeworkTab({
  bookId,
  initialSet,
  onJump,
  onAskAbout,
  onPickSelection,
  onClearAbout,
  selection,
  onQuestion,
  wide,
}: {
  bookId: string;
  /** From the URL: Home's due list opens a set directly. */
  initialSet?: string;
  onJump: (page: number) => void;
  onAskAbout: (about: About, selection?: PendingSel) => void;
  onPickSelection: (selection: PendingSel) => void;
  onClearAbout: () => void;
  selection: PendingSel | null;
  /** The question on screen, or null when none is (the list, the finish
   *  page): the workspace counts time against it. */
  onQuestion?: (id: string | null) => void;
  /** Focus: the walkthrough lays out in two columns. */
  wide?: boolean;
}) {
  const list = useBookHomework(bookId);
  const remove = useDeleteHomework();
  const [openId, setOpenId] = useState<string | null>(initialSet ?? null);
  // New homework, opened fresh or on a read waiting in the list.
  const [adding, setAdding] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const openSet = useHomeworkSet(openId).data?.homework;
  const updateOpen = useUpdateHomework(openId ?? '');
  const sets = list.data;
  const active = (sets ?? []).filter((h) => !h.turnedInAt);
  const turnedIn = (sets ?? []).filter((h) => h.turnedInAt);

  if (openId) {
    return (
      <>
        <Walkthrough
          key={openId}
          setId={openId}
          onEdit={() => {
            setEditing(true);
          }}
          onDelete={() => {
            if (openSet)
              remove.mutate(openSet, {
                onSuccess: () => {
                  setOpenId(null);
                },
              });
          }}
          onBack={() => {
            setOpenId(null);
          }}
          onJump={onJump}
          onAskAbout={onAskAbout}
          onPickSelection={onPickSelection}
          onClearAbout={onClearAbout}
          selection={selection}
          onQuestion={onQuestion}
          wide={wide}
        />
        {openSet && (
          <HomeworkDialog
            open={editing}
            editing={{ title: openSet.title, due: openSet.dueDate }}
            onClose={() => {
              setEditing(false);
            }}
            onSave={(title, due) => {
              updateOpen.mutate({ title, dueDate: due });
            }}
          />
        )}
      </>
    );
  }

  return (
    <div
      className={cn(
        'min-h-0 flex-1 space-y-4 overflow-y-auto p-card',
        // An empty tab centers its one sentence and the way out.
        sets?.length === 0 && 'flex flex-col justify-center',
      )}
    >
      {sets?.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No homework here yet. New homework takes your professor&apos;s
          assignment (a file, a web page or pasted text), or the questions you
          type.
        </p>
      )}
      {/* Assignments reading in the background, or read and waiting to
          be looked over, first: they're what's new. */}
      <AssignmentReads
        bookId={bookId}
        onReview={(id) => {
          setReviewing(id);
          setAdding(true);
        }}
      />
      {/* No header: the tab already says Homework, and a second label on
          the box only said it again. The way to add one is the list's last
          row, shaped like the Door. */}
      <Box>
        {sets === undefined
          ? [0, 1].map((i) => (
              <BoxRow
                key={i}
                title={<Skeleton className="h-3 w-40" />}
                description={<Skeleton className="h-3 w-48" />}
              />
            ))
          : active.map((h) => (
              <SetRow
                key={h.id}
                h={h}
                onOpen={() => {
                  setOpenId(h.id);
                }}
              />
            ))}
        <DoorAction
          icon={<Plus aria-hidden />}
          onClick={() => {
            setAdding(true);
          }}
          className={cn(
            (sets === undefined || active.length > 0) &&
              'border-t border-border-muted',
          )}
        >
          New homework
        </DoorAction>
      </Box>
      {turnedIn.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">Turned in</p>
          <Box>
            {turnedIn.map((h) => (
              <SetRow
                key={h.id}
                h={h}
                bar={false}
                onOpen={() => {
                  setOpenId(h.id);
                }}
              />
            ))}
          </Box>
        </>
      )}

      {/* One set made lands you in it; several stay on the list, where
          they all are. */}
      <AddHomeworkDialog
        open={adding}
        bookId={bookId}
        readId={reviewing}
        onClose={() => {
          setAdding(false);
          setReviewing(null);
        }}
        onDone={(made) => {
          if (made.length === 1) setOpenId(made[0].id);
        }}
      />
    </div>
  );
}
