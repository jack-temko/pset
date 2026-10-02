import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/** The one control for every action. Focus is the shell's global
 *  `:focus-visible` ring, so no variant carries its own. */
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent font-medium whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_8%)]',
        outline: 'border-input bg-card text-foreground hover:bg-muted',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]',
        ghost: 'text-foreground hover:bg-muted',
        destructive:
          'bg-destructive-soft text-destructive hover:bg-[color-mix(in_oklch,var(--destructive-soft),var(--destructive)_8%)]',
      },
      size: {
        sm: 'h-control-sm px-2 text-xs',
        default: 'h-control px-3 text-sm',
        lg: 'h-control-lg px-4 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

export function Button({
  className,
  variant,
  size,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

/** A square of the same height. The label is not optional: it is the only
 *  name the control has. */
export function IconButton({
  className,
  variant,
  size = 'default',
  'aria-label': ariaLabel,
  ...props
}: ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { 'aria-label': string }) {
  const square = { sm: 'w-control-sm', default: 'w-control', lg: 'w-control-lg' }[size ?? 'default']
  return (
    <button
      aria-label={ariaLabel}
      className={cn(buttonVariants({ variant, size }), 'px-0', square, className)}
      {...props}
    />
  )
}

export { buttonVariants }
