import type { ReactNode } from 'react'
import { CircleAlert, X } from 'lucide-react'

import { IconButton } from '@/components/button'
import { cn } from '@/lib/utils'

/**
 * A full-width strip under the top bar: one sentence about the whole
 * screen, and at most one thing to do about it. `warning` is status ink
 * on its tint; `default` is the header band's quiet ground.
 */
export function Flash({
  tone = 'default',
  action,
  onDismiss,
  children,
}: {
  tone?: 'default' | 'warning'
  /** The one act the sentence asks for, as an `sm` Button. */
  action?: ReactNode
  /** Adds a ghost X; the caller remembers the dismissal. */
  onDismiss?: () => void
  children: ReactNode
}) {
  return (
    <div
      role={tone === 'warning' ? 'status' : undefined}
      className={cn(
        'flex min-h-row shrink-0 items-center justify-center gap-3 border-b px-4 text-sm',
        tone === 'warning' ? 'border-warning bg-warning-soft text-warning' : 'bg-card-header text-muted-foreground',
      )}
    >
      {tone === 'warning' && <CircleAlert className="size-4 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
      {action}
      {onDismiss && (
        <IconButton variant="ghost" size="sm" aria-label="Dismiss" onClick={onDismiss}>
          <X />
        </IconButton>
      )}
    </div>
  )
}
