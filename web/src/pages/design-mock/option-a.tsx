import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import { Box } from '@/components/box';
import { Button } from '@/components/button';
import { Label } from '@/components/label';
import { ResizeHandle } from '@/components/resize-handle';
import { SegmentedControl } from '@/components/segmented-control';
import { Table, type TableColumn } from '@/components/table';
import { cn } from '@/lib/utils';
import { Both, Example } from './example';
import {
  OTHER_ACTIONS,
  UNIT_INFO,
  type Ref,
  type Rule,
  type Sample,
} from './sample';
import { useExample, type Ex } from './use-example';

// Option A: the example on top, in one stage under one toolbar, then the
// spec as full-width sections one under another.

const STRESS_NARROW = 160;

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex h-control items-center gap-2">{children}</div>
    </div>
  );
}

function Toolbar({ ex }: { ex: Ex }) {
  const { s } = ex;
  const width = ex.full ? 'full' : 'default';
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-4">
      <Group label="State">
        <select
          aria-label="State"
          value={ex.state}
          onChange={(e) => {
            ex.setState(e.target.value);
          }}
          style={{ width: 144 }}
          className="h-control rounded-md border border-input bg-card px-3 text-sm text-foreground"
        >
          {s.states.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </select>
      </Group>
      <Group label="Load">
        <SegmentedControl
          label="Load"
          value={ex.mode}
          options={[
            { value: 'loaded', label: 'Loaded' },
            { value: 'loading', label: 'Loading' },
            { value: 'both', label: 'Both' },
          ]}
          onChange={ex.setMode}
        />
      </Group>
      <Group label="Theme">
        <SegmentedControl
          label="Theme"
          value={ex.night ? 'night' : 'paper'}
          options={[
            { value: 'paper', label: 'Paper' },
            { value: 'night', label: 'Night' },
          ]}
          onChange={(v) => {
            ex.setNight(v === 'night');
          }}
        />
      </Group>
      <Group label="Content">
        <SegmentedControl
          label="Content"
          value={ex.stress ? 'stress' : 'normal'}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'stress', label: 'Stress' },
          ]}
          onChange={(v) => {
            ex.setStress(v === 'stress');
            if (s.kind === 'component' && v === 'stress') {
              ex.setFull(false);
              ex.setWidth(STRESS_NARROW);
            }
          }}
        />
      </Group>
      <Group label="Width">
        <SegmentedControl
          label="Width"
          value={width}
          options={[
            { value: 'default', label: s.kind === 'pane' ? 'Pane' : 'Default' },
            { value: 'full', label: 'Full' },
          ]}
          onChange={(v) => {
            ex.setFull(v === 'full');
            if (v === 'default') ex.setWidth(s.kind === 'pane' ? 440 : 480);
          }}
        />
        <span className="font-mono text-xs text-muted-foreground">
          {ex.full ? 'full' : `${ex.width}px`}
        </span>
      </Group>
    </div>
  );
}

/** The inner width of an element, kept current. */
function useInnerWidth(ref: RefObject<HTMLElement | null>) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      setW(
        Math.floor(
          el.clientWidth -
            parseFloat(cs.paddingLeft) -
            parseFloat(cs.paddingRight),
        ),
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [ref]);
  return w;
}

/** One stage, on the muted ground: the unit at its chosen width, left
 *  aligned, with the resize handle on its right edge. Night scopes the
 *  theme tokens to the stage with the `dark` class. */
function Stage({ ex }: { ex: Ex }) {
  const { s } = ex;
  const ref = useRef<HTMLDivElement>(null);
  const inner = useInnerWidth(ref);
  const cur = s.states.find((x) => x.id === ex.state) ?? s.states[0];
  const width = ex.full ? inner : Math.min(ex.width, inner || ex.width);
  const pane = s.kind === 'pane';
  return (
    <div
      ref={ref}
      className={cn(
        'overflow-hidden rounded-md border bg-muted p-card text-foreground',
        ex.night && 'dark',
      )}
    >
      <div className="flex items-stretch">
        <div
          className={cn(
            'shrink-0',
            pane
              ? '[&_aside]:h-[640px]!'
              : 'rounded-md border bg-background p-card',
          )}
          style={{ width }}
        >
          {ex.mode === 'both' ? (
            <Both
              kind={s.kind}
              state={cur.id}
              stress={ex.stress}
              night={ex.night}
              width={width}
              height={640}
            />
          ) : (
            <Example
              kind={s.kind}
              state={cur.id}
              stress={ex.stress}
              loading={ex.mode === 'loading'}
            />
          )}
        </div>
        <ResizeHandle
          label="Resize the example"
          pane="before"
          value={width}
          min={120}
          max={Math.max(inner, 120)}
          onChange={(px) => {
            ex.setFull(false);
            ex.setWidth(px);
          }}
          onCommit={() => {}}
          onReset={() => {
            ex.setFull(false);
            ex.setWidth(pane ? 440 : 480);
          }}
        />
      </div>
    </div>
  );
}

