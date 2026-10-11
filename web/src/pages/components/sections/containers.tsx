import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { BookCover, CoverPicker } from '@/components/book-cover';
import {
  Box,
  BoxBody,
  BoxFooter,
  BoxHeader,
  BoxRow,
  Counter,
  RowValue,
} from '@/components/box';
import { Button } from '@/components/button';
import { Disclosure } from '@/components/disclosure';
import { ImportRow } from '@/components/import-row';
import { Door } from '@/components/door';
import { HomeworkStatusLabel } from '@/components/homework-status';
import { DurationValue, StatTile } from '@/components/stat-tile';
import { observe } from '@/lib/eta';
import type { CoverHue } from '@/lib/covers';
import { BOOKS, DUE, sampleBook } from '@/components/fixtures';
import { BookTile } from '@/components/book-tile';
import type { ComponentEntry } from './types';
import { Shelf } from './shared';

/** The Door needs state to be worth looking at, so it gets a live demo. */
function DoorDemo() {
  const [open, setOpen] = useState(false);
  const rows = open ? DUE : DUE.slice(0, 2);
  return (
    <Box>
      {rows.map((d) => (
        <BoxRow key={d.id} href="#" title={d.title} description={d.book} />
      ))}
      <Door
        className="border-t border-border-muted"
        open={open}
        total={DUE.length}
        onToggle={() => {
          setOpen((o) => !o);
        }}
      />
    </Box>
  );
}

/** The Book dialog's colour picker, live. */
function CoverPickerDemo() {
  const [hue, setHue] = useState<CoverHue>('rose');
  return <CoverPicker value={hue} onChange={setHue} />;
}

// The reading row has a minute of pace behind it, so it shows its time
// left as a real import would (40 pages a minute, 172 to go).
observe(
  'book:b89d3b72',
  'import:read',
  { done: 100, total: 312 },
  Date.now() - 60_000,
);

observe('book:b89d3b72', 'import:read', { done: 140, total: 312 }, Date.now());

/** Rows that open in place, as a question's help does. */
function DisclosureDemo() {
  const [open, setOpen] = useState<string | null>('Hint');
  const rows = [
    [
      'Hint',
      '2 lines',
      'Go around the loop once and write that the voltage rises equal the drops.',
    ],
    [
      'Walkthrough',
      '5 steps',
      'Going clockwise, the source gives a rise of 10 V and the two resistors are drops.',
    ],
    ['Answers', '2 answers', 'i = 0.83 A clockwise; P = 5.6 W.'],
  ];
  return (
    <Box className="w-panel">
      {rows.map(([title, meta, body]) => (
        <Disclosure
          key={title}
          title={title}
          meta={meta}
          open={open === title}
          onOpenChange={(o) => {
            setOpen(o ? title : null);
          }}
        >
          <p>{body}</p>
        </Disclosure>
      ))}
    </Box>
  );
}

