const PAD = 4;

/** The last days as a line with a soft area under it, filling its width and
 *  44 tall unless told, the last day marked with a dot. Drawn only: the figure it
 *  belongs to is written beside it. */
export function Sparkline({
  values,
  height = 44,
}: {
  values: readonly number[];
  /** How tall it is, in px. */
  height?: number;
}) {
  const H = height;
  const n = values.length;
  const max = Math.max(1, ...values);
  const x = (i: number) => 3 + (n > 1 ? (i / (n - 1)) * 94 : 47);
  const y = (v: number) => PAD + (1 - v / max) * (H - 2 * PAD);
  const points = values.map((v, i) => `${String(x(i))},${String(y(v))}`);
  const line = `M${points.join(' L')}`;
  const area =
    n > 0
      ? `${line} L${String(x(n - 1))},${String(H)} L${String(x(0))},${String(H)} Z`
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
        <path d={area} fill="var(--ds-accent)" fillOpacity={0.14} />
        <path
          d={line}
          fill="none"
          stroke="var(--ds-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {n > 0 && (
        <span
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--ds-accent)"
          style={{ left: `${String(x(n - 1))}%`, top: y(values[n - 1]) }}
        />
      )}
    </span>
  );
}
