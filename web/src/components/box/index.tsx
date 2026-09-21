import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'

type Tone = 'default' | 'warning' | 'destructive'

const tones: Record<Tone, string> = {
  default: 'border-border bg-card',
  warning: 'border-warning bg-warning-soft',
  destructive: 'border-destructive bg-destructive-soft',
}

/**
 * The one container: a bordered card surface with an optional header band,
 * rows or a body, and an optional footer.
 *
 * A Box never sets its own margin (the parent's stack does) and its
 * children are Box parts only. A Box that carries a state takes the status
 * ink as its frame and the status tint as its ground.
 */
export function Box({
  tone = 'default',
  className,
  ...props
}: ComponentProps<'div'> & { tone?: Tone }) {
  return (
    <div className={cn('overflow-hidden rounded-md border', tones[tone], className)} {...props} />
  )
}

export function BoxHeader({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex min-h-row items-center justify-between gap-3 border-b bg-card-header px-card py-2 text-base font-semibold',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function BoxBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-card text-base', className)} {...props} />
}

export function BoxFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex min-h-row items-center justify-between gap-3 border-t bg-card-header px-card py-2 text-xs text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

/**
 * A row is ActionList-shaped: a leading visual, a title with an optional
 * description, and something trailing. The row owns its padding, so a
 * caller never pads one by hand.
 */
export function BoxRow({
  leading,
  title,
  description,
  trailing,
  href,
  onClick,
  selected,
  className,
}: {
  leading?: ReactNode
  title: ReactNode
  description?: ReactNode
  trailing?: ReactNode
  href?: string
  /** Makes the whole row a button: same hover wash as a linked row. */
  onClick?: () => void
  selected?: boolean
  className?: string
}) {
  const content = (
    <>
      {leading && (
        <span className="flex shrink-0 items-center text-muted-foreground [&_svg]:size-4">
          {leading}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{title}</span>
        {description && (
          <span className="block truncate text-xs text-muted-foreground">{description}</span>
        )}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </>
  )

  const classes = cn(
    'flex min-h-row items-center gap-3 border-t border-border-muted px-card py-2 text-sm first:border-t-0',
    selected && 'bg-primary-soft text-primary',
    // Half-strength muted: a hover wash only signals, it doesn't have to
    // carry shape, and full muted (1.43:1 on card) reads as selection.
    (href || onClick) &&
      'cursor-pointer transition-colors duration-150 ease-out hover:bg-muted/50 motion-reduce:transition-none',
    className,
  )

  if (href) {
    return (
      <Link to={href} className={classes} aria-current={selected ? 'page' : undefined}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(classes, 'w-full text-left')}>
        {content}
      </button>
    )
  }
  return <div className={classes}>{content}</div>
}

/**
 * The count beside a title. Sits at the type floor, not below it.
 *
 * The fill is translucent ink rather than `muted`: muted is 1.07:1 against
 * the header band it usually sits on (1.06–1.16:1 against every surface in
 * the palette), so the pill simply wasn't visible. Ink at 20% darkens
 * whatever ground it lands on (1.50:1 light, 1.74:1 dark) and inverts
 * with the theme for free.
 */
export function Counter({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground/20 px-1 font-sans text-xs font-medium tabular-nums',
        className,
      )}
      {...props}
    />
  )
}

/** A trailing value: mono, at the floor size, figures aligned. */
export function RowValue({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn('font-mono text-xs text-muted-foreground tabular-nums', className)}
      {...props}
    />
  )
}
