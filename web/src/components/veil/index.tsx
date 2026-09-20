import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Frosted glass over content that exists but shouldn't be read yet — a
 * hint before it's wanted, a solution before the attempt. The content is
 * real and laid out at its true size; the veil is a backdrop blur with an
 * invitation, and one click lifts it for good.
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
  if (revealed) return <>{children}</>
  return (
    <button
      type="button"
      onClick={onReveal}
      aria-label={label}
      className={cn('relative block w-full cursor-pointer overflow-hidden rounded-md text-left', className)}
    >
      <div aria-hidden inert className="select-none">
        {children}
      </div>
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center rounded-md border border-border-muted bg-card/40 backdrop-blur-md transition-colors duration-150 ease-out hover:bg-card/60 motion-reduce:transition-none"
      >
        <span className="text-xs text-muted-foreground">{label}</span>
      </span>
    </button>
  )
}
