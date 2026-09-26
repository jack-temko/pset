import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Image as ImageIcon, Type, X } from 'lucide-react'

import type { Box, BoxKind } from '@/api/homework'
import { Button } from '@/components/button'
import { SegmentedControl } from '@/components/segmented-control'
import { usePages } from '@/lib/pages'
import { cn } from '@/lib/utils'
import { BoxingContext, useBoxing, type BoxingTarget } from './boxing-state'

/**
 * Boxing a problem on the scan: the student shows where a problem is by
 * drawing boxes around its words and its figures, over as many pages and
 * columns as it runs. Two ways in, one tool: adding a question from the
 * page, and showing where a find that failed (or went wrong) really is.
 * Spec: design/workspace.md, "Boxing a problem on the page".
 */
export function BoxingProvider({
  onDone,
  children,
}: {
  /** Sends the boxes where the target says; resolves, with the question
   *  it added if any, once they're taken. */
  onDone: (target: BoxingTarget, boxes: Box[]) => Promise<string | void>
  children: ReactNode
}) {
  const [target, setTarget] = useState<BoxingTarget | null>(null)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [kind, setKind] = useState<BoxKind>('text')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState<string | null>(null)

  const cancel = () => {
    setTarget(null)
    setBoxes([])
    setError('')
  }
  // Esc leaves, wherever focus is, as a dialog's Cancel does.
  useEffect(() => {
    if (!target) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [target])

  return (
    <BoxingContext
      value={{
        target,
        boxes,
        kind,
        sending,
        error,
        added,
        start: (t) => {
          setTarget(t)
          setBoxes([])
          setKind('text')
          setError('')
        },
        cancel,
        setKind,
        add: (b) => {
          setBoxes((bs) => [...bs, b])
          setError('')
        },
        remove: (i) => setBoxes((bs) => bs.filter((_, j) => j !== i)),
        flip: (i) =>
          setBoxes((bs) =>
            bs.map((b, j) => (j === i ? { ...b, kind: b.kind === 'text' ? 'figure' : 'text' } : b)),
          ),
        done: async () => {
          if (!target) return
          if (!boxes.some((b) => b.kind === 'text')) {
            setError("Box the problem's words too, not only its figure.")
            return
          }
          setSending(true)
          try {
            const id = await onDone(target, boxes)
            if (id) setAdded(id)
            cancel()
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't send the boxes. Try again.")
          } finally {
            setSending(false)
          }
        },
      }}
    >
      {children}
    </BoxingContext>
  )
}

/** A box smaller than this, as a fraction of the page, was a click. */
const MIN_BOX = 0.01

/**
 * One scan page's boxes: the ones drawn on it, numbered in the order
 * they're read, and, while boxing, the surface a drag draws a new one on.
 * Sits over the page image, in the page's own fractions.
 */
export function PageBoxes({ page }: { page: number }) {
  const b = useBoxing()
  const layer = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<{
    x0: number
    y0: number
    x1: number
    y1: number
  } | null>(null)
  if (!b.target) return null

  const at = (e: React.PointerEvent) => {
    const r = layer.current!.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    }
  }
  const rect = (d: { x0: number; y0: number; x1: number; y1: number }) => ({
    x: Math.min(d.x0, d.x1),
    y: Math.min(d.y0, d.y1),
    w: Math.abs(d.x1 - d.x0),
    h: Math.abs(d.y1 - d.y0),
  })

  return (
    <div
      ref={layer}
      className="absolute inset-0 z-10 cursor-crosshair touch-none"
      onPointerDown={(e) => {
        if (e.button !== 0 || (e.target as Element).closest('[data-box-control]')) return
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        const p = at(e)
        setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
      }}
      onPointerMove={(e) => {
        if (!draft) return
        const p = at(e)
        setDraft({ ...draft, x1: p.x, y1: p.y })
      }}
      onPointerUp={() => {
        if (!draft) return
        const r = rect(draft)
        setDraft(null)
        if (r.w >= MIN_BOX && r.h >= MIN_BOX) b.add({ page, ...r, kind: b.kind })
      }}
    >
      {b.boxes.map((box, i) =>
        box.page === page ? (
          <DrawnBox key={i} box={box} n={i + 1} onRemove={() => b.remove(i)} onFlip={() => b.flip(i)} />
        ) : null,
      )}
      {draft && <DrawnBox box={{ page, ...rect(draft), kind: b.kind }} />}
    </div>
  )
}

