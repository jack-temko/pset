import { useRef, useState } from 'react';

import {
  useClearErrors,
  useErrors,
  type Group,
  type Incident,
} from '@/api/errors';
import { Box, BoxFooter, BoxRow } from '@/components/box';
import { Button } from '@/components/button';
import { ConfirmPopover } from '@/components/confirm';
import { Disclosure } from '@/components/disclosure';
import { Skeleton } from '@/components/skeleton';
import { Table, type TableColumn } from '@/components/table';
import { errorLine, incidentTime } from '@/lib/error-text';
import { errorView } from '@/api/client';
import { plural } from '@/lib/utils';

const columns: TableColumn<Incident>[] = [
  {
    key: 'at',
    header: 'Time',
    width: '9rem',
    mono: true,
    cell: (i) => incidentTime(i.at),
  },
  {
    key: 'what',
    header: 'What',
    wrapSecondary: true,
    cell: (i) => i.what,
    secondary: (i) => i.chain.join(' > '),
  },
  {
    key: 'incident',
    header: 'Incident',
    width: '6.5rem',
    mono: true,
    cell: (i) => i.incident,
  },
];

/**
 * Every error PSet showed, kept until cleared (Settings, Errors): grouped by
 * id, newest first, each opening onto its incidents so one can be quoted in
 * a bug report. One Clear all, asked first, as Reset everything is.
 */
export function Errors() {
  const { data } = useErrors();
  const clear = useClearErrors();
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  // One row tall while it loads and when it's empty, so the answer lands
  // without moving what is below.
  if (data === undefined)
    return (
      <Box>
        <BoxRow title={<Skeleton className="h-4 w-40" />} />
      </Box>
    );
  if (data.length === 0)
    return (
      <Box>
        <BoxRow title="No errors so far." />
      </Box>
    );

  const total = data.reduce((n, g) => n + g.count, 0);
  return (
    <Box>
      {data.map((g) => (
        <Disclosure
          key={g.id}
          title={g.what}
          meta={`${plural(g.count, 'time')} · ${incidentTime(g.last)}`}
          open={open === g.id}
          onOpenChange={(o) => {
            setOpen(o ? g.id : null);
          }}
        >
          <GroupBody group={g} />
        </Disclosure>
      ))}
      <BoxFooter>
        <span>
          {plural(total, 'error')} kept on this computer, none sent anywhere.
        </span>
        <Button
          ref={button}
          variant="outline"
          size="sm"
          onClick={() => {
            setAsking(true);
          }}
        >
          Clear all
        </Button>
        {asking && (
          <ConfirmPopover
            anchor={button}
            question="Clear every kept error?"
            detail="The list starts again from empty. Nothing else is touched."
            action="Clear all"
            error={
              clear.isError ? errorLine(errorView(clear.error)) : undefined
            }
            onCancel={() => {
              setAsking(false);
            }}
            onConfirm={() => {
              if (!clear.isPending)
                clear.mutate(undefined, {
                  onSuccess: () => {
                    setAsking(false);
                    setOpen(null);
                  },
                });
            }}
          />
        )}
      </BoxFooter>
    </Box>
  );
}

function GroupBody({ group }: { group: Group }) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-xs text-muted-foreground">{group.id}</p>
      <Table
        caption={`${group.what} incidents`}
        columns={columns}
        rows={group.incidents}
        rowKey={(i) => i.incident}
        dense
      />
    </div>
  );
}
