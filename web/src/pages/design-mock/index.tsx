import { useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { Table, type TableColumn } from '@/components/table';
import { Input } from '@/components/input';
import { SegmentedControl } from '@/components/segmented-control';
import { UnderlineNav, UnderlineTab } from '@/components/underline-nav';
import { Mark } from '@/components/brand';
import { cn } from '@/lib/utils';
import { ResizeHandle } from '@/components/resize-handle';
import { Button } from '@/components/button';
import { Both, Example, type Mode } from './example';
import { Box } from '@/components/box';
import { Label } from '@/components/label';
import {
  OTHER_ACTIONS,
  SAMPLES,
  TABS,
  UNIT_INFO,
  UNITS,
  type Ref,
  type Sample,
} from './sample';

const OPTIONS = [
  { value: 'a', label: 'A: example on top' },
  { value: 'b', label: 'B: side by side' },
  { value: 'c', label: 'C: contact sheet' },
] as const;
type Option = (typeof OPTIONS)[number]['value'];

const KINDS = [
  { value: 'component', label: 'Component' },
  { value: 'pane', label: 'Pane' },
] as const;

function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="min-w-0 space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Empty() {
  return (
    <p className="text-xs text-muted-foreground">
      Nothing: it reads and loads nothing.
    </p>
  );
}

function RuleChip({ id, local }: { id: string; local?: boolean }) {
  return (
    <span
      className={cn(
        'inline-block rounded-sm border px-1.5 font-mono text-xs',
        local ? 'border-primary bg-primary-soft text-primary' : 'bg-muted',
      )}
    >
      {id}
    </span>
  );
}

function Tbl<T>({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: TableColumn<T>[];
  rows: T[];
}) {
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <Table
        dense
        caption={caption}
        columns={columns}
        rows={rows}
        rowKey={(r) => JSON.stringify(r)}
      />
    </div>
  );
}

function UnitBox({
  r,
  label,
  center,
}: {
  r: Ref;
  label?: string;
  center?: boolean;
}) {
  return (
    <a href="#" className="block">
      <Box
        className={cn(
          'space-y-1 p-2 hover:bg-muted/50',
          center && 'border-primary bg-primary-soft',
        )}
      >
        {label && <p className="text-xs text-muted-foreground">{label}</p>}
        <p className="flex items-center justify-between gap-2 text-sm font-medium">
          {r.name}
          <Label tone={center ? 'primary' : 'default'}>{r.kind}</Label>
        </p>
      </Box>
    </a>
  );
}