/** A box on the page: solid for words, dashed for a figure, with its
 *  number and kind in a chip at its corner and a way to take it back. */
export function DrawnBox({
  box,
  n,
  onRemove,
  onFlip,
}: {
  box: Box
  n?: number
  onRemove?: () => void
  onFlip?: () => void
}) {
  return (
    <div
      className={cn(
        'absolute rounded-sm border-2 border-primary bg-primary/10',
        box.kind === 'figure' && 'border-dashed bg-primary/5',
      )}
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`,
      }}
    >
      {n !== undefined && (
        // One small floating toolbar, shaped like the Menu's card: the
        // box's number, its kind (click to switch), and a way to take it
        // back. Its own width, whatever the box's (a narrow box squeezed
        // the label onto two lines); above the box, or inside its top
        // when the box starts at the page's top, where the page would
        // clip it; and toward the page, from the right half.
        <div
          data-box-control
          className={cn(
            'absolute flex h-control-sm w-max items-center gap-1 rounded-md border bg-card pr-1 pl-1 whitespace-nowrap text-foreground shadow-floating',
            box.y < 0.05 ? 'top-1' : '-top-9',
            box.x + box.w / 2 > 0.6 ? 'right-0' : 'left-0',
          )}
        >
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-xs font-medium text-primary-foreground tabular-nums">
            {n}
          </span>
          <button
            type="button"
            onClick={onFlip}
            aria-label={`Box ${n} is ${box.kind === 'text' ? 'words' : 'a figure'}; switch it`}
            className="flex h-full items-center gap-1 rounded-sm px-2 text-xs font-medium hover:bg-muted/50"
          >
            {box.kind === 'text' ? <Type className="size-4" /> : <ImageIcon className="size-4" />}
            {box.kind === 'text' ? 'Words' : 'Figure'}
          </button>
          <span aria-hidden className="h-4 w-px bg-border" />
          <button
            type="button"
            aria-label={`Remove box ${n}`}
            onClick={onRemove}
            className="grid size-6 place-items-center rounded-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * The bar while boxing, in the scan pill's place and shape: what the
 * boxes are for, which kind the next one is, how many there are, and the
 * two ways out, Cancel beside Done.
 */
export function BoxingBar() {
  const b = useBoxing()
  const pages = usePages()
  if (!b.target) return null
  const words = b.boxes.filter((x) => x.kind === 'text').length
  const figures = b.boxes.length - words
  const count = [
    words && `${words} ${words === 1 ? 'box of words' : 'boxes of words'}`,
    figures && `${figures} ${figures === 1 ? 'figure' : 'figures'}`,
  ]
    .filter(Boolean)
    .join(', ')
  const first = b.boxes.find((x) => x.kind === 'text')
  return (
    // Centred over the scan and inset from its edges, like the pill; only
    // the card itself takes the pointer.
    <div className="pointer-events-none absolute inset-x-6 bottom-6 z-20 flex justify-center">
      <div className="pointer-events-auto space-y-2 rounded-md border bg-card p-2 shadow-floating">
        <div className="flex items-center gap-3">
          <p className="px-1 text-sm whitespace-nowrap">
            {b.target.kind === 'find' ? `Box ${b.target.label}` : 'Box a problem to add'}
          </p>
          <SegmentedControl
            label="The next box holds"
            options={[
              { value: 'text', label: 'Words' },
              { value: 'figure', label: 'Figure' },
            ]}
            value={b.kind}
            onChange={b.setKind}
          />
          <Button variant="ghost" size="sm" onClick={b.cancel}>
            Cancel
          </Button>
          <Button size="sm" disabled={b.boxes.length === 0 || b.sending} onClick={b.done}>
            {b.sending ? 'Sending…' : 'Done'}
          </Button>
        </div>
        <p className={cn('max-w-md px-1 text-xs', b.error ? 'text-destructive' : 'text-muted-foreground')}>
          {b.error ||
            (b.boxes.length === 0
              ? 'Drag a box around its words, then around each figure. A problem over two pages or columns gets a box for each part.'
              : `${count}${first ? `, starting on p. ${pages.label(first.page)}` : ''}. Click a box's label to switch it between words and figure.`)}
        </p>
      </div>
    </div>
  )
}
