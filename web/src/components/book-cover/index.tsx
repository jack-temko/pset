import type { CSSProperties } from 'react'

import { COVERS, type CoverHue } from '@/lib/covers'
import { cn } from '@/lib/utils'

/**
 * A book, drawn in CSS. There is no cover art anywhere in the product:
 * every book is a clothbound board in one of six hues. Every picture of a
 * book (this, the swatch, a bar in a chart) draws `book.cover`, so they
 * always agree.
 *
 * The board is sized by its container: it holds a 3:4 ratio and the plate
 * type is fixed, so it belongs at a shelf tile's 160–200px. Don't scale it
 * far past that.
 */
export function BookCover({
  title,
  author,
  hue,
  className,
}: {
  title: string
  author: string
  hue: CoverHue
  className?: string
}) {
  const cloth = {
    background: `linear-gradient(160deg, var(--cover-${hue}), var(--cover-${hue}-to))`,
  } satisfies CSSProperties

  return (
    <div
      className={cn(
        'relative aspect-3/4 w-full overflow-hidden rounded-md border border-black/15 shadow-[0_1px_2px_rgb(0_0_0/0.12)]',
        className,
      )}
      style={cloth}
    >
      {/* The spine, and the groove of light down its edge. */}
      <div
        className="absolute inset-y-0 left-0 w-2"
        style={{ background: `var(--cover-${hue}-spine)` }}
      />
      <div className="absolute inset-y-0 left-2 w-px bg-white/20" />
      {/* A desk lamp falling on cloth. */}
      <div className="absolute inset-0 bg-[radial-gradient(130%_90%_at_18%_6%,rgb(255_255_255/0.13),transparent_55%)]" />
      {/* The paper edge of the pages. */}
      <div aria-hidden className="absolute inset-y-2 right-[3px] w-1 rounded-full bg-white/20" />

      <div className="absolute inset-2 left-3 flex flex-col rounded-sm border border-white/15 p-3">
        <div className="truncate text-xs tracking-[0.1em] text-white/75 uppercase">{author}</div>
        <div className="mt-2 line-clamp-3 font-heading text-base leading-snug font-medium text-[oklch(0.98_0.005_95)]">
          {title}
        </div>
        <div className="mt-auto">
          <div className="mb-2 h-px w-8 bg-white/30" />
          <div className="text-xs tracking-[0.22em] text-white/55 uppercase">PSet</div>
        </div>
      </div>
    </div>
  )
}

/**
 * The same cloth at row size: a 32×40 board with no type on it. Where a
 * book is named beside it (an import row, a list), the plate would only
 * repeat the title at an unreadable size: the colour is what identifies.
 */
export function CoverSwatch({ hue, className }: { hue: CoverHue; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block h-10 w-8 shrink-0 rounded-sm border border-black/15', className)}
      style={{ background: `linear-gradient(160deg, var(--cover-${hue}), var(--cover-${hue}-to))` }}
    />
  )
}

/**
 * Choosing a book's colour: the six swatches as a radiogroup, the chosen
 * one ringed. Only the six exist; there's no custom colour.
 */
export function CoverPicker({ value, onChange }: { value: CoverHue; onChange: (hue: CoverHue) => void }) {
  return (
    <div role="radiogroup" aria-label="Cover colour" className="flex gap-2">
      {COVERS.map((hue) => (
        <button
          key={hue}
          type="button"
          role="radio"
          aria-checked={hue === value}
          aria-label={hue}
          onClick={() => onChange(hue)}
          className={cn(
            'cursor-pointer rounded-sm transition-shadow duration-150 ease-out motion-reduce:transition-none',
            hue === value ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-border',
          )}
        >
          <CoverSwatch hue={hue} />
        </button>
      ))}
    </div>
  )
}
