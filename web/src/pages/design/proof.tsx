import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ForceLoading } from '@/design/loading';
import { FIXTURES, UNITS, type Entry } from '@/design/registry';
import type { AnyExamples } from '@/design/examples';
import type { AnySpec } from '@/design/spec';
import '@/design/tokens.css';
import { DEFAULT_WIDTH } from './url-state';

/** The box proof (ideas/skeleton-plan.md, layer B; skeleton-grill S6): every
 *  state a unit can load into, drawn loaded and loading at the unit's width,
 *  and every box compared. A unit on the loading contract draws its loading
 *  form from the same example, forced; one not yet converted is measured
 *  against its hand-written skeleton, so the board shows how far it is off. */

/** Two boxes count as the same to this many pixels. */
export const TOLERANCE = 0.01;

/** A view's width in the proof: a common desktop column. */
const VIEW_PX = 1280;

export interface ProofResult {
  unit: string;
  state: string;
  /** On the loading contract (made with waits): only these fail the check.
   *  The rest are shown for how far they are from it. */
  contract: boolean;
  ok: boolean;
  /** The larger of the width and height differences, in px. */
  worst: number;
  /** What differed, for the board. */
  note: string;
}

const widthOf = (spec: AnySpec) => {
  const d = spec.exampleWidth ?? DEFAULT_WIDTH[spec.kind];
  return d === 'full' ? VIEW_PX : d;
};

/** The units the proof covers: every one that reads data. */
const PROVEN: readonly Entry[] = [...UNITS, ...FIXTURES].filter(
  (e) => (e.spec.data?.length ?? 0) > 0,
);

/** A state's whole box, loading against loaded: nothing in a unit to mark
 *  or list, so a new or changed component needs nothing here. */
function compare(loaded: HTMLElement, loading: HTMLElement) {
  const a = loaded.getBoundingClientRect();
  const b = loading.getBoundingClientRect();
  const dw = Math.abs(a.width - b.width);
  const dh = Math.abs(a.height - b.height);
  const worst = Math.max(dw, dh);
  const note =
    worst <= TOLERANCE
      ? ''
      : dh >= dw
        ? `${dh.toFixed(1)}px ${b.height < a.height ? 'short' : 'tall'}`
        : `${dw.toFixed(1)}px ${b.width < a.width ? 'narrow' : 'wide'}`;
  return { ok: worst <= TOLERANCE, worst, note };
}

/** One state, drawn twice, measured once both have laid out and the fonts
 *  are in. */
function Case({
  unit,
  state,
  contract,
  width,
  loaded,
  loading,
  onDone,
}: {
  unit: string;
  state: string;
  contract: boolean;
  width: number;
  loaded: () => ReactNode;
  loading: () => ReactNode;
  onDone: (r: ProofResult) => void;
}) {
  const a = useRef<HTMLDivElement>(null);
  const b = useRef<HTMLDivElement>(null);
  // Held, so a new callback from the parent does not measure again.
  const report = useRef(onDone);
  useEffect(() => {
    report.current = onDone;
  });
  useEffect(() => {
    let live = true;
    void document.fonts.ready.then(() => {
      // Two frames: images, math and charts settle after the first paint.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (live && a.current && b.current)
            report.current({
              unit,
              state,
              contract,
              ...compare(a.current, b.current),
            });
        });
      });
    });
    return () => {
      live = false;
    };
  }, [unit, state, contract]);
  return (
    <div className="flex items-start gap-6">
      <div ref={a} className="ds shrink-0" style={{ width }}>
        {loaded()}
      </div>
      <div ref={b} className="ds shrink-0" style={{ width }}>
        {loading()}
      </div>
    </div>
  );
}

/** Every loadable state of one unit, and its stress render, one after
 *  another; reports each result. */
