/** How far a set is done: one continuous bar and the count in words beside
 *  it. The count always shows; the bar fills the room the count leaves,
 *  from a 16px floor, and adapts to its own width, so nothing outside
 *  reaches into it (progress-bar-d2, d3, d5). */
export function ProgressBar({ done, total }: { done: number; total: number }) {
  const shown = Math.min(Math.max(done, 0), Math.max(total, 0));
  const complete = total > 0 && shown === total;
  const fill = complete ? 'bg-(--ds-fg-muted)' : 'bg-(--ds-accent)';
  return (
    <span className="flex w-full max-w-full min-w-0 items-center gap-2">
      <span
        data-bar="continuous"
        className="h-1 min-w-4 flex-1 overflow-hidden rounded-(--ds-radius-segment) bg-(--ds-border)"
      >
        <span
          className={`block h-full ${fill}`}
          style={{
            width: `${String(total > 0 ? (shown / total) * 100 : 0)}%`,
          }}
        />
      </span>
      <span className="ds-body ds-tabular shrink-0 whitespace-nowrap text-(--ds-fg-muted)">
        {shown} of {total}
      </span>
    </span>
  );
}
