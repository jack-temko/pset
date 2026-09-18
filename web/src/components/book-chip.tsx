import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { coverColors, coverHueFromSha, type CoverHue } from '@/lib/covers'
import type { Book } from '@/lib/types'
import { cn } from '@/lib/utils'

export function CoverDot({ hue, className }: { hue: CoverHue; className?: string }) {
  const c = coverColors(hue)
  return (
    <span
      aria-hidden
      className={cn('shrink-0 rounded-full', className)}
      style={{ backgroundImage: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
    />
  )
}

export function MiniCover({ hue, className }: { hue: CoverHue; className?: string }) {
  const c = coverColors(hue)
  return (
    <span
      aria-hidden
      className={cn(
        'shrink-0 overflow-hidden rounded-[4px] shadow-[inset_2px_0_3px_rgba(0,0,0,0.35)]',
        className,
      )}
      style={{ backgroundImage: `linear-gradient(150deg, ${c.from}, ${c.to})` }}
    />
  )
}

/** The book field: a select-look trigger over a cover list. Matches the
 *  Input/Select field language (h-8, border-input, muted placeholder) so it
 *  sits beside other form fields without standing out; the empty state is
 *  neutral, never blue. Long titles clamp; callers gate their submit until
 *  something is picked. */
export function BookSelect({
  books,
  loading,
  picked,
  onPick,
}: {
  books: Book[] | null
  loading: boolean
  picked: Book | null
  onPick: (sha: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Choose a book"
          className={cn(
            'flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent pr-2 pl-3 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30',
            !picked && 'text-muted-foreground',
          )}
        >
          {picked ? (
            <span className="flex min-w-0 items-center gap-2">
              <MiniCover hue={coverHueFromSha(picked.sha256)} className="h-4 w-3" />
              <span className="min-w-0 truncate text-foreground">{picked.title}</span>
            </span>
          ) : (
            <span className="min-w-0 truncate">Choose a book</span>
          )}
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <ul className="max-h-80 overflow-y-auto">
          {loading && !books ? (
            <li className="px-2 py-3 text-xs text-muted-foreground">Loading books…</li>
          ) : (
            (books ?? []).map((b) => (
              <li key={b.sha256}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(b.sha256)
                    setOpen(false)
                  }}
                  aria-current={picked?.sha256 === b.sha256 ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    picked?.sha256 === b.sha256 ? 'bg-muted' : 'hover:bg-muted/60',
                  )}
                >
                  <MiniCover hue={coverHueFromSha(b.sha256)} className="h-11 w-8" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm leading-tight">{b.title}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {b.author}
                    </span>
                  </span>
                  {picked?.sha256 === b.sha256 && (
                    <Check aria-hidden className="size-4 shrink-0 text-primary" />
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
