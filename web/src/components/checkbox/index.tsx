import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * A labelled checkbox, for a state that must be as easy to take back as
 * to claim — a question marked Complete, a question that came from this
 * book. It is a checkbox and not a switch precisely because it reads as a
 * fact recorded rather than a mode entered.
 *
 * The whole thing is the target: the box, the label and the space between.
 */
export function Checkbox({
  checked,
  onChange,
  disabled,
  className,
  children,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'flex h-control-sm cursor-pointer items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors duration-150 ease-out hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-4 shrink-0 place-items-center rounded-sm border transition-colors duration-150 ease-out motion-reduce:transition-none',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card',
        )}
      >
        {checked && <Check className="size-3" />}
      </span>
      {children}
    </button>
  )
}