function Flow({ ex }: { ex: Ex }) {
  const ids = ex.s.flow;
  if (!ids) return null;
  const flow = ids.flatMap((id) => ex.s.actions.filter((a) => a.id === id));
  const at = flow.findIndex((f) => f.state === ex.state);
  const go = (i: number) => {
    ex.setState(flow[i].state ?? ex.state);
  };
  return (
    <div className="mt-card space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <SegmentedControl
          label="Flow"
          value={at >= 0 ? flow[at].id : ''}
          options={flow.map((f, i) => ({
            value: f.id,
            label: `${String(i + 1)} ${f.does}`,
          }))}
          onChange={(id) => {
            go(flow.findIndex((f) => f.id === id));
          }}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={at <= 0}
            onClick={() => {
              go(at - 1);
            }}
          >
            Previous
          </Button>
          <Button
            disabled={at === flow.length - 1}
            onClick={() => {
              go(at + 1);
            }}
          >
            Next
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {at >= 0
          ? `Step ${String(at + 1)}: ${flow[at].leads}.`
          : 'This state is not a step of the flow.'}
      </p>
    </div>
  );
}

function Sec({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-section">
      <div className="mb-card flex items-baseline justify-between gap-4">
        <h2 className="font-heading text-xl">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

// ---- the map

function UnitBox({
  r,
  label,
  center,
  small,
}: {
  r: Ref;
  label?: string;
  center?: boolean;
  small?: boolean;
}) {
  return (
    <a href="#" className="block min-w-0">
      <Box
        className={cn(
          small ? 'px-2 py-1' : 'px-card py-2',
          'hover:bg-muted/50',
          center && 'border-primary bg-primary-soft hover:bg-primary-soft',
        )}
      >
        {label && (
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        )}
        <p className="flex items-center justify-between gap-2 text-sm font-medium">
          <span className="min-w-0">{r.name}</span>
          <Label tone={center ? 'primary' : 'default'}>{r.kind}</Label>
        </p>
      </Box>
    </a>
  );
}

function Down() {
  return (
    <p aria-hidden className="py-2 text-center text-muted-foreground">
      ↓
    </p>
  );
}

function Row({ label, refs }: { label: string; refs: Ref[] }) {
  return (
    <div className="space-y-2">
      <Quiet>{label}</Quiet>
      <div className="flex flex-wrap gap-2">
        {refs.map((r) => (
          <UnitBox key={r.name} r={r} small />
        ))}
      </div>
    </div>
  );
}

function Side({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; r: Ref; label: string }[];
}) {
  if (rows.length === 0) return <div />;
  return (
    <div className="space-y-2">
      <Quiet>{title}</Quiet>
      {rows.map((x) => (
        <UnitBox key={x.id} r={x.r} label={x.label} />
      ))}
    </div>
  );
}

const GUTTER =
  'absolute inset-y-0 flex w-10 items-center justify-center text-muted-foreground';

/** Three rows: Inside, then the band (Leads here, the unit alone, Leads
 *  to, one arrow per gutter at the unit's centre), then Made of. A unit
 *  with no sides is just what holds it and what it holds. */
function NeighbourMap({ s }: { s: Sample }) {
  const here = UNIT_INFO[s.unit];
  const from = OTHER_ACTIONS.filter(
    (o) => o.action.target?.unit === s.unit,
  ).map((o) => ({
    id: o.action.id,
    r: UNIT_INFO[o.unit],
    label: o.action.does,
  }));
  const to = s.actions.flatMap((a) =>
    a.target && a.target.unit !== s.unit
      ? [{ id: a.id, r: UNIT_INFO[a.target.unit], label: a.does }]
      : [],
  );
  const made = s.madeOf.map((m) => ({
    name: m.name,
    kind: 'component' as const,
  }));
  if (from.length === 0 && to.length === 0)
    return (
      <div className="space-y-4">
        {s.inside.length > 0 && <Row label="Used in" refs={s.inside} />}
        {made.length > 0 && <Row label="Made of" refs={made} />}
      </div>
    );
  return (
    <div>
      {s.inside.length > 0 && (
        <div className="space-y-2">
          <div className="text-center">
            <Quiet>Inside</Quiet>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {s.inside.map((r) => (
              <UnitBox key={r.name} r={r} small />
            ))}
          </div>
          <Down />
        </div>
      )}
      <div className="grid grid-cols-3 items-center gap-x-10">
        <Side title="Leads here" rows={from} />
        <div className="relative">
          <UnitBox r={here} center />
          {from.length > 0 && (
            <span aria-hidden className={cn(GUTTER, '-left-10')}>
              →
            </span>
          )}
          {to.length > 0 && (
            <span aria-hidden className={cn(GUTTER, '-right-10')}>
              →
            </span>
          )}
        </div>
        <Side title="Leads to" rows={to} />
      </div>
      {made.length > 0 && (
        <div>
          <Down />
          <Row label="Made of" refs={made} />
        </div>
      )}
    </div>
  );
}

// ---- tables

/** `fit` columns are mono, never wrap and are only as wide as their
 *  longest value; the others share what is left and wrap. */
type Col<T> = Omit<TableColumn<T>, 'className'> & {
  fit?: boolean;
  cls?: string;
};

function Tbl<T>({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: Col<T>[];
  rows: T[];
}) {
  return (
    <Table
      caption={caption}
      rows={rows}
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

const RULE_GROUPS: { kind: Rule['kind']; title: string }[] = [
  { kind: 'always', title: 'Always' },
  { kind: 'never', title: 'Never' },
  { kind: 'limits', title: 'Limits' },
];

function Rules({ rules }: { rules: Rule[] }) {
  return (
    <div className="space-y-4">
      {RULE_GROUPS.map((g) => {
        const rows = rules.filter((r) => r.kind === g.kind);
        if (rows.length === 0) return null;
        return (
          <div key={g.kind} className="space-y-2">
            <Quiet>{g.title}</Quiet>
            <ul className="divide-y divide-border-muted rounded-lg border bg-card">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-baseline gap-4 px-card py-2 text-sm"
                >
                  <span className="min-w-0 flex-1">{r.text}</span>
                  {r.local && <Label>local</Label>}
                  <a
                    href="#"
                    className="shrink-0 font-mono text-xs text-muted-foreground hover:text-foreground"
                  >
                    {r.id}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function OptionA({ s }: { s: Sample }) {
  const ex = useExample(s);
  const cur = s.states.find((x) => x.id === ex.state) ?? s.states[0];
  return (
    <div>
      <header className="space-y-1">
        <p className="text-xs tracking-wide text-primary uppercase">{s.kind}</p>
        <h1 className="font-heading text-xl">{s.title}</h1>
        <p className="text-sm text-muted-foreground">{s.purpose}</p>
      </header>
      <div className="mt-section">
        <Toolbar ex={ex} />
        <p className="mt-card text-xs text-muted-foreground">
          {cur.when}
          {ex.mode !== 'loaded' && !s.skeleton && ' It has no skeleton.'}
        </p>
        <div className="mt-card">
          <Stage ex={ex} />
        </div>
        <Flow ex={ex} />
      </div>
      <Sec title="Neighbourhood">
        <NeighbourMap s={s} />
      </Sec>
      <Sec title="Actions">
        <Tbl
          caption="Actions"
          rows={s.actions}
          columns={[
            { key: 'i', header: 'Id', fit: true, cell: (r) => r.id },
            { key: 'd', header: 'The student', cell: (r) => r.does },
            { key: 'l', header: 'Leads to', cell: (r) => r.leads },
          ]}
        />
      </Sec>
      <Sec title="Data and loading">
        {s.data.length === 0 ? (
          <Quiet>Nothing: it reads and loads nothing.</Quiet>
        ) : (
          <Tbl
            caption="Data and loading"
            rows={s.data}
            columns={[
              { key: 'r', header: 'Reads', cell: (r) => r.reads },
              { key: 'c', header: 'Call', cell: (r) => r.call },
              { key: 'w', header: 'Waiting', cell: (r) => r.waiting },
              { key: 'f', header: 'Fails', cell: (r) => r.failed },
            ]}
          />
        )}
      </Sec>
      <Sec title={s.inputsTitle}>
        <Tbl
          caption={s.inputsTitle}
          rows={s.inputs}
          columns={[
            { key: 'n', header: 'Name', fit: true, cell: (r) => r.name },
            {
              key: 't',
              header: 'Type',
              mono: true,
              cls: 'w-1/3 align-top break-words whitespace-normal',
              cell: (r) =>
                r.type.split(' | ').map((p, i) => (
                  <span key={p}>
                    {i > 0 && ' | '}
                    <wbr />
                    {p}
                  </span>
                )),
            },
            { key: 'd', header: 'Default', fit: true, cell: (r) => r.default },
            {
              key: 'w',
              header: 'Does',
              cls: 'w-2/5 align-top break-words whitespace-normal',
              cell: (r) => r.does,
            },
          ]}
        />
      </Sec>
      <Sec title="Rules">
        <Rules rules={s.rules} />
      </Sec>
      <Sec
        title="Decisions"
        aside={
          <a href="#" className="text-sm text-primary hover:underline">
            Full log
          </a>
        }
      >
        <Tbl
          caption="Decisions"
          rows={s.decisions}
          columns={[
            { key: 'w', header: 'What', cell: (r) => r.what },
            { key: 'y', header: 'Why', cell: (r) => r.why },
            { key: 'b', header: 'Beat', cell: (r) => r.beat },
          ]}
        />
      </Sec>
    </div>
  );
}
