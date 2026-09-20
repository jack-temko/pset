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
      className={cn(
        'group/veil relative block w-full cursor-pointer overflow-hidden rounded-md text-left',
        className,
      )}
    >
      <div aria-hidden inert className="select-none">
        {children}
      </div>
      {/* The blur covers everything and is never masked — a gap in it
          would hand back the words. The tint is what fades, so the veil
          has no hard rectangle edge against the panel. */}
      <span aria-hidden className="absolute inset-0 rounded-md backdrop-blur-[5px]" />
      <span
        aria-hidden
        className="absolute inset-0 rounded-md bg-card/45 transition-opacity duration-150 ease-out group-hover/veil:opacity-75 motion-reduce:transition-none"
        style={{
          maskImage: 'radial-gradient(115% 115% at 50% 50%, #000 25%, transparent 88%)',
        }}
      />
      <span aria-hidden className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">{label}</span>
      </span>
    </button>
  )
}
