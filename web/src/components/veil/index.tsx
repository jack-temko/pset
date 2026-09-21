import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Content that exists but shouldn't be read yet: a hint before it's
 * wanted, a worked solution before the attempt.
 *
 * The content is always there and always laid out at its true size: it
 * is simply blurred and faded back, so its shape reads (how long the
 * answer is, whether it has a display equation) while its words don't.
 * Hovering eases it a little closer, and revealing lets it resolve
 * rather than snap.
 */
export function Veil({
  label = 'Click to reveal',
  revealed,
  onReveal,
  className,
  children,
}: {
  label?: string
  revealed: boolean
  onReveal: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('group/veil relative', className)}>
      <div
        aria-hidden={!revealed}
        inert={!revealed}
        className={cn(
          'transition-[opacity,filter] duration-150 ease-out motion-reduce:transition-none',
          !revealed &&
            'opacity-45 blur-[6px] select-none group-hover/veil:opacity-60 group-hover/veil:blur-[4px]',
        )}
      >
        {children}
      </div>

      {!revealed && (
        <button
          type="button"
          onClick={onReveal}
          aria-label={label}
          className="absolute inset-0 flex cursor-pointer items-center justify-center"
        >
          <span className="flex h-control-sm items-center rounded-md border bg-card px-3 text-xs text-muted-foreground shadow-floating transition-colors duration-150 ease-out group-hover/veil:text-foreground motion-reduce:transition-none">
            {label}
          </span>
        </button>
      )}
    </div>
  )
}
