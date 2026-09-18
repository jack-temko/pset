import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import type { Homework, HomeworkQuestion } from '@/lib/types'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type AdjustPatch = {
  page?: number
  questionRect?: Rect
  diagrams?: { label: string; rect: Rect }[]
  standalone?: boolean
}

/**
 * The Adjust panel: hand work only.
 *
 * Anything you would say in words — "this is the practice problem, I need the
 * end-of-section one" — goes through the tutor chat, which plans the same
 * repairs from an instruction. What's here is what you do by hand: name the
 * page, drag the crop until it frames properly, or say the question isn't
 * from the book at all.
 */
export function QuestionAdjust({
  hw,
  q,
  busy,
  onAdjust,
  onRelocate,
  onClose,
}: {
  hw: Homework
  q: HomeworkQuestion
  busy: boolean
  onAdjust: (patch: AdjustPatch) => void
  onRelocate: (page: number | undefined, note: string) => void
  onClose: () => void
}) {
  const [page, setPage] = useState(q.page !== null ? String(q.page) : '')

  const findOnPage = () => {
    const n = Number.parseInt(page, 10)
    if (Number.isNaN(n) || n < 1) {
      toast.error('That isn’t a page number.')
      return
    }
    // Naming the page turns searching the whole book into finding a region
    // on one page — a far more reliable thing to ask for.
    onRelocate(n, '')
  }

  return (
    <div className="space-y-4 rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Adjust question {q.position}</p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>

      {!q.standalone ? (
        <>
          <div className="flex items-end gap-2">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Page</span>
              <Input
                value={page}
                onChange={(e) => setPage(e.target.value)}
                inputMode="numeric"
                className="h-8 w-20 font-mono text-sm"
                aria-label="Page this question is on"
              />
            </label>
            <Button size="sm" variant="outline" disabled={busy} onClick={findOnPage}>
              Find it on this page
            </Button>
          </div>

          {q.page !== null ? (
            <CropEditor
              hw={hw}
              page={q.page}
              rect={q.questionRect}
              busy={busy}
              onSave={(rect) => onAdjust({ questionRect: rect })}
            />
          ) : null}
        </>
      ) : null}

      <label className="flex items-center gap-3">
        <Switch
          checked={q.standalone}
          disabled={busy}
          onCheckedChange={(checked) => onAdjust({ standalone: checked })}
        />
        <span className="text-sm">
          Not from the book
          <span className="block text-xs text-muted-foreground">
            The walkthrough is written from the question alone.
          </span>
        </span>
      </label>
    </div>
  )
}

/**
 * Drag a box over the page to reframe the crop. Saves the fractions the
 * backend stores, with no model call: this is the deterministic half of
 * repair, and it should never cost a round trip to a model.
 */
function CropEditor({
  hw,
  page,
  rect,
  busy,
  onSave,
}: {
  hw: Homework
  page: number
  rect: Rect | null
  busy: boolean
  onSave: (rect: Rect) => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<Rect | null>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)

  const shown = draft ?? rect

  const toFraction = (e: React.PointerEvent) => {
    const box = frameRef.current?.getBoundingClientRect()
    if (!box) return null
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Drag across the page to reframe what gets shown.
      </p>
      <div
        ref={frameRef}
        className="relative w-full max-w-md touch-none overflow-hidden rounded-md border bg-background select-none"
        onPointerDown={(e) => {
          const p = toFraction(e)
          if (!p) return
          e.currentTarget.setPointerCapture(e.pointerId)
          dragStart.current = p
          setDraft({ x: p.x, y: p.y, w: 0, h: 0 })
        }}
        onPointerMove={(e) => {
          const start = dragStart.current
          if (!start) return
          const p = toFraction(e)
          if (!p) return
          setDraft({
            x: Math.min(start.x, p.x),
            y: Math.min(start.y, p.y),
            w: Math.abs(p.x - start.x),
            h: Math.abs(p.y - start.y),
          })
        }}
        onPointerUp={() => {
          dragStart.current = null
        }}
      >
        <img
          src={api.pageImageUrl(hw.bookSha256, page)}
          alt={`Page ${page}`}
          className="pointer-events-none w-full"
          draggable={false}
        />
        {shown ? (
          <div
            className="pointer-events-none absolute border-2 border-primary bg-primary/10"
            style={{
              left: `${shown.x * 100}%`,
              top: `${shown.y * 100}%`,
              width: `${shown.w * 100}%`,
              height: `${shown.h * 100}%`,
            }}
          />
        ) : null}
      </div>
      {draft && draft.w > 0.02 && draft.h > 0.02 ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => onSave(draft)}>
            Save this frame
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
            Cancel
          </Button>
        </div>
      ) : null}
    </div>
  )
}
