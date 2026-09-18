import type { CoverHue } from '@/lib/covers'
import { coverColors } from '@/lib/covers'
import { cn } from '@/lib/utils'

/**
 * A CSS book cover: deep cloth gradient with a spine, a paper page edge on
 * the right, and the title set inside a hairline plate — the way clothbound
 * textbooks frame their title pages.
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
  const h = coverColors(hue)
  return (
    <div
      className={cn(
        'relative aspect-3/4 w-full overflow-hidden rounded-lg border border-black/15 shadow-sm',
        className,
      )}
      style={{ background: `linear-gradient(160deg, ${h.from}, ${h.to})` }}
    >
      {/* spine and its highlight groove */}
      <div className="absolute inset-y-0 left-0 w-2" style={{ background: h.spine }} />
      <div className="absolute inset-y-0 left-2 w-px bg-white/20" />
      {/* soft light from the top-left, like a cloth cover under a desk lamp */}
      <div className="absolute inset-0 bg-[radial-gradient(130%_90%_at_18%_6%,rgba(255,255,255,0.13),transparent_55%)]" />
      {/* paper page edge */}
      <div
        aria-hidden
        className="absolute inset-y-2 right-[3px] w-[4px] rounded-full bg-white/20"
      />
      {/* title plate */}
      <div className="absolute inset-2 left-[0.8rem] flex flex-col rounded-md border border-white/15 p-3 sm:p-3">
        <div className="line-clamp-1 text-[0.5rem] font-medium tracking-[0.14em] text-white/75 uppercase sm:text-[0.625rem]">
          {author}
        </div>
        <div className="mt-2 line-clamp-3 font-heading text-sm leading-snug font-medium text-pretty text-[oklch(0.98_0.005_95)] sm:text-base">
          {title}
        </div>
        <div className="mt-auto">
          <div className="mb-2 h-px w-8 bg-white/30" />
          <div className="text-[0.5rem] tracking-[0.22em] text-white/55 uppercase sm:text-[0.625rem]">
            PSet
          </div>
        </div>
      </div>
    </div>
  )
}
