import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Button } from '@/components/button';
import { Box } from '@/components/box';
import { Field, Input } from '@/components/input';
import { ASSIGNMENT, ASSIGNMENT_SETS } from '@/components/fixtures';
import { BoxingBar, BoxingProvider, DrawnBox } from '@/pages/workspace/boxing';
import { useBoxing } from '@/pages/workspace/boxing-state';
import {
  AssignmentReview,
  AssignmentSourceFields,
} from '@/pages/workspace/add-homework';
import { AssignmentReadRow } from '@/pages/workspace/assignment-reads';
import {
  QuestionRows,
  emptyRow,
  type QuestionRow,
} from '@/pages/workspace/dialogs';
import { StudyTimer } from '@/pages/workspace/study-timer';
import { reviewOf } from '@/pages/workspace/import-state';
import type { AssignmentRead } from '@/api/homework';
import { memoryKeys, type Memory } from '@/api/memory';
import { MemoryDialog } from '@/pages/workspace/memory';
import type { ComponentEntry } from './types';
import { Shelf } from './shared';

const PREFERENCES: Memory[] = [
  {
    id: 'a1',
    bookId: 'demo',
    text: 'Use V_0, V_1 for nodal voltages.',
    source: 'you',
    createdAt: '2026-10-08T09:00:00Z',
  },
  {
    id: 'a2',
    bookId: 'demo',
    text: 'Give answers in SI units.',
    source: 'you',
    createdAt: '2026-10-06T09:00:00Z',
  },
  {
    id: 'a3',
    bookId: 'demo',
    text: 'Show every step of the algebra.',
    source: 'tutor',
    createdAt: '2026-10-02T09:00:00Z',
  },
];

/** The Memory dialog on a client of its own, seeded so nothing is fetched. */
function MemoryDemo({ empty }: { empty?: boolean }) {
  const [open, setOpen] = useState(false);
  const [client] = useState(() => {
    const c = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity } },
    });
    c.setQueryData(memoryKeys.list('demo'), empty ? [] : PREFERENCES);
    return c;
  });
  return (
    <QueryClientProvider client={client}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open Memory{empty ? ' (empty)' : ''}
      </Button>
      <MemoryDialog open={open} bookId="demo" onClose={() => setOpen(false)} />
    </QueryClientProvider>
  );
}

/** The boxing bar, in a session with a box already drawn. */
function BoxingDemo() {
  return (
    <BoxingProvider onDone={async () => {}}>
      <StartBoxing />
      <BoxingBar />
    </BoxingProvider>
  );
}

function StartBoxing() {
  const b = useBoxing();
  useEffect(() => {
    if (!b.target) {
      b.start({ kind: 'find', questionId: 'q', label: '3.1 #7' });
      b.add({ page: 123, x: 0.1, y: 0.6, w: 0.4, h: 0.1, kind: 'text' });
    }
  }, [b]);
  return null;
}

/** Reads in the Homework list: reading (still thinking, then finding
 *  lines), read, an update read, failed. */
const READS: AssignmentRead[] = [
  {
    id: 'r1',
    bookId: 'b',
    source: 'https://people.example.edu/~prof/202/homework.htm',
    state: 'reading',
    activity: 'Thinking it over…',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'r0',
    bookId: 'b',
    source: 'Syllabus and homework.pdf',
    state: 'reading',
    activity: 'Found 12 lines so far…',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'r2',
    bookId: 'b',
    source: 'Assignment 3.pdf',
    state: 'ready',
    assignment: ASSIGNMENT,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'r3',
    bookId: 'b',
    source: 'pasted',
    setId: 'set-sep11',
    state: 'ready',
    assignment: ASSIGNMENT,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'r4',
    bookId: 'b',
    source: 'https://canvas.example.edu/courses/461/assignments',
    state: 'failed',
    error:
      'That page answered 401. A page behind a login can be pasted or photographed instead.',
    createdAt: '',
    updatedAt: '',
  },
];

/** Importing an assignment's review, live, on a course page checked
 *  in mid-September. */
function AssignmentReviewDemo() {
  const [groups, setGroups] = useState(() =>
    reviewOf(ASSIGNMENT, '2026-09-18'),
  );
  return (
    <div className="w-dialog-wide rounded-lg border bg-card p-card">
      <AssignmentReview
        source={ASSIGNMENT.source}
        title={ASSIGNMENT.title}
        groups={groups}
        titles={ASSIGNMENT_SETS}
        onChange={setGroups}
        onLeave={() => {}}
      />
    </div>
  );
}

