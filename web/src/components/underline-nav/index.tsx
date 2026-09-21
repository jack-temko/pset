import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Primer's tab row: quiet labels with a 2px primary underline on the
 * current one. The nav draws no border of its own: it sits on whatever
 * hairline its container already has, so the underline lands on it.
 */
export function UnderlineNav({ className, ...props }: ComponentProps<'nav'>) {
  return <nav className={cn('flex items-center gap-4', className)} {...props} />
}

export function UnderlineTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'relative flex h-row items-center text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground motion-reduce:transition-none',
        active && 'font-medium text-foreground',
      )}
    >
      {children}
      {active && <span aria-hidden className="absolute inset-x-0 bottom-0 border-b-2 border-primary" />}
    </button>
  )
}
