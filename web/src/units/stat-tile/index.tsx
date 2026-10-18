/** One figure of the week: a label, the figure big, and an optional muted line
 *  under it ("Last week: 2 h 40 m"). The figure is set in the font of the text
 *  it belongs to (figures-follow-text), the heading step. */
export function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  /** The figure, written as it reads: "2 h 40 m", "14". */
  value: string;
  /** A muted line under the figure. */
  note?: string;
}) {
  return (
    <div className="min-w-0 rounded-(--ds-radius-panel) border border-(--ds-border-muted) bg-(--ds-bg-raised) px-4 py-3">
      <p className="ds-small truncate text-(--ds-fg-muted)">{label}</p>
      <p className="ds-heading ds-tabular text-(--ds-fg) [overflow-wrap:anywhere]">
        {value}
      </p>
      <p className="ds-small ds-tabular min-h-5 text-(--ds-fg-muted) [overflow-wrap:anywhere]">
        {note}
      </p>
    </div>
  );
}

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) ${className}`}
    />
  );
}

/** The tile while its figure loads: the same three lines. A tile with no note
 *  still keeps the line, so the two tiles are as tall as each other. */
export function StatTileSkeleton() {
  return (
    <div className="min-w-0 rounded-(--ds-radius-panel) border border-(--ds-border-muted) bg-(--ds-bg-raised) px-4 py-3">
      <p className="ds-small flex h-(--ds-small-line) items-center">
        <Bar className="h-3 w-1/3" />
      </p>
      <p className="ds-heading flex h-(--ds-heading-line) items-center">
        <Bar className="h-5 w-1/2" />
      </p>
      <p className="ds-small flex h-(--ds-small-line) items-center">
        <Bar className="h-3 w-2/3" />
      </p>
    </div>
  );
}