export const containersSections: ComponentEntry[] = [
  {
    id: 'box',
    title: 'Box',
    group: 'Containers',
    note: 'The one container: header band, rows, body, footer. Hairline border, no shadow, never nested.',
    docs: ['box'],
    Demo: () => (
      <>
        <Shelf label="header + rows">
          <div className="w-full max-w-xl">
            <Box>
              <BoxHeader>
                <span>
                  Due
                  <Counter>9</Counter>
                </span>
                <Button variant="outline" size="sm">
                  New homework
                </Button>
              </BoxHeader>
              <BoxRow
                leading={<BookOpen />}
                title="Problem set 4"
                description="Linear Algebra Done Right · 8 questions · due today"
                trailing={<HomeworkStatusLabel status="soon" />}
              />
              <BoxRow
                leading={<BookOpen />}
                title="Chapter 3 exercises"
                description="Nonlinear Dynamics and Chaos · 5 questions · due tomorrow"
                trailing={<HomeworkStatusLabel />}
              />
              <BoxFooter>
                <span>Showing 2 of 9</span>
              </BoxFooter>
            </Box>
          </div>
        </Shelf>
        <Shelf label="rows, no description">
          <div className="w-full max-w-xl">
            <Box>
              <BoxRow
                title="1 · Vector Spaces"
                trailing={<RowValue>1</RowValue>}
              />
              <BoxRow
                title="2 · Finite-Dimensional Spaces"
                trailing={<RowValue>27</RowValue>}
              />
              <BoxRow
                title="3 · Linear Maps"
                trailing={<RowValue>51</RowValue>}
                selected
              />
            </Box>
          </div>
        </Shelf>
        <Shelf label="body">
          <div className="w-full max-w-xl">
            <Box>
              <BoxHeader>About this book</BoxHeader>
              <BoxBody>
                Prepared yesterday from a 312-page digital PDF. Sections came
                from the PDF&apos;s own outline.
              </BoxBody>
              <BoxFooter>
                <RowValue>sha256:4f1a9c2e</RowValue>
                <RowValue>18.4 MB</RowValue>
              </BoxFooter>
            </Box>
          </div>
        </Shelf>
        <Shelf label="tone">
          <div className="flex w-full max-w-xl flex-col gap-4">
            <Box tone="warning">
              <BoxBody>Not ready · reading the pages, 62%.</BoxBody>
            </Box>
            <Box tone="destructive">
              <BoxBody>
                Couldn&apos;t prepare this book. The PDF has no extractable
                text.
              </BoxBody>
            </Box>
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'door',
    title: 'Door',
    group: 'Containers',
    note: 'The way through truncated content. It opens in place, the same everywhere. Nothing scrolls by itself.',
    docs: ['door'],
    Demo: () => (
      <>
        <Shelf label="in a Box">
          <div className="w-full max-w-xl">
            <DoorDemo />
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'book-cover',
    title: 'BookCover',
    group: 'Containers',
    note: "Six hues. A book's is picked when it's added (the one fewest books wear, seeded by its hash) and kept; the Book dialog changes it with the picker. Sized by its container at a 3:4 ratio.",
    docs: ['book-cover'],
    Demo: () => (
      <>
        <Shelf label="hues">
          <div className="grid w-full grid-cols-6 gap-4">
            {BOOKS.slice(0, 6).map((b) => (
              <div key={b.sha256} className="space-y-2">
                <BookCover title={b.title} author={b.author} hue={b.cover} />
                <p className="font-mono text-xs text-muted-foreground">
                  {b.cover}
                </p>
              </div>
            ))}
          </div>
        </Shelf>
        <Shelf label="picker">
          <CoverPickerDemo />
        </Shelf>
        <Shelf label="book tile">
          <div className="grid w-full grid-cols-6 gap-4">
            {BOOKS.filter((b) => b.state.kind === 'ready')
              .slice(0, 3)
              .map((b) => (
                <BookTile key={b.sha256} book={b} />
              ))}
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'import-row',
    title: 'ImportRow',
    group: 'Containers',
    note: "A book on its way to the shelf. The engine's own phase names; a phase that can count fills a bar, one that can't spins. Once there's an honest estimate, the time left follows in rounded words (lib/eta): from the pace of a counted phase, from past imports for one that can't count. The row owns the controls for exactly its state.",
    docs: ['import-row'],
    Demo: () => (
      <>
        <Shelf label="rows">
          <Box className="w-full">
            <ImportRow
              book={sampleBook({
                sha256: 'b89d3b72',
                title: 'Introduction to the Theory of Computation',
                author: '',
                state: {
                  kind: 'preparing',
                  phase: 'read',
                  done: 140,
                  total: 312,
                },
              })}
            />
            <ImportRow
              book={sampleBook({
                sha256: 'a41c09e2',
                title: 'Calculus',
                author: '',
                state: { kind: 'preparing', phase: 'contents' },
              })}
            />
            <ImportRow
              book={sampleBook({
                sha256: '7ce04a15',
                title: 'Griffiths Introduction To Electrodynamics',
                author: '',
                state: { kind: 'queued' },
              })}
            />
            <ImportRow
              book={sampleBook({
                sha256: '5e2b7f90',
                title: 'Foundations of Brontolithics',
                author: '',
                kind: 'scanned',
                state: { kind: 'queued', phase: 'read', done: 140, total: 312 },
              })}
            />
            <ImportRow
              book={sampleBook({
                sha256: '3a80b5d4',
                title: 'Organic Chemistry',
                author: '',
                state: {
                  kind: 'failed',
                  reason: "This PDF can't be read. PSet couldn't open it.",
                },
              })}
            />
          </Box>
        </Shelf>
      </>
    ),
  },
  {
    id: 'stat-tile',
    title: 'StatTile',
    group: 'Containers',
    note: 'A label, a big mono value, one quiet line of context. Reports, never nags.',
    docs: ['stat-tile'],
    Demo: () => (
      <>
        <Shelf label="time">
          <div className="grid w-full max-w-2xl grid-cols-3 gap-4">
            <StatTile
              label="Homework"
              chart={1}
              value={<DurationValue minutes={263} />}
              context="so far this week"
            />
            <StatTile
              label="Reading"
              chart={2}
              value={<DurationValue minutes={70} />}
              context="so far this week"
            />
            <StatTile
              label="Asking"
              chart={3}
              value={<DurationValue minutes={40} />}
              context="so far this week"
            />
          </div>
        </Shelf>
        <Shelf label="count">
          <div className="grid w-full max-w-2xl grid-cols-3 gap-4">
            <StatTile
              label="Questions worked"
              value={14}
              context="across 3 problem sets"
            />
          </div>
        </Shelf>
        <Shelf label="empty week">
          <div className="grid w-full max-w-2xl grid-cols-3 gap-4">
            <StatTile
              label="Homework"
              chart={1}
              value="0"
              context="nothing yet this week"
            />
          </div>
        </Shelf>
      </>
    ),
  },
  {
    id: 'disclosure',
    title: 'Disclosure',
    group: 'Containers',
    note: 'A row that opens its content in place and says how long it is. It stays open; a tap closes it.',
    docs: ['disclosure'],
    Demo: () => (
      <>
        <Shelf label="rows in a Box">
          <DisclosureDemo />
        </Shelf>
        <Shelf label="still being written">
          <Box className="w-panel">
            <Disclosure
              title="Walkthrough"
              busy="Writing"
              open={false}
              onOpenChange={() => {}}
            >
              <p />
            </Disclosure>
          </Box>
        </Shelf>
      </>
    ),
  },
];
