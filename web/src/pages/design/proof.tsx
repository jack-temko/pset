import {
  Component,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ForceLoading } from '@/design/loading';
import { hasQuietForm } from '@/design/quiet';
import { FIXTURES, UNITS, type Entry } from '@/design/registry';
import type { AnyExamples } from '@/design/examples';
import type { AnySpec } from '@/design/spec';
import '@/design/tokens.css';
import { DEFAULT_WIDTH } from './url-state';

/** The loading proof (skeleton-grill S6 and D8): every state a screen can
 *  load into, drawn loaded and as its quiet form at the screen's width. A
 *  screen on the loading contract draws its quiet form from the same
 *  example, forced. Two checks:
 *  - text: every text drawn in the quiet form sits at the same place once
 *    loaded;
 *  - flip: drawn quiet, then turned loaded in the same tree, every text
 *    survives (no remount) and none reaches a new place in a single frame.
 *  A screen whose quiet form draws what its loaded form draws fails: it has
 *  none. */

/** A text counts as in place to this many pixels. */
export const TEXT_TOLERANCE = 0.5;

/** A view's width in the proof: a common desktop column. */
const VIEW_PX = 1280;

export interface ProofResult {
  unit: string;
  state: string;
  ok: boolean;
  /** How far the worst text moved, in px; infinite for a missing one. */
  worst: number;
  /** What differed, for the board. */
  note: string;
}

const widthOf = (spec: AnySpec) => {
  const d = spec.exampleWidth ?? DEFAULT_WIDTH[spec.kind];
  return d === 'full' ? VIEW_PX : d;
};

/** The units the proof covers: every screen and pane that reads data. */
const PROVEN: readonly Entry[] = [...UNITS, ...FIXTURES].filter((e) =>
  hasQuietForm(e.spec),
);

/** One drawn text: its node, its content and where it starts in its frame. */
interface Placed {
  node: Text;
  text: string;
  x: number;
  y: number;
}

/** Every visible text in a frame, in document order. A text in a hidden
 *  box (a failed state keeping its shape invisibly) is not drawn. */
function textsOf(frame: HTMLElement): Placed[] {
  const at = frame.getBoundingClientRect();
  const out: Placed[] = [];
  const walk = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
    const node = n as Text;
    const text = node.data.trim();
    const host = node.parentElement;
    if (text === '' || host === null) continue;
    if (getComputedStyle(host).visibility === 'hidden') continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    out.push({ node, text, x: r.left - at.left, y: r.top - at.top });
  }
  return out;
}

/** Where a text is now, in its frame; undefined once it is gone. */
function placeOf(p: Placed, frame: HTMLElement) {
  if (!p.node.isConnected || !frame.contains(p.node)) return undefined;
  const at = frame.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(p.node);
  const r = range.getBoundingClientRect();
  return { x: r.left - at.left, y: r.top - at.top };
}

interface Found {
  ok: boolean;
  worst: number;
  note: string;
}

/** The worst failure among several checks, or the first when all pass. */
function worstOf(found: Found[]): Found {
  const failed = found.filter((f) => !f.ok);
  return failed.reduce(
    (w, f) => (f.worst > w.worst ? f : w),
    failed[0] ?? found[0],
  );
}

const apart = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Each text drawn loading against the same text loaded: the nearest loaded
 *  text with the same content not already matched (or, failing that, the
 *  nearest that starts with it, where the loaded value joins it in one
 *  node). A text shown twice, as the box's chip and in a turn, is matched to
 *  the one in its own place. */
function textsMatch(loaded: HTMLElement, loading: HTMLElement) {
  const there = textsOf(loaded);
  const used = new Set<Placed>();
  let worst = 0;
  let note = '';
  for (const t of textsOf(loading)) {
    const nearest = (ok: (p: Placed) => boolean) =>
      there
        .filter((p) => !used.has(p) && ok(p))
        .reduce<Placed | undefined>(
          (best, p) => (best && apart(best, t) <= apart(p, t) ? best : p),
          undefined,
        );
    const twin =
      nearest((p) => p.text === t.text) ??
      nearest((p) => p.text.startsWith(t.text));
    if (twin === undefined)
      return {
        worst: Infinity,
        note: `"${t.text}" is drawn loading but not loaded`,
      };
    used.add(twin);
    const d = apart(t, twin);
    if (d > worst) {
      worst = d;
      note = `"${t.text}" moves ${d.toFixed(1)}px once loaded`;
    }
  }
  return { worst, note };
}

