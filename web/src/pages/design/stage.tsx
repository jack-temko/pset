import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/button';
import { ResizeHandle } from '@/components/resize-handle';
import { SegmentedControl } from '@/components/segmented-control';
import type { AnyExamples } from '@/design/examples';
import type { Entry } from '@/design/registry';
import type { AnySpec } from '@/design/spec';
import { cn } from '@/lib/utils';
import '@/design/tokens.css';
import { unitPath } from './lookup';
import {
  DEFAULT_WIDTH,
  STRESS_WIDTH,
  type Load,
  type StageState,
} from './url-state';

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex h-control items-center gap-2">{children}</div>
    </div>
  );
}

type Change = (patch: Partial<StageState>) => void;

function Toolbar({
  spec,
  s,
  change,
}: {
  spec: AnySpec;
  s: StageState;
  change: Change;
}) {
  const full = s.w === 'full';
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-4">
      <Group label="State">
        <select
          aria-label="State"
          value={s.state}
          onChange={(e) => {
            change({ state: e.target.value });
          }}
          style={{ width: 144 }}
          className="h-control rounded-md border border-input bg-card px-3 text-sm text-foreground"
        >
          {spec.states.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </select>
      </Group>
      <Group label="Load">
        <SegmentedControl<Load>
          label="Load"
          value={s.load}
          options={[
            { value: 'loaded', label: 'Loaded' },
            { value: 'loading', label: 'Loading' },
            { value: 'both', label: 'Both' },
          ]}
          onChange={(load) => {
            change({ load });
          }}
        />
      </Group>
      <Group label="Content">
        <SegmentedControl
          label="Content"
          value={s.stress ? 'stress' : 'normal'}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'stress', label: 'Stress' },
          ]}
          onChange={(v) => {
            const stress = v === 'stress';
            change(
              stress && spec.kind === 'component'
                ? { stress, w: STRESS_WIDTH }
                : { stress },
            );
          }}
        />
      </Group>
      <Group label="Width">
        <SegmentedControl
          label="Width"
          value={full ? 'full' : 'default'}
          options={[
            {
              value: 'default',
              label: spec.kind === 'pane' ? 'Pane' : 'Default',
            },
            { value: 'full', label: 'Full' },
          ]}
          onChange={(v) => {
            change({ w: v === 'full' ? 'full' : defaultPx(spec) });
          }}
        />
        <span className="font-mono text-xs text-muted-foreground">
          {full ? 'full' : `${String(s.w)}px`}
        </span>
      </Group>
    </div>
  );
}

/** The width the Default option goes back to: a view has none of its own,
 *  so it gets a common desktop column. */