export function UnitProof({
  entry,
  onlyContract,
  onResult,
  onFinished,
}: {
  entry: Entry;
  /** Skip a unit not on the contract: the check in CI, kept light. */
  onlyContract?: boolean;
  onResult: (r: ProofResult) => void;
  onFinished: () => void;
}) {
  const { spec } = entry;
  const [ex, setEx] = useState<AnyExamples>();
  const [at, setAt] = useState(0);
  useEffect(() => {
    void entry.examples().then(setEx);
  }, [entry]);

  const states = spec.states.filter((s) => s.loads !== false);
  const cases = [
    ...states.map((s) => ({ id: s.id, stress: false })),
    { id: 'stress', stress: true },
  ];
  const current = cases.at(at);
  const finished = useRef(onFinished);
  useEffect(() => {
    finished.current = onFinished;
  });
  const skipped = onlyContract === true && ex?.skeletons !== undefined;
  const over = ex !== undefined && (current === undefined || skipped);
  useEffect(() => {
    if (over) finished.current();
  }, [over]);
  if (!ex || !current || skipped) return null;

  const render = current.stress ? ex.stress : ex.states[current.id];
  // A unit off the contract has hand-written skeletons; its stress case has
  // none, so it is measured against the first state's.
  const written =
    ex.skeletons?.[current.id] ??
    (current.stress ? ex.skeletons?.[spec.states[0].id] : undefined);
  const loading = () =>
    written ? (
      written()
    ) : (
      <ForceLoading.Provider value="shape">{render()}</ForceLoading.Provider>
    );
  return (
    <Case
      key={current.id}
      unit={spec.id}
      state={current.id}
      contract={ex.skeletons === undefined}
      width={widthOf(spec)}
      loaded={render}
      loading={loading}
      onDone={(r) => {
        onResult(r);
        setAt((n) => n + 1);
      }}
    />
  );
}

declare global {
  interface Window {
    /** Set when the board has measured every unit: what the CI script reads. */
    loadingProof?: ProofResult[];
  }
}

/** `/design/loading`: the board. Proves every unit that reads data, one at a
 *  time, then lists every state, failures first and worst first. */
export function LoadingBoard() {
  const onlyContract =
    new URLSearchParams(window.location.search).get('only') === 'contract';
  const [results, setResults] = useState<ProofResult[]>([]);
  const [at, setAt] = useState(0);
  const entry = PROVEN.at(at);
  const done = entry === undefined;
  useEffect(() => {
    if (done) window.loadingProof = results;
  }, [done, results]);

  const shown = [...results].sort(
    (p, q) =>
      Number(q.contract) - Number(p.contract) ||
      Number(p.ok) - Number(q.ok) ||
      q.worst - p.worst,
  );
  const on = results.filter((r) => r.contract);
  const failing = on.filter((r) => !r.ok).length;
  return (
    <div className="space-y-6 p-6" data-proof={done ? 'done' : 'running'}>
      <div>
        <h1 className="text-2xl font-semibold">Loading</h1>
        <p className="text-sm text-muted-foreground">
          {done
            ? `On the loading contract: ${String(on.length)} states, ${String(failing)} off. Each state drawn loading must be the same size as loaded, to ${String(TOLERANCE)}px. Units not converted yet are listed under them, for how far off they are.`
            : `Proving ${entry.spec.id}…`}
        </p>
      </div>
      <table className="text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="pr-6 font-medium">Contract</th>
            <th className="pr-6 font-medium">Unit</th>
            <th className="pr-6 font-medium">State</th>
            <th className="pr-6 font-medium">Result</th>
            <th className="font-medium">First difference</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={`${r.unit}:${r.state}`}>
              <td className="pr-6 text-muted-foreground">
                {r.contract ? 'Yes' : 'Not yet'}
              </td>
              <td className="pr-6">{r.unit}</td>
              <td className="pr-6">{r.state}</td>
              <td
                className={`pr-6 ${r.ok ? 'text-green-600' : 'text-red-600'}`}
              >
                {r.ok
                  ? 'Matches'
                  : Number.isFinite(r.worst)
                    ? `${r.worst.toFixed(1)}px off`
                    : 'Different parts'}
              </td>
              <td className="text-muted-foreground">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* The unit being measured, out of the way of the board. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[20000px] top-0"
      >
        {entry && (
          <UnitProof
            key={entry.spec.id}
            entry={entry}
            onlyContract={onlyContract}
            onResult={(r) => {
              setResults((all) => [...all, r]);
            }}
            onFinished={() => {
              setAt((n) => n + 1);
            }}
          />
        )}
      </div>
    </div>
  );
}
