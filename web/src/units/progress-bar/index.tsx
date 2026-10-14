/** Above this many problems the bar is one continuous bar (progress-bar-d1). */
export const SEGMENT_MAX = 12;

/** How far a set is done: a segment per problem and the count in words
 *  beside it. The count never shrinks; the bar does (progress-bar-d1). */
export function ProgressBar({ done, total }: { done: number; total: number }) {
  const shown = Math.min(Math.max(done, 0), Math.max(total, 0));
  const complete = total > 0 && shown === total;
  const fill = complete ? 'bg-(--ds-fg-muted)' : 'bg-(--ds-accent)';
  const segmented = total <= SEGMENT_MAX;
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-2">
      {segmented ? (
        <span className="flex min-w-0 shrink gap-0.5" data-bar="segments">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              data-segment={i < shown ? 'done' : 'todo'}
              className={`h-1 w-3 min-w-0 shrink rounded-[2px] ${i < shown ? fill : 'bg-(--ds-border)'}`}
            />
          ))}
        </span>
      ) : (
        <span
          data-bar="continuous"
          className="h-1 w-[72px] min-w-0 shrink overflow-hidden rounded-[2px] bg-(--ds-border)"
        >
          <span
            className={`block h-full ${fill}`}
            style={{ width: `${String((shown / total) * 100)}%` }}
          />
        </span>
      )}
      <span className="ds-small ds-tabular shrink-0 whitespace-nowrap text-(--ds-fg-muted)">
        {shown} of {total}
      </span>
    </span>
  );
}
