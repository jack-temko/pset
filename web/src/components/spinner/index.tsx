import { cn } from '@/lib/utils'

/**
 * The system's one looping animation, and the only thing allowed to loop:
 * a repeating motion means "waiting", so nothing that isn't waiting may
 * borrow it.
 *
 * It appears where work is genuinely running and genuinely cannot be
 * counted: examining a PDF, building a search index. Work that *can* be
 * counted gets a determinate bar instead, because a number a student can
 * watch is worth more than a shape that turns.
 */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label ?? 'Working'}
      className={cn(
        'inline-block size-4 shrink-0 rounded-full border-2 border-current border-t-transparent',
        'animate-spin motion-reduce:animate-none',
        className,
      )}
    />
  )
}