function Side({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

const ARROW = (
  <span aria-hidden className="text-muted-foreground">
    ↓
  </span>
);

/** The unit in the middle: who leads here on the left (derived from the
 *  other units' actions), where it leads on the right, what contains it
 *  above and what it is made of below. Empty sides collapse. */
function NeighbourMap({ s }: { s: Sample }) {
  const here = UNIT_INFO[s.unit];
  const hereFrom = OTHER_ACTIONS.filter(
    (o) => o.action.target?.unit === s.unit,
  );
  const leadsTo = s.actions.filter((a) => a.target && a.target.unit !== s.unit);
  const side = (leftOrRight: boolean) =>
    leftOrRight ? hereFrom.length > 0 : leadsTo.length > 0;
  const cols = [side(true), true, side(false)];
  return (
    <div
      className="grid items-center gap-x-3 gap-y-2"
      style={{
        gridTemplateColumns: cols
          .map((on, i) =>
            i === 1 ? 'minmax(0,1fr)' : on ? 'minmax(0,1fr)' : '0',
          )
          .join(' '),
      }}
    >
      {s.inside.length > 0 && (
        <div className="col-start-2 space-y-1">
          <p className="text-xs text-muted-foreground">Inside</p>
          <div className="flex flex-wrap gap-2">
            {s.inside.map((r) => (
              <UnitBox key={r.name} r={r} />
            ))}
          </div>
          <p className="text-center">{ARROW}</p>
        </div>
      )}
      {side(true) && (
        <div className="col-start-1 row-start-2">
          <Side title="Leads here">
            {hereFrom.map((o) => (
              <div key={o.action.id} className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <UnitBox r={UNIT_INFO[o.unit]} label={o.action.does} />
                </div>
                <span aria-hidden>→</span>
              </div>
            ))}
          </Side>
        </div>
      )}
      <div className="col-start-2 row-start-2">
        <UnitBox r={here} center />
      </div>
      {side(false) && (
        <div className="col-start-3 row-start-2">
          <Side title="Leads to">
            {leadsTo.map((a) =>
              a.target ? (
                <div key={a.id} className="flex items-center gap-1">
                  <span aria-hidden>→</span>
                  <div className="min-w-0 flex-1">
                    <UnitBox r={UNIT_INFO[a.target.unit]} label={a.does} />
                  </div>
                </div>
              ) : null,
            )}
          </Side>
        </div>
      )}
      {s.madeOf.length > 0 && (
        <div className="col-start-2 row-start-3 space-y-1">
          <p className="text-center">{ARROW}</p>
          <p className="text-xs text-muted-foreground">Made of</p>
          <div className="flex flex-wrap gap-2">
            {s.madeOf.map((m) => (
              <UnitBox key={m.name} r={{ name: m.name, kind: 'component' }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** The spec's sections after Purpose and States. `current` marks a row in
 *  option B's state list. */
function SpecSections({
  s,
  grid,
  current,
  onPick,
}: {
  s: Sample;
  grid: boolean;
  current?: string;
  onPick?: (id: string) => void;
}) {
  return (
    <div
      className={cn(grid ? 'grid grid-cols-2 gap-x-6 gap-y-6' : 'space-y-6')}
    >
      {onPick && (
        <Section title="States">
          <Tbl
            caption="States"
            rows={s.states}
            columns={[
              {
                key: 'n',
                header: 'State',
                cell: (r) => (
                  <button
                    type="button"
                    onClick={() => {
                      onPick(r.id);
                    }}
                    className={cn(
                      'text-left font-medium',
                      r.id === current && 'text-primary',
                    )}
                  >
                    {r.id === current ? '● ' : ''}
                    {r.name}
                  </button>
                ),
              },
              { key: 'w', header: 'When', cell: (r) => r.when },
            ]}
          />
        </Section>
      )}
      <Section title="Neighbourhood">
        <NeighbourMap s={s} />
      </Section>
      <Section title="Actions">
        <Tbl
          caption="Actions"
          rows={s.actions}
          columns={[
            { key: 'i', header: 'Id', mono: true, cell: (r) => r.id },
            { key: 'd', header: 'The student', cell: (r) => r.does },
            { key: 'l', header: 'Leads to', cell: (r) => r.leads },
          ]}
        />
      </Section>
      <Section title="Data and loading">
        {s.data.length === 0 ? (
          <Empty />
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
      </Section>
      <Section title={s.inputsTitle}>
        <Tbl
          caption={s.inputsTitle}
          rows={s.inputs}
          columns={[
            { key: 'n', header: 'Name', mono: true, cell: (r) => r.name },
            { key: 't', header: 'Type', mono: true, cell: (r) => r.type },
            { key: 'd', header: 'Default', mono: true, cell: (r) => r.default },
            { key: 'w', header: 'Does', cell: (r) => r.does },
          ]}
        />
      </Section>
      <Section title="Rules">
        <Tbl
          caption="Rules"
          rows={s.rules}
          columns={[
            {
              key: 'i',
              header: 'Rule',
              width: '14rem',
              cell: (r) => <RuleChip id={r.id} local={r.local} />,
            },
            {
              key: 't',
              header: 'Says',
              cell: (r) =>
                r.local ? `${r.text} (local to this unit)` : r.text,
            },
          ]}
        />
      </Section>
      <Section title="Decisions">
        <Tbl
          caption="Decisions"
          rows={s.decisions}
          columns={[
            { key: 'w', header: 'What', cell: (r) => r.what },
            { key: 'y', header: 'Why', cell: (r) => r.why },
            { key: 'b', header: 'Beat', cell: (r) => r.beat },
          ]}
        />
        <a href="#" className="text-xs text-primary hover:underline">
          Full log
        </a>
      </Section>
    </div>
  );
}

function Header({ s }: { s: Sample }) {
  return (
    <header className="space-y-1">
      <p className="text-xs tracking-wide text-primary uppercase">{s.kind}</p>
      <h1 className="text-xl font-semibold">{s.title}</h1>
      <p className="text-sm text-muted-foreground">{s.purpose}</p>
    </header>
  );
}

function Chips({
  s,
  current,
  onPick,
}: {
  s: Sample;
  current: string;
  onPick: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="radiogroup"
      aria-label="State"
    >
      {s.states.map((st) => (
        <button
          key={st.id}
          type="button"
          role="radio"
          aria-checked={st.id === current}
          title={st.when}
          onClick={() => {
            onPick(st.id);
          }}
          className={cn(
            'h-control-sm rounded-md border px-2 text-xs',
            st.id === current
              ? 'border-primary bg-primary-soft font-medium text-primary'
              : 'bg-card text-muted-foreground hover:bg-muted',
          )}
        >
          {st.name}
        </button>
      ))}
    </div>
  );
}

const MODES = [
  { value: 'loaded', label: 'Loaded' },
  { value: 'loading', label: 'Loading' },
  { value: 'both', label: 'Both' },
] as const;

/** Everything the example's controls hold, so each arrangement places
 *  the same controls and shares the same state. */
function useExample(s: Sample) {
  const [state, setState] = useState(s.states[0].id);
  const [width, setWidth] = useState(s.kind === 'pane' ? 440 : 480);
  const [stress, setStress] = useState(false);
  const [mode, setMode] = useState<Mode>('loaded');
  const [night, setNight] = useState(false);
  return {
    s,
    state,
    setState,
    width,
    setWidth,
    stress,
    setStress,
    mode,
    setMode,
    night,
    setNight,
  };
}
type Ex = ReturnType<typeof useExample>;

function FlowStrip({ ex }: { ex: Ex }) {
  const ids = ex.s.flow;
  if (!ids) return null;
  const flow = ids.flatMap((id) => ex.s.actions.filter((a) => a.id === id));
  const at = flow.findIndex((f) => f.state === ex.state);
  const go = (i: number) => {
    ex.setState(flow[i].state ?? ex.state);
  };
  return (
    <div className="space-y-2 rounded-md border bg-card p-3">
      <ol className="flex flex-wrap gap-2">
        {flow.map((f, i) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => {
                go(i);
              }}
              className={cn(
                'flex items-center gap-2 rounded-md border px-2 py-1 text-sm',
                i === at
                  ? 'border-primary bg-primary-soft font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <span className="font-mono text-xs">{i + 1}</span>
              {f.does}
            </button>
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {at >= 0
            ? `Step ${at + 1}: ${flow[at].leads}`
            : 'Not a step of the flow.'}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={at <= 0}
            onClick={() => {
              go(at - 1);
            }}
          >
            Previous
          </Button>
          <Button
            size="sm"
            disabled={at === flow.length - 1}
            onClick={() => {
              go(at + 1);
            }}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The live example and its controls: width (drag the right edge),
 *  Stress, Loaded | Loading | Both, Paper | Night, and the flow. Night
 *  scopes the theme tokens to this box with the `dark` class. */
function ExampleFrame({ ex, chips }: { ex: Ex; chips?: ReactNode }) {
  const { s } = ex;
  const cur = s.states.find((x) => x.id === ex.state) ?? s.states[0];
  const loading = ex.mode === 'loading';
  return (
    <div className="space-y-3">
      {chips}
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Loading"
          value={ex.mode}
          options={MODES}
          onChange={ex.setMode}
        />
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
        <Button
          variant={ex.stress ? 'primary' : 'outline'}
          aria-pressed={ex.stress}
          onClick={() => {
            ex.setStress(!ex.stress);
            if (s.kind === 'component' && !ex.stress) ex.setWidth(160);
          }}
        >
          Stress
        </Button>
        {s.kind === 'pane' && (
          <SegmentedControl
            label="Width"
            value={ex.width >= 800 ? 'full' : 'pane'}
            options={[
              { value: 'pane', label: 'Pane width' },
              { value: 'full', label: 'Full width' },
            ]}
            onChange={(v) => {
              ex.setWidth(v === 'full' ? 800 : 440);
            }}
          />
        )}
        <span className="font-mono text-xs text-muted-foreground">
          {ex.width}px
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="flex w-max min-w-full">
          <div
            className={cn(
              'overflow-hidden rounded-md border bg-background p-4 text-foreground',
              ex.night && 'dark',
            )}
            style={{ width: ex.width + 33 }}
          >
            <div style={{ width: ex.width }}>
              {ex.mode === 'both' ? (
                <Both
                  kind={s.kind}
                  state={cur.id}
                  stress={ex.stress}
                  night={ex.night}
                  width={ex.width}
                />
              ) : (
                <Example
                  kind={s.kind}
                  state={cur.id}
                  stress={ex.stress}
                  loading={loading}
                />
              )}
            </div>
          </div>
          <ResizeHandle
            label="Resize the example"
            pane="before"
            value={ex.width}
            min={120}
            max={1200}
            onChange={ex.setWidth}
            onCommit={() => {}}
            onReset={() => {
              ex.setWidth(s.kind === 'pane' ? 440 : 480);
            }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {cur.name}: {cur.when}
        {ex.mode !== 'loaded' && !s.skeleton && ' No skeleton to show.'}
      </p>
      <FlowStrip ex={ex} />
    </div>
  );
}

function OptionA({ s }: Body) {
  const ex = useExample(s);
  return (
    <div className="space-y-6">
      <Header s={s} />
      <ExampleFrame
        ex={ex}
        chips={<Chips s={s} current={ex.state} onPick={ex.setState} />}
      />
      <SpecSections s={s} grid />
    </div>
  );
}

function OptionB({ s }: Body) {
  const ex = useExample(s);
  return (
    <div className="flex items-start gap-6">
      <div className="sticky top-0 max-h-full w-[55%] shrink-0 overflow-auto">
        <ExampleFrame ex={ex} />
      </div>
      <div className="min-w-0 flex-1 space-y-6">
        <Header s={s} />
        <SpecSections
          s={s}
          grid={false}
          current={ex.state}
          onPick={ex.setState}
        />
      </div>
    </div>
  );
}

function Thumb({
  s,
  stateId,
  name,
  when,
  onOpen,
}: {
  s: Sample;
  stateId: string;
  name: string;
  when: string;
  onOpen: () => void;
}) {
  // A pane is rendered in its own window at 440x560 and scaled to the card.
  const W = 440;
  const H = 600;
  const scale = 0.55;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="space-y-1 rounded-md border bg-card p-2 text-left hover:bg-muted/50"
    >
      <div
        className="overflow-hidden rounded-sm border bg-background"
        style={{ width: W * scale, height: H * scale }}
      >
        {s.kind === 'pane' ? (
          <div
            className="overflow-hidden"
            style={{ width: W * scale, height: H * scale }}
          >
            <iframe
              title={name}
              src={`/design-mock/frame/pane/${stateId}`}
              tabIndex={-1}
              className="pointer-events-none origin-top-left border-0"
              style={{
                width: 1100,
                height: H / scale,
                transform: `scale(${scale})`,
              }}
            />
          </div>
        ) : (
          <div
            className="origin-top-left p-3"
            style={{ transform: 'scale(0.9)' }}
          >
            <Example
              kind={s.kind}
              state={stateId}
              stress={false}
              loading={false}
            />
          </div>
        )}
      </div>
      <p className="text-sm font-medium">{name}</p>
      <p className="max-w-[16rem] text-xs text-muted-foreground">{when}</p>
    </button>
  );
}

function OptionC({ s }: Body) {
  const ex = useExample(s);
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-6">
      <Header s={s} />
      {open ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
            }}
            className="text-xs text-primary hover:underline"
          >
            Back to all states
          </button>
          <ExampleFrame ex={ex} />
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {s.states.map((st) => (
            <Thumb
              key={st.id}
              s={s}
              stateId={st.id}
              name={st.name}
              when={st.when}
              onOpen={() => {
                ex.setState(st.id);
                setOpen(true);
              }}
            />
          ))}
        </div>
      )}
      <div className="max-w-4xl">
        <SpecSections s={s} grid={false} />
      </div>
    </div>
  );
}

interface Body {
  s: Sample;
}

function UnitList({ title }: { title: string }) {
  const [q, setQ] = useState('');
  return (
    <nav className="w-56 shrink-0 space-y-3 overflow-auto border-r bg-rail p-3">
      <Input
        placeholder="Filter"
        aria-label="Filter units"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
        }}
      />
      {UNITS.map((g) => {
        const names = g.names.filter((n) =>
          n.toLowerCase().includes(q.toLowerCase()),
        );
        if (names.length === 0) return null;
        return (
          <div key={g.group} className="space-y-0.5">
            <p className="px-2 text-xs text-muted-foreground">{g.group}</p>
            {names.map((n) => (
              <a
                key={n}
                href="#"
                className={cn(
                  'block rounded-md px-2 py-1.5 text-sm hover:bg-muted/50',
                  n === title && 'bg-primary-soft font-medium text-primary',
                )}
              >
                {n}
              </a>
            ))}
          </div>
        );
      })}
    </nav>
  );
}

export function DesignMock() {
  const { option, kind } = useParams();
  const o = OPTIONS.find((x) => x.value === option)?.value;
  const k = KINDS.find((x) => x.value === kind)?.value;
  if (!o || !k) return <Navigate to="/design-mock/a/component" replace />;
  const s = SAMPLES[k];
  const Body: Record<Option, (b: Body) => ReactNode> = {
    a: OptionA,
    b: OptionB,
    c: OptionC,
  };
  const Layout = Body[o];
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <div className="flex h-row shrink-0 items-center gap-4 border-b bg-muted px-card text-xs">
        <span className="text-muted-foreground">Mockup (temporary)</span>
        <nav className="flex gap-4">
          {OPTIONS.map((x) => (
            <Link
              key={x.value}
              to={`/design-mock/${x.value}/${k}`}
              className={cn(
                x.value === o
                  ? 'font-semibold text-primary'
                  : 'text-muted-foreground',
              )}
            >
              {x.label}
            </Link>
          ))}
        </nav>
        <span className="text-muted-foreground">|</span>
        <nav className="flex gap-4">
          {KINDS.map((x) => (
            <Link
              key={x.value}
              to={`/design-mock/${o}/${x.value}`}
              className={cn(
                x.value === k
                  ? 'font-semibold text-primary'
                  : 'text-muted-foreground',
              )}
            >
              {x.label}
            </Link>
          ))}
          <span className="text-muted-foreground">View: skipped</span>
        </nav>
      </div>
      <div className="flex h-12 shrink-0 items-center gap-6 border-b px-card">
        <Mark className="size-5" />
        <UnderlineNav className="h-full">
          {TABS.map((t) => (
            <UnderlineTab
              key={t}
              active={t === (k === 'pane' ? 'Panes' : 'Components')}
              onClick={() => {}}
            >
              {t}
            </UnderlineTab>
          ))}
        </UnderlineNav>
      </div>
      <div className="flex min-h-0 flex-1">
        <UnitList title={s.title} />
        <main className="min-w-0 flex-1 overflow-auto p-6">
          <Layout key={`${o}${k}`} s={s} />
        </main>
      </div>
    </div>
  );
}
