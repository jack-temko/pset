import { Fragment, type ReactNode } from 'react';

import { Runs } from '@/units/problem/math';
import type { Run } from '@/units/problem/types';
import type { Block, Inline, PageRef, Series } from './types';

/** A page chip: "p. 142", pressed to open the material at that page
 *  (ask-d9). Quiet, but plainly something to press. */
export function PageChip({
  to,
  onPage,
}: {
  to: PageRef;
  onPage?: (material: string, page: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPage?.(to.material, to.page)}
      className="ds-label ds-tabular mx-px inline-flex h-5 cursor-pointer items-center rounded-(--ds-radius-tag) border border-(--ds-border) px-2 align-middle whitespace-nowrap text-(--ds-accent) hover:bg-(--ds-hover) active:bg-(--ds-pressed)"
    >
      p. {to.page}
    </button>
  );
}

type OnPage = (material: string, page: number) => void;

function Inlines({
  runs,
  onPage,
}: {
  runs: readonly Inline[];
  onPage?: OnPage;
}) {
  const out: ReactNode[] = [];
  let run: Run[] = [];
  const flush = () => {
    if (run.length === 0) return;
    out.push(<Runs key={out.length} runs={run} />);
    run = [];
  };
  for (const r of runs) {
    if ('ref' in r) {
      flush();
      out.push(<PageChip key={out.length} to={r.ref} onPage={onPage} />);
    } else run.push(r);
  }
  flush();
  return <>{out}</>;
}

const COLOURS = ['var(--ds-accent)', 'var(--ds-attention)'];

/** One or two functions on shared axes, each in its own colour, named in the
 *  legend rather than on the lines. */
function Plot({ title, series }: { title: string; series: readonly Series[] }) {
  const W = 480;
  const H = 200;
  const pad = 28;
  const all = series.flatMap((s) => s.points);
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(0, ...ys), Math.max(...ys)];
  const sx = (x: number) => pad + ((x - x0) / (x1 - x0 || 1)) * (W - pad - 8);
  const sy = (y: number) =>
    H - pad - ((y - y0) / (y1 - y0 || 1)) * (H - pad - 8);
  return (
    <figure className="m-0 max-w-[680px]">
      <figcaption className="ds-label mb-2 text-(--ds-fg-muted)">
        {title}
      </figcaption>
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className="block h-auto w-full rounded-(--ds-radius-control) border border-(--ds-border-muted) bg-(--ds-bg-raised)"
        role="img"
        aria-label={title}
      >
        <path
          d={`M${String(pad)} 8V${String(H - pad)}H${String(W - 8)}`}
          fill="none"
          stroke="var(--ds-border)"
        />
        {series.map((s, i) => (
          <polyline
            key={s.name}
            fill="none"
            stroke={COLOURS[i % COLOURS.length]}
            strokeWidth={2}
            strokeDasharray={i > 0 ? '6 4' : undefined}
            points={s.points
              .map(([x, y]) => `${String(sx(x))},${String(sy(y))}`)
              .join(' ')}
          />
        ))}
        <text x={pad} y={H - 8} fontSize={11} fill="var(--ds-fg-muted)">
          {String(x0)}
        </text>
        <text
          x={W - 8}
          y={H - 8}
          fontSize={11}
          textAnchor="end"
          fill="var(--ds-fg-muted)"
        >
          {String(x1)}
        </text>
        <text x={4} y={sy(y1) + 4} fontSize={11} fill="var(--ds-fg-muted)">
          {String(y1)}
        </text>
      </svg>
      <p className="ds-small mt-2 flex flex-wrap gap-x-4 text-(--ds-fg-muted)">
        {series.map((s, i) => (
          <span key={s.name} className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-[2px] w-4"
              style={{ background: COLOURS[i % COLOURS.length] }}
            />
            {s.name}
          </span>
        ))}
      </p>
    </figure>
  );
}

/** Text and its kin stop at about 680 wide; a plot, a table and code may
 *  use the whole pane (ask-d10). */
const MEASURE = 'max-w-[680px]';

/** One block of an answer. */
export function BlockView({
  block,
  onPage,
}: {
  block: Block;
  onPage?: OnPage;
}) {
  switch (block.k) {
    case 'p':
      return (
        <p className={`ds-reading ${MEASURE}`}>
          <Inlines runs={block.runs} onPage={onPage} />
        </p>
      );
    case 'math':
      return (
        <div className={`ds-reading ${MEASURE}`}>
          <Runs runs={[{ m: block.tex, d: true }]} />
        </div>
      );
    case 'statement':
      return (
        <div
          className={`${MEASURE} overflow-hidden rounded-(--ds-radius-control) border border-(--ds-border-muted)`}
        >
          <div className="flex min-h-8 items-center justify-between gap-3 bg-(--ds-neutral-soft) px-3">
            <span className="ds-label text-(--ds-fg)">{block.name}</span>
            {block.ref && <PageChip to={block.ref} onPage={onPage} />}
          </div>
          <p className="ds-reading px-3 py-2">
            <Inlines runs={block.runs} onPage={onPage} />
          </p>
        </div>
      );
    case 'steps':
      return (
        <ol className={`${MEASURE} space-y-3`}>
          {block.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="ds-label ds-tabular w-4 shrink-0 pt-1 text-(--ds-fg-muted)">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="ds-reading overflow-x-auto">
                  <Runs runs={[{ m: s.tex }]} />
                </div>
                {s.why && (
                  <p className="ds-small text-(--ds-fg-muted)">{s.why}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      );
    case 'plot':
      return <Plot title={block.title} series={block.series} />;
    case 'table':
      return (
        <div className="overflow-x-auto rounded-(--ds-radius-control) border border-(--ds-border-muted)">
          <table className="ds-small w-full border-collapse text-left">
            <thead>
              <tr className="bg-(--ds-neutral-soft)">
                {block.head.map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, i) => (
                <tr key={i} className="border-t border-(--ds-border-muted)">
                  {r.map((c, j) => (
                    <td key={j} className="ds-tabular px-3 py-2">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'code':
      return (
        <pre className="ds-code overflow-x-auto rounded-(--ds-radius-control) bg-(--ds-bg-inset) p-3 text-(--ds-fg)">
          {block.code}
        </pre>
      );
    case 'callout':
      return (
        <div
          className={`${MEASURE} rounded-r-(--ds-radius-control) border-l-2 border-(--ds-success) bg-(--ds-success-soft) px-3 py-2`}
        >
          <p className="ds-body">
            <strong className="ds-label mr-2 text-(--ds-success)">Check</strong>
            <Inlines runs={block.runs} onPage={onPage} />
          </p>
        </div>
      );
  }
}

export function Document({
  blocks,
  onPage,
}: {
  blocks: readonly Block[];
  onPage?: OnPage;
}) {
  return (
    <>
      {blocks.map((b, i) => (
        <Fragment key={i}>
          <BlockView block={b} onPage={onPage} />
        </Fragment>
      ))}
    </>
  );
}
