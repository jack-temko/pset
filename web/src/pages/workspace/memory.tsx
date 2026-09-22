import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { Button, IconButton } from '@/components/button'
import { Dialog } from '@/components/dialog'
import { Field, Input } from '@/components/input'
import { SegmentedControl } from '@/components/segmented-control'
import { UnderlineNav, UnderlineTab } from '@/components/underline-nav'
import { Skeleton } from '@/components/skeleton'
import { PageRef, StepAction, Steps, type StepLine } from '@/components/transcript'
import { ApiError } from '@/api/client'
import type { MemoryLine } from '@/api/homework'
import {
  useAddMemory,
  useMemories,
  useRemoveMemory,
  type Memory,
  type MemoryKind,
  type Source,
} from '@/api/memory'
import { pdfOf, printedLabel, usePageOffset } from '@/lib/pages'

/**
 * The book's memory in the workspace: the Undo on a save, the lines under
 * a walkthrough, and the Memory dialog. Spec: design/memory.md.
 */

/** Undo for a step that saved a memory; "Undone" once it's gone, however
 *  it went. Nothing while the list is still loading. */
export function MemoryUndo({ bookId, memoryId }: { bookId: string; memoryId: string }) {
  const memories = useMemories(bookId)
  const remove = useRemoveMemory(bookId)
  if (!memories.data) return null
  if (!memories.data.some((m) => m.id === memoryId)) return <span>Undone</span>
  return <StepAction onClick={() => remove.mutate(memoryId)}>Undo</StepAction>
}

/** The page a memory names, after its sentence, unless the sentence
 *  already says it (a problem range does). */
function withPage(text: string, page: number | undefined, offset: number): string {
  if (!page || /\bp\. ?\d/.test(text)) return text
  return `${text.replace(/\.$/, '')} · p. ${printedLabel(page, offset)}`
}

/** What writing a guide did with memory, as step lines under it. */
export function MemoryLines({ bookId, lines }: { bookId: string; lines: MemoryLine[] }) {
  const offset = usePageOffset()
  if (lines.length === 0) return null
  const steps: StepLine[] = lines.map((l) => {
    const text = withPage(l.text, l.page, offset)
    if (l.use === 'found') return `Found from memory · ${text}`
    return {
      label: `${l.use === 'updated' ? 'Updated a memory' : 'Remembered'} · ${text}`,
      action: <MemoryUndo bookId={bookId} memoryId={l.memoryId} />,
    }
  })
  return <Steps steps={steps} />
}

const KINDS = [
  { value: 'book', label: 'Book' },
  { value: 'preference', label: 'Preference' },
] as const

const SOURCE: Record<Source, string> = { you: 'You', tutor: 'Tutor', pset: 'PSet' }

type Filter = 'all' | MemoryKind

/**
 * Memory: what the tutor knows about this book, and yours to prune. Add
 * one at the top; below, every memory with its page, who saved it and
 * when, and Delete. Deletes are immediate, so the one button is Done.
 */
export function MemoryDialog({
  open,
  bookId,
  onClose,
  onJump,
}: {
  open: boolean
  bookId: string
  onClose: () => void
  onJump: (printed: number) => void
}) {
  const offset = usePageOffset()
  const memories = useMemories(bookId)
  const add = useAddMemory(bookId)
  const remove = useRemoveMemory(bookId)
  const [kind, setKind] = useState<MemoryKind>('book')
  const [text, setText] = useState('')
  const [page, setPage] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  // Adding a sentence that's already here brings back the one there is.
  const [already, setAlready] = useState(false)

  useEffect(() => {
    if (open) {
      setText('')
      setPage('')
      setFilter('all')
      setAlready(false)
      add.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const printed = page.trim() ? Number(page.match(/^\s*(\d+)\s*$/)?.[1] ?? NaN) : undefined
  const pageBad = printed !== undefined && !(printed >= 1)
  const error = add.error instanceof ApiError ? add.error : null

  const submit = () => {
    if (!text.trim() || pageBad) return
    add.mutate(
      {
        kind,
        text: text.trim(),
        page: kind === 'book' && printed !== undefined ? pdfOf(printed, offset) : undefined,
      },
      {
        onSuccess: (m) => {
          setAlready(all.some((x) => x.id === m.id))
          setText('')
          setPage('')
        },
      },
    )
  }

  const all = memories.data ?? []
  const count = (k: MemoryKind) => all.filter((m) => m.kind === k).length
  const shown = filter === 'all' ? all : all.filter((m) => m.kind === filter)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Memory"
      width="wide"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <div className="space-y-5">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <SegmentedControl label="Kind" options={KINDS} value={kind} onChange={setKind} />
          <div className="flex items-start gap-2">
            <Field
              label={kind === 'book' ? 'About the book' : 'How you want answers'}
              error={error?.field === 'text' || error?.field === 'kind' ? error.message : undefined}
              hint={already ? 'That one is already remembered.' : undefined}
              className="min-w-0 flex-1"
            >
              <Input
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setAlready(false)
                }}
                placeholder={kind === 'book' ? 'Problems come right before each new section' : 'Use SI units'}
              />
            </Field>
            {kind === 'book' && (
              <Field label="Page" error={pageBad || error?.field === 'page' ? 'A page number' : undefined} className="w-24 shrink-0">
                <Input
                  inputMode="numeric"
                  value={page}
                  onChange={(e) => setPage(e.target.value)}
                  placeholder="Optional"
                  className="font-mono"
                />
              </Field>
            )}
            {/* Level with the inputs, under their labels. */}
            <Button type="submit" variant="secondary" className="mt-6 shrink-0" disabled={!text.trim() || pageBad || add.isPending}>
              Add
            </Button>
          </div>
        </form>

        <div className="space-y-3">
          {/* Tabs, not a second segmented control: this one filters what
              you read, the one above picks what you write. */}
          <UnderlineNav className="-mt-2 border-b">
            {(['all', 'book', 'preference'] as const).map((f) => (
              <UnderlineTab key={f} active={filter === f} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'book' ? 'Book' : 'Preference'}
                <span className="ml-1 font-mono text-xs text-muted-foreground">
                  {f === 'all' ? all.length : count(f)}
                </span>
              </UnderlineTab>
            ))}
          </UnderlineNav>
          {!memories.data ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {all.length === 0
                ? 'Nothing yet. As the tutor works in this book it saves what will help later, like where a theorem is or how the problems are laid out. Add your own above.'
                : 'None of this kind.'}
            </p>
          ) : (
            <ul className="divide-y divide-border-muted">
              {shown.map((m) => (
                <MemoryRow
                  key={m.id}
                  m={m}
                  showKind={filter === 'all'}
                  onDelete={() => remove.mutate(m.id)}
                  onJump={(p) => {
                    onJump(p)
                    onClose()
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  )
}

function MemoryRow({
  m,
  showKind,
  onDelete,
  onJump,
}: {
  m: Memory
  showKind: boolean
  onDelete: () => void
  onJump: (printed: number) => void
}) {
  const offset = usePageOffset()
  const meta = [
    showKind && (m.kind === 'book' ? 'Book' : 'Preference'),
    SOURCE[m.source],
    new Date(m.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  ].filter(Boolean)
  return (
    <li className="flex items-start gap-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm">{m.text}</p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {meta.join(' · ')}
          {m.page !== undefined && <PageRef page={m.page - offset} onJump={onJump} />}
        </p>
      </div>
      <IconButton variant="ghost" size="sm" aria-label="Delete this memory" onClick={onDelete}>
        <Trash2 />
      </IconButton>
    </li>
  )
}
