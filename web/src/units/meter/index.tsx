/** A thin bar for a share of a whole, with no number: the figure is written
 *  beside it (meter-d1). It fills its container's width. */
export function Meter({ value, max }: { value: number; max: number }) {
  const share = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  return (
    <span
      data-meter
      className="block h-1 w-full overflow-hidden rounded-(--ds-radius-segment) bg-(--ds-border)"
    >
      <span
        className="block h-full bg-(--ds-accent)"
        style={{ width: `${String(share * 100)}%` }}
      />
    </span>
  );
}
