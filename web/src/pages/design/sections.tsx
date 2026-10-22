import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { Label } from '@/components/label';
import { Table, type TableColumn } from '@/components/table';
import type { Rule } from '@/design/rules';
import type { AnySpec } from '@/design/spec';
import { logUrl, specOf, unitPath } from './lookup';

export function Quiet({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

/** A section of the page. An empty one says so in one muted line. */
export function Sec({
  title,
  aside,
  empty,
  children,
}: {
  title: string;
  aside?: ReactNode;
  /** The line to show instead of the children, when there is nothing. */
  empty?: string;
  children?: ReactNode;
}) {
  return (
    <section className="mt-section">
      <div className="mb-card flex items-baseline justify-between gap-4">
        <h2 className="font-heading text-xl">{title}</h2>
        {aside}
      </div>
      {empty ? <Quiet>{empty}</Quiet> : children}
    </section>
  );
}

/** `fit` columns are mono, never wrap and are only as wide as their
 *  longest value; the others share what is left and wrap. */
type Col<T> = Omit<TableColumn<T>, 'className'> & {
  fit?: boolean;
  cls?: string;
};

export function Tbl<T>({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: Col<T>[];
  rows: readonly T[];
}) {
  return (
    <Table
      caption={caption}
      rows={[...rows]}
      rowKey={(r) => JSON.stringify(r)}
      columns={columns.map((c) => ({
        ...c,
        mono: c.mono ?? c.fit,
        className:
          c.cls ??
          (c.fit
            ? 'w-px align-top whitespace-nowrap'
            : 'align-top break-words whitespace-normal'),
      }))}
    />
  );
}

export function Actions({ spec }: { spec: AnySpec }) {
  return (
    <Sec
      title="Actions"
      empty={spec.actions.length ? undefined : 'No actions.'}
    >
      <Tbl
        caption="Actions"
        rows={spec.actions}
        columns={[
          { key: 'i', header: 'Id', fit: true, cell: (r) => r.id },
          { key: 'l', header: 'Label', cell: (r) => r.label },
          { key: 'd', header: 'The student', cell: (r) => r.does },
          {
            key: 't',
            header: 'Leads to',
            cell: (r) => {
              if (!r.target) return '';
              const name = specOf(r.target.unit)?.title ?? r.target.unit;
              return (
                <Link
                  to={unitPath(r.target.unit, r.target.state)}
                  className="text-primary hover:underline"
                >
                  {name}
                  {r.target.state ? `, ${r.target.state}` : ''}
                </Link>
              );
            },
          },
        ]}
      />
    </Sec>
  );
}

export function DataSection({ spec }: { spec: AnySpec }) {
  const data = spec.data ?? [];
  return (
    <Sec
      title="Data and loading"
      empty={data.length ? undefined : 'Nothing: it reads and loads nothing.'}
    >
      <Tbl
        caption="Data and loading"
        rows={data}
        columns={[
          { key: 'r', header: 'Reads', cell: (r) => r.reads },
          {
            key: 'c',
            header: 'Call',
            cell: (r) =>
              r.call === 'sample' ? 'Sample data, not wired' : r.call,
          },
        ]}
      />
    </Sec>
  );
}

/** What the unit keeps between visits; nothing is a section only when the
 *  spec says something. */
export function Remembers({ spec }: { spec: AnySpec }) {
  const kept = spec.remembers ?? [];
  if (kept.length === 0) return null;
  return (
    <Sec title="Remembers">
      <Tbl
        caption="Remembers"
        rows={kept}
        columns={[
          { key: 'w', header: 'What', cell: (r) => r.what },
          { key: 'p', header: 'Per', cell: (r) => r.per },
          { key: 'f', header: 'For', cell: (r) => r.for },
        ]}
      />
    </Sec>
  );
}

export function Inputs({ spec }: { spec: AnySpec }) {
  const title = spec.kind === 'component' ? 'Props' : 'Opened with';
  return (
    <Sec title={title} empty={spec.inputs.length ? undefined : 'No inputs.'}>
      <Tbl
        caption={title}
        rows={spec.inputs}
        columns={[
          { key: 'n', header: 'Name', fit: true, cell: (r) => r.name },
          {
            key: 'w',
            header: 'Does',
            cls: 'w-2/5 align-top break-words whitespace-normal',
            cell: (r) => r.does,
          },
        ]}
      />
    </Sec>
  );
}

export function PriorityAndSizes({ spec }: { spec: AnySpec }) {
  const main = spec.actions.find((a) => a.id === spec.priority.main);
  const rows: { k: string; v: string; list?: readonly string[] }[] = [
    { k: 'Seen first', v: spec.priority.first },
    { k: 'Main action', v: main ? `${main.label} (${main.id})` : 'None' },
    { k: 'Gives way first', v: '', list: spec.sizes.gives },
  ];
  return (
    <Sec title="Priority and sizes">
      <Tbl
        caption="Priority and sizes"
        rows={rows}
        columns={[
          {
            key: 'k',
            header: 'What',
            fit: true,
            mono: false,
            cell: (r) => r.k,
          },
          {
            key: 'v',
            header: 'Is',
            cell: (r) =>
              r.list ? (
                r.list.length ? (
                  <ol className="list-decimal pl-5">
                    {r.list.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ol>
                ) : (
                  'Nothing'
                )
              ) : (
                r.v
              ),
          },
        ]}
      />
    </Sec>
  );
}

export function RuleList({
  rules,
  localIds,
}: {
  rules: readonly Rule[];
  localIds?: readonly string[];
}) {
  return (
    <ul className="divide-y divide-border-muted rounded-lg border bg-card">
      {rules.map((r) => (
        <li
          key={r.id}
          className="flex items-baseline gap-4 px-card py-2 text-sm"
        >
          <span className="min-w-0 flex-1">{r.rule}</span>
          {localIds?.includes(r.id) && <Label>local</Label>}
          <Link
            to={`/design/rules/${r.id}`}
            className="shrink-0 font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            {r.id}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RulesSection({
  spec,
  rulebook,
}: {
  spec: AnySpec;
  rulebook: readonly Rule[];
}) {
  const local = spec.rules.local ?? [];
  const cited = spec.rules.cite.flatMap((id) =>
    rulebook.filter((r) => r.id === id),
  );
  const all = [...cited, ...local];
  return (
    <Sec title="Rules" empty={all.length ? undefined : 'No rules cited.'}>
      <RuleList rules={all} localIds={local.map((r) => r.id)} />
    </Sec>
  );
}

type DecisionRow = AnySpec['decisions'][number];

function DecisionTable({
  caption,
  rows,
}: {
  caption: string;
  rows: readonly DecisionRow[];
}) {
  return (
    <Tbl
      caption={caption}
      rows={rows}
      columns={[
        {
          key: 'w',
          header: 'What',
          cell: (r) => (
            <>
              <span
                className={
                  r.supersededBy
                    ? 'text-muted-foreground line-through'
                    : undefined
                }
              >
                {r.decision}
              </span>
              {r.supersededBy && (
                <span className="block text-xs text-muted-foreground">
                  Replaced by {r.supersededBy}
                </span>
              )}
            </>
          ),
        },
        { key: 'y', header: 'Why', cell: (r) => r.why },
        { key: 'b', header: 'Beat', cell: (r) => r.beat },
        {
          key: 'i',
          header: 'Id',
          cls: 'w-px align-top whitespace-nowrap',
          cell: (r) => (
            <>
              <span className="font-mono text-xs text-muted-foreground">
                {r.id}
              </span>
              <span className="block text-xs text-muted-foreground">
                {r.date}
              </span>
            </>
          ),
        },
      ]}
    />
  );
}

/** The decisions in force first; the replaced ones stay, folded behind a
 *  disclosure with their full history. */
export function Decisions({ spec }: { spec: AnySpec }) {
  const inForce = spec.decisions.filter((d) => !d.supersededBy);
  const replaced = spec.decisions.filter((d) => d.supersededBy);
  return (
    <Sec
      title="Decisions"
      empty={spec.decisions.length ? undefined : 'No decisions recorded.'}
      aside={
        spec.log && (
          <a
            href={logUrl(spec.log)}
            className="text-sm text-primary hover:underline"
          >
            Full log
          </a>
        )
      }
    >
      <DecisionTable caption="Decisions in force" rows={inForce} />
      {replaced.length > 0 && (
        <details className="mt-card">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            {replaced.length} replaced
          </summary>
          <div className="mt-card">
            <DecisionTable caption="Replaced decisions" rows={replaced} />
          </div>
        </details>
      )}
    </Sec>
  );
}