/** Catches a state whose render throws, so the board reports it and goes
 *  on instead of the whole page failing. */
class Caught extends Component<
  { onError: (message: string) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(e: Error) {
    this.props.onError(e.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Calls an example's render inside the boundary, so a render that throws is
 *  caught there and not in the case around it. */
function Draw({ render }: { render: () => ReactNode }) {
  return <>{render()}</>;
}

/** Waits for every animation in a frame to end, or a second at most. */
function settled(frame: HTMLElement) {
  const moving = frame.getAnimations({ subtree: true }).map((a) =>
    a.finished.then(
      () => undefined,
      () => undefined,
    ),
  );
  return Promise.race([
    Promise.all(moving),
    new Promise((ok) => setTimeout(ok, 1000)),
  ]);
}

const twoFrames = () =>
  new Promise((ok) =>
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ok(undefined);
      });
    }),
  );

/** One state: drawn loaded, drawn quiet, and drawn quiet then flipped to
 *  loaded in one tree. Measured once all have laid out and the fonts are in. */
function Case({
  unit,
  state,
  width,
  loaded,
  onDone,
}: {
  unit: string;
  state: string;
  width: number;
  loaded: () => ReactNode;
  onDone: (r: ProofResult) => void;
}) {
  const a = useRef<HTMLDivElement>(null);
  const b = useRef<HTMLDivElement>(null);
  const c = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  // Held, so a new callback from the parent does not measure again; and a
  // state reports once, whether it measured or failed.
  const sent = useRef(false);
  const latest = useRef(onDone);
  useEffect(() => {
    latest.current = onDone;
  });
  const report = useRef((r: ProofResult) => {
    if (sent.current) return;
    sent.current = true;
    latest.current(r);
  });
  /** What the first two checks found, and the flip tree's texts before it. */
  const before = useRef<{
    found: Found;
    texts: Placed[];
  }>(undefined);
  /** Where each text was in the first frame after the flip. */
  const first = useRef<({ x: number; y: number } | undefined)[]>([]);

  const finish = useRef(() => {
    const was = before.current;
    const frame = c.current;
    if (!was || !frame) return;
    const found = [was.found];
    was.texts.forEach((t, i) => {
      const end = placeOf(t, frame);
      const start = first.current[i];
      if (end === undefined || start === undefined) {
        found.push({
          ok: false,
          worst: Infinity,
          note: `"${t.text}" is drawn again at the flip, not kept`,
        });
        return;
      }
      const moved = apart(t, end);
      // It may slide to a new place; it may not be there in one frame.
      if (moved > TEXT_TOLERANCE && apart(start, end) <= TEXT_TOLERANCE)
        found.push({
          ok: false,
          worst: moved,
          note: `"${t.text}" jumps ${moved.toFixed(1)}px at the flip`,
        });
    });
    report.current({ unit, state, ...worstOf(found) });
  });

  useEffect(() => {
    let live = true;
    void document.fonts.ready.then(twoFrames).then(() => {
      if (!live || !a.current || !b.current || !c.current) return;
      const text = textsMatch(a.current, b.current);
      // A quiet form that draws what loaded draws is no quiet form.
      const found: Found =
        a.current.innerHTML === b.current.innerHTML
          ? {
              ok: false,
              worst: Infinity,
              note: 'no quiet form: it reads data but draws the same either way',
            }
          : { ok: text.worst <= TEXT_TOLERANCE, ...text };
      before.current = { found, texts: textsOf(c.current) };
      setFlipped(true);
    });
    return () => {
      live = false;
    };
  }, [unit, state]);

  // Before paint: where each text is in the first frame after the flip.
  useLayoutEffect(() => {
    const frame = c.current;
    const was = before.current;
    if (!flipped || !frame || !was) return;
    first.current = was.texts.map((t) => placeOf(t, frame));
    let live = true;
    void settled(frame)
      .then(twoFrames)
      .then(() => {
        if (live) finish.current();
      });
    return () => {
      live = false;
    };
  }, [flipped]);

  const broke = (message: string) => {
    report.current({
      unit,
      state,
      ok: false,
      worst: Infinity,
      note: `it failed to render: ${message}`,
    });
  };
  const forced = (on: boolean) => (
    <ForceLoading.Provider value={on}>
      <Draw render={loaded} />
    </ForceLoading.Provider>
  );
  return (
    <div className="flex items-start gap-6">
      <div ref={a} className="ds shrink-0" style={{ width }}>
        <Caught onError={broke}>
          <Draw render={loaded} />
        </Caught>
      </div>
      <div ref={b} className="ds shrink-0" style={{ width }}>
        <Caught onError={broke}>{forced(true)}</Caught>
      </div>
      <div ref={c} className="ds shrink-0" style={{ width }}>
        <Caught onError={broke}>{forced(!flipped)}</Caught>
      </div>
    </div>
  );
}