/** Where an assignment comes from, each way in, with a failed read. */
function AssignmentSourceDemo({
  failed,
  toSet,
}: {
  failed?: boolean;
  toSet?: boolean;
}) {
  const [mode, setMode] = useState<'write' | 'file' | 'page' | 'paste'>(
    failed ? 'page' : 'write',
  );
  const [url, setUrl] = useState(
    failed ? 'https://canvas.example.edu/courses/461/assignments' : '',
  );
  const [text, setText] = useState('');
  const [rows, setRows] = useState<QuestionRow[]>(() => [
    { ...emptyRow(), text: '2.1: 1, 4, 6 (do c)' },
    { ...emptyRow(), text: 'A tank holds 100 L of brine…', inBook: false },
  ]);
  return (
    <div className="w-dialog-wide rounded-lg border bg-card p-card">
      <AssignmentSourceFields
        mode={mode}
        onMode={setMode}
        url={url}
        onUrl={setUrl}
        remembered={false}
        updating={toSet ? 'Homework due Sep 11' : undefined}
        text={text}
        onText={setText}
        error={
          failed
            ? 'That page answered 401. A page behind a login can be pasted or photographed instead.'
            : ''
        }
        onSubmit={() => {}}
        onLeave={() => {}}
        write={
          <div className="space-y-4">
            {!toSet && (
              <div className="flex items-start gap-2">
                <Field label="Title" className="min-w-0 flex-1">
                  <Input placeholder="Problem set 4" />
                </Field>
                <Field label="Due date" className="w-40">
                  <Input type="date" />
                </Field>
              </div>
            )}
            <QuestionRows
              rows={rows}
              onRows={setRows}
              readingOf={() => undefined}
              onSubmit={() => {}}
            />
          </div>
        }
      />
    </div>
  );
}

export const composedSections: ComponentEntry[] = [
  {
    id: 'boxing-on-the-page',
    title: 'Boxing on the page',
    group: 'Composed',
    note: "Drawing a problem's boxes on the scan: solid for its words, dashed for a figure, numbered in the order they're read, each with its kind (click to switch) and a way to take it back. The bar takes the scan pill's place while boxing.",
    Demo: () => (
      <>
        <Shelf label="boxes">
          <div className="relative h-64 w-dialog rounded-sm border bg-card">
            <DrawnBox
              box={{ page: 1, x: 0.08, y: 0.2, w: 0.84, h: 0.25, kind: 'text' }}
              n={1}
            />
            <DrawnBox
              box={{
                page: 1,
                x: 0.25,
                y: 0.62,
                w: 0.5,
                h: 0.3,
                kind: 'figure',
              }}
              n={2}
            />
          </div>
        </Shelf>
        <Shelf label="narrow, right, top">
          <div className="relative h-64 w-dialog overflow-hidden rounded-sm border bg-card">
            <DrawnBox
              box={{ page: 1, x: 0.06, y: 0.45, w: 0.1, h: 0.3, kind: 'text' }}
              n={3}
            />
            <DrawnBox
              box={{
                page: 1,
                x: 0.82,
                y: 0.35,
                w: 0.12,
                h: 0.3,
                kind: 'figure',
              }}
              n={4}
            />
            <DrawnBox
              box={{ page: 1, x: 0.3, y: 0.01, w: 0.3, h: 0.2, kind: 'text' }}
              n={5}
            />
          </div>
        </Shelf>
        <Shelf label="bar">
          <div className="relative h-40 w-panel">
            <BoxingDemo />
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'adding-homework',
    title: 'Adding homework',
    group: 'Composed',
    note: "New homework and Add questions are one dialog with four ways in: Write (for a new set its title and due date, then the questions, a row each, each saying what it reads as), a file, a course web page, or pasted text. For a document, the review: a block a due date, ticked to become a set; its lines below, ticked to become questions, each saying what it reads as. Dates gone by or already added fold away behind one button; a line that isn't homework shows as one quiet line, unticked. A date matching a set made before is an update: what's new, whose instructions changed, what it no longer lists. In the list, a read waits: reading, ready to review, or failed with why.",
    Demo: () => (
      <>
        <Shelf label="source">
          <AssignmentSourceDemo />
        </Shelf>
        <Shelf label="adding to a set">
          <AssignmentSourceDemo toSet />
        </Shelf>
        <Shelf label="failed read">
          <AssignmentSourceDemo failed />
        </Shelf>
        <Shelf label="review">
          <AssignmentReviewDemo />
        </Shelf>
        <Shelf label="in the list">
          <div className="w-panel">
            <Box>
              {READS.map((r) => (
                <AssignmentReadRow
                  key={r.id}
                  r={r}
                  setTitle={r.setId ? 'Homework due Sep 11' : undefined}
                  onReview={() => {}}
                />
              ))}
            </Box>
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'memory',
    title: 'Memory',
    group: 'Composed',
    note: "The book's preferences, opened from Memory in the book's menu: add a sentence at the top, and below it every preference with who saved it (You, or Tutor for older ones) and when, and Delete. Deletes are immediate, so the one button is Done.",
    docs: ['memory-dialog'],
    Demo: () => (
      <>
        <Shelf label="empty">
          <MemoryDemo empty />
        </Shelf>
        <Shelf label="three preferences">
          <MemoryDemo />
        </Shelf>
      </>
    ),
  },
  {
    id: 'study-timer',
    title: 'Study timer',
    group: 'Composed',
    note: "In the workspace's top bar, after the book's menu: this sitting's time, counting toward the week. It pauses after 5 minutes without a click or a key, 20 with a homework question open, and a pause counts only up to a minute after the last input.",
    Demo: () => (
      <>
        <Shelf label="counting">
          <StudyTimer time={{ counting: true, seconds: 42 * 60 + 17 }} />
        </Shelf>
        <Shelf label="paused">
          <StudyTimer time={{ counting: false, seconds: 65 * 60 }} />
        </Shelf>
      </>
    ),
  },
];
