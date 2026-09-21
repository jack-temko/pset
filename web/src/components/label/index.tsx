import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * The small pill that names a kind or a state in a word or two.
 *
 * Outlined by default: the border and the text share one ink, so a Label
 * reads as a quiet outline rather than a block of colour. `filled` adds
 * the status tint as ground, for the one state in a list that must jump
 * out.
 *
 * A status Label always carries a word (colour alone never means
 * anything) and an icon where the row is scanned rather than read.
 */
const labelVariants = cva(
  'inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        default: 'border-border text-muted-foreground',
        primary: 'border-primary text-primary',
        success: 'border-success text-success',
        warning: 'border-warning text-warning',
        danger: 'border-destructive text-destructive',
      },
      filled: { true: 'border-transparent', false: '' },
    },
    compoundVariants: [
      { tone: 'default', filled: true, class: 'bg-muted' },
      { tone: 'primary', filled: true, class: 'bg-primary-soft' },
      { tone: 'success', filled: true, class: 'bg-success-soft' },
      { tone: 'warning', filled: true, class: 'bg-warning-soft' },
      { tone: 'danger', filled: true, class: 'bg-destructive-soft' },
    ],
    defaultVariants: { tone: 'default', filled: false },
  },
)

export function Label({
  tone,
  filled,
  className,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof labelVariants>) {
  return <span className={cn(labelVariants({ tone, filled }), className)} {...props} />
}

export { labelVariants }