/** Every loadable state of one unit, and its stress render, one after
 *  another; reports each result. */
export function UnitProof({
  entry,
  onResult,
  onFinished,
}: {
  entry: Entry;
  onResult: (r: ProofResult) => void;
  onFinished: () => void;
}) {
  const { spec } = entry;
  const [ex, setEx] = useState<AnyExamples>();
  const [at, setAt] = useState(0);
  const [broken, setBroken] = useState<string>();
  useEffect(() => {
    entry.examples().then(setEx, (e: unknown) => {
      setBroken(e instanceof Error ? e.message : String(e));
    });
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
  const over =
    broken !== undefined || (ex !== undefined && current === undefined);
  const told = useRef(onResult);
  useEffect(() => {
    told.current = onResult;
  });
  useEffect(() => {
    if (broken !== undefined)
      told.current({
        unit: spec.id,
        state: 'examples',
        ok: false,
        worst: Infinity,
        note: `its examples failed to load: ${broken}`,
      });
  }, [broken, spec.id]);
  useEffect(() => {
    if (over) finished.current();
  }, [over]);
  if (!ex || !current) return null;

  const render = current.stress ? ex.stress : ex.states[current.id];
  return (
    <Case
      key={current.id}
      unit={spec.id}
      state={current.id}
      width={widthOf(spec)}
      loaded={render}
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
  const [results, setResults] = useState<ProofResult[]>([]);
  const [at, setAt] = useState(0);
  const entry = PROVEN.at(at);
  const done = entry === undefined;
  // "done" is marked only after the results are on window, in the same
  // step, so the script can never read a board that finished but has not
  // published.
  const board = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!done || !board.current) return;
    window.loadingProof = results;
    board.current.dataset.proof = 'done';
  }, [done, results]);

  const shown = [...results].sort(
    (p, q) => Number(p.ok) - Number(q.ok) || q.worst - p.worst,
  );
  const failing = results.filter((r) => !r.ok).length;
  return (
    <div className="space-y-6 p-6" ref={board} data-proof="running">
      <div>
        <h1 className="text-2xl font-semibold">Loading</h1>
        <p className="text-sm text-muted-foreground">
          {done
            ? `${String(results.length)} states, ${String(failing)} off. Every text in a quiet form must stay in place once loaded, to ${String(TEXT_TOLERANCE)}px, and survive the flip without a jump.`
            : `Proving ${entry.spec.id}…`}
        </p>
      </div>
      <table className="text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="pr-6 font-medium">Unit</th>
            <th className="pr-6 font-medium">State</th>
            <th className="pr-6 font-medium">Result</th>
            <th className="font-medium">First difference</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={`${r.unit}:${r.state}`}>
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
