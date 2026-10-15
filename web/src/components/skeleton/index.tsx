import { cn } from '@/lib/utils';

/**
 * The shape of content that hasn't arrived yet, at the size it will be,
 * so nothing moves when it does: a `muted` block with a soft shimmer
 * sweeping across it.
 *
 * The shimmer is one of the system's two loops (the Spinner is the
 * other), and it means exactly what they both mean: waiting. The
 * `skeleton` utility in index.css draws it; reduced motion leaves it
 * still.
 *
 * Inline by default, so a text-sized skeleton sits inside a line box and
 * the row keeps its real line height. Pass `block` sizes for figures.
 */
export function Skeleton({
  className,
  still,
  style,
}: {
  className?: string;
  still?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      data-skeleton=""
      className={cn('skeleton inline-block rounded-sm align-middle', className)}
      // Still: the space is held, but nothing is on its way yet (a queued
      // question), so it doesn't borrow the shimmer's "waiting" meaning.
      style={
        still ? { ...style, animation: 'none', backgroundImage: 'none' } : style
      }
    />
  );
}
