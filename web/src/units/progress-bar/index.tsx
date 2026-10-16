/** How far a set is done: one continuous bar and the count in words beside
 *  it. The count always shows, right-aligned in a box as wide as "99 of 99"
 *  (progress-bar-d6); the bar fills the room the count leaves, from a 16px floor, and adapts to its own width, so nothing outside
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
      <span className="ds-body ds-tabular flex shrink-0 flex-col items-end whitespace-nowrap text-(--ds-fg-muted) before:invisible before:block before:h-0 before:content-['99_of_99']">
        {shown} of {total}
      </span>
    </span>
  );
}
