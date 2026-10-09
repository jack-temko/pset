import { useState, type ReactNode } from 'react';
import { Copy, X } from 'lucide-react';

import { Box, BoxBody, BoxRow } from '@/components/box';
import { Button, IconButton } from '@/components/button';
import { Dialog } from '@/components/dialog';
import { Flash } from '@/components/flash';
import { Field, Input } from '@/components/input';
import { Table, type TableColumn } from '@/components/table';

const WHAT = 'Couldn’t prepare Calculus.';
const WHY =
  'Your OpenRouter account is out of credit, so PSet can’t read the pages.';
const FIX = 'Add credit on OpenRouter, then try again.';
const IDS = ['import.failed', 'key.out_of_credit'];
const INCIDENT = 'E7K2QF';

/** The collapsed-by-default Details: ids, incident and a Copy button. */
function Details() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
        className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Details
      </button>
      {open && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
          <p className="min-w-0 flex-1 font-mono text-xs text-muted-foreground">
            {IDS.join(' > ')} · HTTP 402 · incident {INCIDENT}
          </p>
          <Button variant="outline" size="sm">
            <Copy />
            Copy
          </Button>
        </div>
      )}
    </div>
  );
}

/** A: the notice where the failure happened, in place of the book's row. */
export function Inline() {
  return (
    <div className="max-w-xl space-y-3">
      <Box>
        <BoxRow title="Linear algebra" description="38 pages · ready" />
        <BoxRow title="Statistics" description="212 pages · ready" />
      </Box>
      <Box tone="destructive">
        <BoxBody className="space-y-3">
          <p className="font-medium">{WHAT}</p>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{WHY}</p>
            <p>{FIX}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button>Try again</Button>
            <Details />
          </div>
        </BoxBody>
      </Box>
    </div>
  );
}

/** B: the flash banner at the top of the screen. */
export function Banner() {
  const [open, setOpen] = useState(true);
  return (
    <div className="overflow-hidden rounded-lg border">
      {open && (
        <Flash
          tone="warning"
          action={<Button size="sm">Try again</Button>}
          onDismiss={() => {
            setOpen(false);
          }}
        >
          {WHAT} {WHY} {FIX}
        </Flash>
      )}
      <div className="space-y-3 p-card">
        <p className="text-xs text-muted-foreground">
          Background rows say it in one line; the line opens the banner.
        </p>
        <Box className="max-w-xl">
          <BoxRow
            title="Calculus"
            description={WHAT}
            trailing={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(true);
                }}
              >
                Show
              </Button>
            }
          />
          <BoxRow title="Statistics" description="212 pages · ready" />
        </Box>
      </div>
    </div>
  );
}

/** C: a short toast, and More opens the rest in a dialog. */
export function ToastAndDialog() {
  const [dialog, setDialog] = useState(false);
  return (
    <div className="relative h-80 overflow-hidden rounded-lg border bg-background">
      <div className="p-card text-xs text-muted-foreground">
        The screen carries on; the toast sits at its bottom edge.
      </div>
      <div
        role="status"
        className="absolute right-4 bottom-4 flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm shadow-floating"
      >
        <span>{WHAT}</span>
        <Button size="sm">Try again</Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDialog(true);
          }}
        >
          More
        </Button>
        <IconButton variant="ghost" size="sm" aria-label="Dismiss">
          <X />
        </IconButton>
      </div>
      <Dialog
        open={dialog}
        onClose={() => {
          setDialog(false);
        }}
        title={WHAT}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDialog(false);
              }}
            >
              Cancel
            </Button>
            <Button>Try again</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{WHY}</p>
            <p>{FIX}</p>
          </div>
          <Details />
        </div>
      </Dialog>
    </div>
  );
}

/** The short form under a field: one line, no Details. */
export function FieldError() {
  return (
    <div className="max-w-sm">
      <Field label="Title" error="A book needs a title.">
        <Input defaultValue="" aria-invalid />
      </Field>
    </div>
  );
}

interface Past {
  at: string;
  what: string;
  id: string;
  incident: string;
  count: number;
}

const PAST: Past[] = [
  {
    at: 'Today 21:14',
    what: WHAT,
    id: 'key.out_of_credit',
    incident: INCIDENT,
    count: 1,
  },
  {
    at: 'Today 20:52',
    what: 'Couldn’t write the guide for 4.32.',
    id: 'model.timeout',
    incident: 'H3M9XD',
    count: 1,
  },
  {
    at: 'Today 20:40',
    what: 'Couldn’t write the guide for 4.25.',
    id: 'model.timeout',
    incident: 'B8TQ2A',
    count: 1,
  },
  {
    at: 'Yesterday 23:05',
    what: 'Couldn’t read page 41.',
    id: 'page.unreadable',
    incident: 'N4C7ZP',
    count: 1,
  },
];

const COLS: TableColumn<Past>[] = [
  { key: 'at', header: 'Time', cell: (r) => r.at, mono: true, width: '9rem' },
  { key: 'what', header: 'What', cell: (r) => r.what },
  { key: 'id', header: 'Id', cell: (r) => r.id, mono: true, width: '11rem' },
  {
    key: 'incident',
    header: 'Incident',
    cell: (r) => r.incident,
    mono: true,
    width: '6.5rem',
  },
  {
    key: 'count',
    header: 'Count',
    cell: (r) => r.count,
    numeric: true,
    width: '5rem',
  },
];

const GROUPED: Past[] = [
  { ...PAST[0], count: 1 },
  { ...PAST[1], at: 'Today 20:40', count: 2, incident: 'H3M9XD' },
  PAST[3],
];

export function Settings() {
  return (
    <div className="space-y-6">
      <Group title="Newest first" rows={PAST} />
      <Group title="Grouped by id" rows={GROUPED} />
    </div>
  );
}

function Group({ title, rows }: { title: string; rows: Past[] }): ReactNode {
  return (
    <section className="space-y-2">
      <div className="flex min-h-row items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <Button variant="outline" size="sm">
          Clear all
        </Button>
      </div>
      <Table
        columns={COLS}
        rows={rows}
        rowKey={(r) => r.at + r.incident}
        caption={`Past errors, ${title.toLowerCase()}`}
      />
    </section>
  );
}
