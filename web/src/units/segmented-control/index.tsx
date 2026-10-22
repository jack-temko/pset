export interface Segment {
  id: string;
  label: string;
}

/** One choice of a few, all in view, applied at once (segmented-control-d1).
 *  The chosen segment is filled; the others are plain. */
export function SegmentedControl({
  label,
  options,
  value,
  onChange,
}: {
  /** The control's name. */
  label: string;
  options: readonly Segment[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex h-(--ds-control) rounded-(--ds-radius-control) border border-(--ds-border) p-0.5"
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              onChange(o.id);
            }}
            className={`ds-body h-full min-w-16 font-medium rounded-(--ds-radius-segment) px-3 whitespace-nowrap ${on ? 'bg-(--ds-pressed) text-(--ds-fg)' : 'text-(--ds-fg-muted) hover:bg-(--ds-hover) hover:text-(--ds-fg)'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
