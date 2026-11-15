import { useLayoutEffect, useRef } from 'react';

import { ARRIVE_MS, moves } from '@/units/bone/rhythm';

const PAD = 4;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/** The last days as a line with a soft area under it, filling its width and
 *  44 tall unless told, the last day marked with a dot. Drawn only: the figure it
 *  belongs to is written beside it. */
export function Sparkline({
  values = [],
  height = 44,
  loading,
}: {
  values?: readonly number[];
  /** How tall it is, in px. */
  height?: number;
  /** While the days load: a flat, quiet line along the bottom, no dot, at the
   *  same height (sparkline-d2). */
  loading?: boolean;
}) {
  const H = height;
  const line = useRef<SVGGElement>(null);
  const dot = useRef<HTMLSpanElement>(null);
  const drawn = loading !== true && values.length > 0;
  // When the days come, the line rises from the flat loading line into its
  // shape and the dot rides up with it (sparkline-d3).
  useLayoutEffect(() => {
    const g = line.current;
    if (!drawn || g === null || !moves(g)) return;
    g.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], {
      duration: ARRIVE_MS,
      easing: EASE,
    });
    const d = dot.current;
    if (d !== null)
      d.animate([{ top: `${String(H - PAD)}px` }, { top: d.style.top }], {
        duration: ARRIVE_MS,
        easing: EASE,
      });
  }, [drawn, H]);
  if (loading === true)
    return (
      <span
        data-sparkline
        className="relative block w-full"
        style={{ height: H }}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 h-[2px] rounded-full bg-(--ds-bone)"
          style={{ top: H - PAD - 1 }}
        />
      </span>
    );
  const n = values.length;
  const max = Math.max(1, ...values);
  const x = (i: number) => 3 + (n > 1 ? (i / (n - 1)) * 94 : 47);
  const y = (v: number) => PAD + (1 - v / max) * (H - 2 * PAD);
  const points = values.map((v, i) => `${String(x(i))},${String(y(v))}`);
  const path = `M${points.join(' L')}`;
  const area =
    n > 0
      ? `${path} L${String(x(n - 1))},${String(H)} L${String(x(0))},${String(H)} Z`
      : '';
  return (
    <span
      data-sparkline
      className="relative block w-full"
      style={{ height: H }}
    >
      <svg
        viewBox={`0 0 100 ${String(H)}`}
        preserveAspectRatio="none"
        className="block h-full w-full overflow-visible"
      >
        <g
          ref={line}
          style={{
            transformBox: 'view-box',
            transformOrigin: `0 ${String(H - PAD)}px`,
          }}
        >
          <path d={area} fill="var(--ds-accent)" fillOpacity={0.14} />
          <path
            d={path}
            fill="none"
            stroke="var(--ds-accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
      {n > 0 && (
        <span
          ref={dot}
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--ds-accent)"
          style={{ left: `${String(x(n - 1))}%`, top: y(values[n - 1]) }}
        />
      )}
    </span>
  );
}
