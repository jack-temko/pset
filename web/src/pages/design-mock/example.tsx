import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';

import { Button, IconButton } from '@/components/button';
import { Spinner } from '@/components/spinner';
import { Run } from '@/pages/views/run';
import { VIEWS } from '@/views/registry';
import type { Kind } from './sample';

const VARIANTS = [
  'primary',
  'outline',
  'secondary',
  'ghost',
  'destructive',
] as const;
const SIZES = ['sm', 'default', 'lg'] as const;

const HOMEWORK = VIEWS.find((v) => v.id === 'homework');

function noop() {}

export type Mode = 'loaded' | 'loading' | 'both';

const LONG_LABEL =
  'Import every page of the scanned electromagnetics textbook, chapters one to nine';

/** The live homework panel on one scenario. A fresh Run per state. Loading
 *  is the same scenario with every answer held back for good, so the view
 *  draws its own real skeletons. Stress is the scenario with the long
 *  title and the long list. */
export function PaneRun({
  state,
  loading,
  stress,
}: {
  state: string;
  loading: boolean;
  stress: boolean;
}) {
  const base = HOMEWORK?.scenarios.find(
    (s) => s.id === (stress ? 'long-set' : state),
  );
  const scenario = useMemo(
    () =>
      base && loading
        ? {
            ...base,
            start: (ctx: Parameters<typeof base.start>[0]) => ({
              ...base.start(ctx),
              latency: 1e9,
            }),
          }
        : base,
    [base, loading],
  );
  if (!HOMEWORK || !scenario) return <p>No such scenario.</p>;
  return (
    <div className="[&_aside]:w-full!">
      <Run
        key={`${state}:${String(loading)}:${String(stress)}`}
        entry={HOMEWORK}
        scenario={scenario}
        speed={1}
        wide={false}
        onTraffic={noop}
        onHandoff={noop}
      />
    </div>
  );
}

function ButtonState({ state, stress }: { state: string; stress: boolean }) {
  const row = (children: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-3">{children}</div>
  );
  if ((VARIANTS as readonly string[]).includes(state)) {
    const variant = state as (typeof VARIANTS)[number];
    return row(
      SIZES.map((size) => (
        <Button key={size} variant={variant} size={size}>
          {stress
            ? LONG_LABEL
            : size === 'default'
              ? 'Next question'
              : `Size ${size}`}
        </Button>
      )),
    );
  }
  if (state === 'sizes')
    return row(
      SIZES.map((size) => (
        <Button key={size} size={size}>
          {stress ? LONG_LABEL : size}
        </Button>
      )),
    );
  if (state === 'icon')
    return row(
      <>
        <Button>
          <Plus /> Import a PDF
        </Button>
        <Button variant="destructive">
          <Trash2 /> Delete set
        </Button>
        <IconButton variant="ghost" aria-label="Add">
          <Plus />
        </IconButton>
        <IconButton variant="outline" aria-label="Add outlined">
          <Plus />
        </IconButton>
      </>,
    );
  if (state === 'disabled')
    return row(
      VARIANTS.map((variant) => (
        <Button key={variant} variant={variant} disabled>
          {variant}
        </Button>
      )),
    );
  return row(
    <>
      <Button disabled>
        <Spinner /> Saving
      </Button>
      <Button variant="outline" disabled>
        <Spinner /> Testing
      </Button>
    </>,
  );
}

/** One state of a unit, live, loaded or loading. A unit with no skeleton
 *  says so rather than faking one. */
export function Example({
  kind,
  state,
  stress,
  loading,
}: {
  kind: Kind;
  state: string;
  stress: boolean;
  loading: boolean;
}) {
  if (kind === 'pane')
    return <PaneRun state={state} stress={stress} loading={loading} />;
  if (kind === 'component') {
    if (loading)
      return (
        <p className="text-xs text-muted-foreground">
          Button has no skeleton: it waits on nothing.
        </p>
      );
    return <ButtonState state={state} stress={stress} />;
  }
  return <p className="text-sm text-muted-foreground">Not built.</p>;
}

/** Skeleton and content in one box, at half opacity each, so a layout
 *  jump shows as a doubled edge. A pane's two live copies each need their
 *  own window (the mock replaces fetch globally), so they are frames. */
export function Both({
  kind,
  state,
  stress,
  night,
  width,
}: {
  kind: Kind;
  state: string;
  stress: boolean;
  night: boolean;
  width: number;
}) {
  if (kind !== 'pane')
    return <Example kind={kind} state={state} stress={stress} loading />;
  const src = (loading: boolean) =>
    `/design-mock/frame/pane/${state}?${new URLSearchParams({
      loading: String(loading),
      stress: String(stress),
      night: String(night),
      w: String(width),
    }).toString()}`;
  return (
    <div className="relative h-[800px] w-full overflow-hidden">
      {/* The app asks for 1024px of window, so the frame is that wide and
          the box clips it to the example. */}
      <iframe
        title="Loaded"
        src={src(false)}
        className="absolute inset-y-0 left-0 h-full w-[1100px] border-0 opacity-50"
      />
      <iframe
        title="Loading"
        src={src(true)}
        tabIndex={-1}
        className="pointer-events-none absolute inset-y-0 left-0 h-full w-[1100px] border-0 opacity-50"
      />
    </div>
  );
}

/** Thumbnails and the Both overlay need their own window: the mock
 *  replaces fetch globally, so two live panes in one page would fight
 *  over it. */
export function PaneFrame() {
  const state = location.pathname.split('/').pop() ?? 'happy';
  const [q] = useSearchParams();
  return (
    <div
      className={
        q.get('night') === 'true'
          ? 'dark min-h-dvh bg-background text-foreground'
          : 'min-h-dvh bg-background text-foreground'
      }
    >
      <div style={{ width: Number(q.get('w') ?? 440) }}>
        <PaneRun
          state={state}
          loading={q.get('loading') === 'true'}
          stress={q.get('stress') === 'true'}
        />
      </div>
    </div>
  );
}
