import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface TableColumn<T> {
  key: string;
  header: string;
  /** Numbers right-align and set in tabular figures, header included. */
  numeric?: boolean;
  /** The cell's main content. */
  cell: (row: T) => ReactNode;
  /** A muted second line under the main content. */
  secondary?: (row: T) => ReactNode;
  /** Set the cell in mono, for what is copyable or data (a model id, a time).
   *  Numeric columns are mono by default; `mono: false` opts one out. */
  mono?: boolean;
  /** Draw the cell in `destructive` ink on an error row. */
  errorInk?: boolean;
  /** A CSS width ("6rem"). Give some and the table lays out fixed, so
   *  tables with the same columns line up one under another; a column with
   *  none takes what is left. */
  width?: string;
  /** Let the secondary line wrap, at its spaces: for text of any length (an
   *  error). Without, it stays on one line, so a model name never breaks. */
  wrapSecondary?: boolean;
  className?: string;
}

/**
 * A quiet data table for rows you read across: a `card-header` header row
 * in `text-xs` muted ink, body rows about 37px tall (`spacing-2` above and below, 16px beside each cell) divided by
 * `border-muted`, `text-sm` cells. Numeric columns align right in tabular
 * figures so digits line up, in mono (a column's `mono` sets it for any
 * other data or copyable text; the headers and labels stay Inter). A cell may carry a muted second line. A row
 * in `error` takes a light `destructive-soft` tint; only its secondary
 * line, and cells marked `errorInk`, read in `destructive`.
 *
 * `dense` tightens the cells' sides to `spacing-3`, for a table inside a
 * dialog. Wide tables scroll sideways inside their own frame; the page
 * never does.
 */
export function Table<T>({
  columns,
  rows,
  rowKey,
  error,
  caption,
  dense,
  className,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Marks a row as failed. */
  error?: (row: T) => boolean;
  /** The table's accessible name. */
  caption: string;
  /** Cells 12px beside, not 16px. */
  dense?: boolean;
  className?: string;
}) {
  const fixed = columns.some((c) => c.width);
  return (
    <div className={cn('overflow-x-auto rounded-lg border bg-card', className)}>
      <table
        className={cn('w-full border-collapse text-sm', fixed && 'table-fixed')}
        style={fixed ? { minWidth: minWidth(columns) } : undefined}
      >
        <caption className="sr-only">{caption}</caption>
        {fixed && (
          <colgroup>
            {columns.map((c) => (
              <col
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
              />
            ))}
          </colgroup>
        )}
        <thead className="bg-card-header">
          <tr className="border-b">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  dense ? 'px-3' : 'px-4',
                  'py-2 text-xs font-medium whitespace-nowrap text-muted-foreground',
                  c.numeric ? 'text-right tabular-nums' : 'text-left',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const bad = error?.(row);
            return (
              <tr
                key={rowKey(row)}
                className={cn(
                  'border-b border-border-muted last:border-b-0',
                  bad && 'bg-destructive-soft/40',
                )}
              >
                {columns.map((c) => {
                  const second = c.secondary?.(row);
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        dense ? 'px-3' : 'px-4',
                        'py-2 align-baseline whitespace-nowrap',
                        c.numeric && 'text-right',
                        c.numeric &&
                          (c.mono === false ? 'tabular-nums' : 'figure'),
                        !c.numeric && c.mono && 'font-mono tabular-nums',
                        bad && c.errorInk && 'text-destructive',
                        c.className,
                      )}
                    >
                      {c.cell(row)}
                      {second != null && (
                        <div
                          className={cn(
                            'text-xs',
                            'min-w-0 max-w-full',
                            c.wrapSecondary
                              ? cn('whitespace-normal', !fixed && 'min-w-40')
                              : 'whitespace-nowrap',
                            bad ? 'text-destructive' : 'text-muted-foreground',
                          )}
                        >
                          {second}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The narrowest a fixed table may be: its set widths plus a floor for each
 *  column that has none. Narrower than that its cells would overlap, so the
 *  frame scrolls instead. */
const FREE_COLUMN = '10rem';
function minWidth<T>(columns: TableColumn<T>[]): string {
  const set = columns.filter((c) => c.width).map((c) => c.width);
  const free = columns.length - set.length;
  return `calc(${[...set, ...Array(free).fill(FREE_COLUMN)].join(' + ')})`;
}