function defaultPx(spec: AnySpec) {
  const d = spec.exampleWidth ?? DEFAULT_WIDTH[spec.kind];
  return d === 'full' ? 880 : d;
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

/** The unit's renders, loaded on demand. */
function useExamples(entry: Entry) {
  const [got, setGot] = useState<{
    id: string;
    ex?: AnyExamples;
    error?: string;
  }>();
  const id = entry.spec.id;
  useEffect(() => {
    let live = true;
    entry.examples().then(
      (ex) => {
        if (live) setGot({ id, ex });
      },
      (e: unknown) => {
        if (live) setGot({ id, error: String(e) });
      },
    );
    return () => {
      live = false;
    };
  }, [entry, id]);
  return got?.id === id ? got : undefined;
}

function Message({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

/** One state of the unit, in the chosen load mode. Both lays the skeleton
 *  over the loaded content at half strength, so a layout jump shows as a
 *  doubled edge. */
function Render({
  ex,
  spec,
  s,
}: {
  ex: AnyExamples;
  spec: AnySpec;
  s: StageState;
}) {
  const loaded = s.stress ? ex.stress : ex.states[s.state];
  const skeleton = ex.skeletons?.[s.state];
  if (s.load === 'loaded') return <>{loaded()}</>;
  if (!skeleton)
    return (
      <Message>{spec.title} has no skeleton: it waits on nothing.</Message>
    );
  if (s.load === 'loading') return <>{skeleton()}</>;
  return (
    <div className="relative">
      <div>{loaded()}</div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
      >
        {skeleton()}
      </div>
    </div>
  );
}

/** One stage, on the muted ground: the unit at its chosen width, left
 *  aligned, with the resize handle on its right edge. The example sits under
 *  the `ds` class, so it is drawn in the foundations' one theme whatever the
 *  app's own theme is. */
function Stage({
  entry,
  s,
  change,
}: {
  entry: Entry;
  s: StageState;
  change: Change;
}) {
  const { spec } = entry;
  const ref = useRef<HTMLDivElement>(null);
  const inner = useInnerWidth(ref);
  const got = useExamples(entry);
  const width = s.w === 'full' ? inner : Math.min(s.w, inner || s.w);
  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-md border bg-muted p-card text-foreground"
    >
      <div className="flex items-stretch">
        <div className="min-w-0">
          <div
            className={cn(
              'ds shrink-0',
              spec.kind !== 'pane' &&
                'rounded-lg border border-(--ds-border-muted) p-6',
            )}
            style={{ width }}
          >
            {got?.ex ? (
              <Render
                key={`${spec.id}:${s.state}:${s.load}:${String(s.stress)}`}
                ex={got.ex}
                spec={spec}
                s={s}
              />
            ) : (
              <Message>{got?.error ?? 'Loading the example.'}</Message>
            )}
          </div>
          {/* An example may put a caption here (a readout of what it tells the
            rest of the app) in the stage's own light text, outside its frame. */}
          <div data-stage-caption className="text-xs text-muted-foreground" />
        </div>
        <ResizeHandle
          label="Resize the example"
          pane="before"
          value={width}
          min={120}
          max={Math.max(inner, 120)}
          onChange={(px) => {
            change({ w: px });
          }}
          onCommit={() => {}}
          onReset={() => {
            change({ w: defaultPx(spec) });
          }}
        />
      </div>
    </div>
  );
}

/** The student's journeys: the steps of the unit's flow, with Previous and
 *  Next. A step that lands in this unit moves the example to that state;
 *  one that lands in another unit opens that unit. */
function FlowStrip({
  spec,
  s,
  change,
}: {
  spec: AnySpec;
  s: StageState;
  change: Change;
}) {
  const navigate = useNavigate();
  const [chosen, setChosen] = useState(spec.flows?.[0]?.id);
  const flow = spec.flows?.find((f) => f.id === chosen) ?? spec.flows?.[0];
  if (!flow) return null;
  const steps = flow.steps.flatMap((id) =>
    spec.actions.filter((a) => a.id === id),
  );
  const landing = (i: number) => steps[i].target;
  const at = steps.findIndex((_, i) => {
    const t = landing(i);
    return t?.unit === spec.id && t.state === s.state;
  });
  const go = (i: number) => {
    const t = landing(i);
    if (!t) return;
    if (t.unit === spec.id) {
      if (t.state) change({ state: t.state });
      return;
    }
    void navigate(unitPath(t.unit, t.state));
  };
  return (
    <div className="mt-card space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">Flow: {flow.name}</p>
          {(spec.flows?.length ?? 0) > 1 && (
            <select
              aria-label="Flow"
              value={flow.id}
              onChange={(e) => {
                setChosen(e.target.value);
              }}
              className="h-control rounded-md border border-input bg-card px-3 text-sm text-foreground"
            >
              {(spec.flows ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          <SegmentedControl
            label="Step"
            value={at >= 0 ? steps[at].id : ''}
            options={steps.map((a, i) => ({
              value: a.id,
              label: `${String(i + 1)} ${a.label}`,
            }))}
            onChange={(id) => {
              go(steps.findIndex((a) => a.id === id));
            }}
          />
        </div>
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
            disabled={at === steps.length - 1}
            onClick={() => {
              go(at + 1);
            }}
          >
            Next
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {at >= 0 ? `Step ${String(at + 1)}: ${steps[at].does}` : 'Not started.'}
      </p>
    </div>
  );
}

/** The example and everything that drives it. */
export function Example({
  entry,
  s,
  change,
}: {
  entry: Entry;
  s: StageState;
  change: Change;
}) {
  const { spec } = entry;
  const cur = spec.states.find((x) => x.id === s.state) ?? spec.states[0];
  return (
    <div>
      <Toolbar spec={spec} s={s} change={change} />
      <p className="mt-card text-xs text-muted-foreground">
        {cur.when}
        {cur.text ? ` It shows: "${cur.text}"` : ''}
        {s.stress ? ` Stress: ${spec.stress}` : ''}
      </p>
      <div className="mt-card">
        <Stage entry={entry} s={s} change={change} />
      </div>
      <FlowStrip spec={spec} s={s} change={change} />
    </div>
  );
}
