import { useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  ArrowUp,
  Calculator,
  Check,
  Copy,
  FileText,
  Grid3x3,
  LoaderCircle,
  NotebookPen,
  Search,
  Square,
} from 'lucide-react'

import { SmallCaps } from '@/components/answer-blocks'
import { BookSelect } from '@/components/book-chip'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import type { Book, ToolName, ToolPayload } from '@/lib/types'
import { cn } from '@/lib/utils'

/** The one chat box, shared by Ask and the homework workspace's tutor:
 *  card shell, borderless textarea with Enter-to-send, and a bottom row
 *  whose controls stand at field height (h-8) so the send button lines up
 *  with the book field beside it. Optional slots: a notice line above the
 *  textarea (page status) and the book field. Callers own the send gating
 *  via `canSend`. */
export function ChatComposer({
  value,
  onChange,
  onSend,
  canSend,
  sendLabel = 'Send message',
  streaming = false,
  onStop,
  stopLabel = 'Stop generating',
  busy = false,
  disabled = false,
  placeholder,
  ariaLabel,
  rows = 1,
  book,
  notice,
  autoFocus = false,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  /** Send arms only when this is true; callers own every gate (draft text,
   *  a picked book, page busy states). */
  canSend: boolean
  sendLabel?: string
  /** While streaming, the send button becomes Stop. */
  streaming?: boolean
  onStop?: () => void
  stopLabel?: string
  /** Unstoppable work in flight: the control parks on a spinner. */
  busy?: boolean
  disabled?: boolean
  placeholder: string
  ariaLabel: string
  rows?: number
  /** The book field, shown between the textarea and the button. */
  book?: {
    books: Book[] | null
    loading: boolean
    picked: Book | null
    onPick: (sha: string) => void
  }
  notice?: ReactNode
  autoFocus?: boolean
}) {
  const send = () => {
    if (disabled || busy || streaming || !canSend) return
    onSend()
  }
  return (
    <div className="rounded-2xl border bg-card p-2 shadow-sm transition-colors focus-within:border-ring">
      {notice}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            send()
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={rows}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn(
          'max-h-44 resize-none border-0 px-2 py-2 shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent',
          rows > 1 ? 'min-h-16' : 'min-h-9',
        )}
      />
      <div className="mt-1 flex items-center gap-2">
        {book ? (
          <div className="min-w-0 flex-1">
            <BookSelect
              books={book.books}
              loading={book.loading}
              picked={book.picked}
              onPick={book.onPick}
            />
          </div>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        {busy ? (
          <Button variant="outline" size="icon" disabled className="shrink-0">
            <LoaderCircle className="animate-spin" />
          </Button>
        ) : streaming ? (
          <Button
            variant="outline"
            size="icon"
            onClick={onStop}
            aria-label={stopLabel}
            className="shrink-0"
          >
            <Square />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={send}
            disabled={disabled || !canSend}
            aria-label={sendLabel}
            className="shrink-0"
          >
            <ArrowUp />
          </Button>
        )}
      </div>
    </div>
  )
}

/** Copy affordance under a bubble; `align` mirrors it to the bubble's edge. */
export function CopyButton({ text, align }: { text: string; align: 'left' | 'right' }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : 'Copy message'}
      title={copied ? 'Copied' : 'Copy'}
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        })
      }}
      className={cn(
        'mt-1 flex size-7 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
        align === 'right' && 'ml-auto',
        copied && 'text-primary',
      )}
    >
      {copied ? (
        <Check aria-hidden className="size-4" />
      ) : (
        <Copy aria-hidden className="size-4" />
      )}
    </button>
  )
}

/** The asker's turn: right-aligned primary bubble with its copy button. */
export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex max-w-[85%] flex-col">
      <div className="rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm whitespace-pre-wrap text-primary-foreground">
        {text}
      </div>
      <CopyButton text={text} align="right" />
    </div>
  )
}

/** The tutor's bubble shell: card content squared toward the thread edge,
 *  with an optional copy button and citation footer once the answer lands.
 *  Content — prose, blocks, the streaming placeholder — arrives as
 *  children. */
export function AssistantBubble({
  copyText,
  meta,
  children,
}: {
  copyText?: string
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="max-w-[92%]">
      <div className="space-y-3 rounded-2xl rounded-bl-md border bg-card px-4 py-3 text-sm leading-relaxed">
        {children}
      </div>
      {copyText !== undefined && <CopyButton text={copyText} align="left" />}
      {meta}
    </div>
  )
}

/* ── tool cards ────────────────────────────────────────────────────────── */

const toolIcons: Record<ToolName, typeof Calculator> = {
  calc: Calculator,
  solve_linear: Grid3x3,
  search_book: Search,
  read_page: FileText,
  add_understanding_note: NotebookPen,
}

const toolVerbs: Record<ToolName, string> = {
  calc: 'Calculating',
  solve_linear: 'Solving the system',
  search_book: 'Searching the book',
  read_page: 'Reading a page',
  add_understanding_note: 'Pinning a correction',
}

/** The one line that says what a tool was asked for, read off its arguments.
 *  Falls back to the tool's own verb when the arguments are not what we
 *  expect, because a card must never be blank. */
export function toolSubject(tool: ToolName, args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
  switch (tool) {
    case 'calc':
      return str(a.expression) ?? toolVerbs.calc
    case 'solve_linear': {
      const rows = Array.isArray(a.a) ? a.a.length : 0
      return rows > 0 ? `${rows}×${rows} system` : toolVerbs.solve_linear
    }
    case 'search_book':
      return str(a.query) ?? toolVerbs.search_book
    case 'read_page':
      return typeof a.page === 'number' ? `Page ${a.page}` : toolVerbs.read_page
    case 'add_understanding_note':
      return str(a.note) ?? toolVerbs.add_understanding_note
  }
}

/** One tool exchange in the transcript: what it was asked, and what came
 *  back. Compact by design — the card is the model showing its working, not
 *  the answer, so it sits quieter than the prose around it. */
export function ToolCard({
  tool,
  args,
  result,
  ok,
  pages,
  running = false,
  onPage,
}: {
  tool: ToolName
  args?: unknown
  result?: string
  ok?: boolean
  pages?: number[]
  running?: boolean
  /** Click a page chip (search and read results); omitted, chips are inert. */
  onPage?: (page: number) => void
}) {
  const Icon = toolIcons[tool]
  const subject = toolSubject(tool, args)
  const failed = !running && ok === false
  return (
    <div
      className={cn(
        'rounded-xl border bg-muted/30 px-3 py-2 font-mono text-xs',
        failed && 'border-destructive/40',
      )}
      role="group"
      aria-label={`${toolVerbs[tool]}: ${subject}`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {running ? (
          <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin" />
        ) : (
          <Icon aria-hidden className={cn('size-4 shrink-0', failed && 'text-destructive')} />
        )}
        <span className="min-w-0 flex-1 truncate" title={subject}>
          {running ? `${toolVerbs[tool]}…` : subject}
        </span>
      </div>
      {!running && result != null && result !== '' && (
        <p
          className={cn(
            'mt-2 pl-6 leading-relaxed break-words whitespace-pre-wrap',
            failed ? 'text-destructive' : 'text-foreground',
          )}
        >
          {result}
        </p>
      )}
      {!running && pages != null && pages.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 pl-6">
          {pages.map((n) =>
            onPage ? (
              <button
                key={n}
                type="button"
                onClick={() => onPage(n)}
                className="rounded-full border bg-background px-2 py-1 text-[0.65rem] text-primary hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                p. {n}
              </button>
            ) : (
              <span
                key={n}
                className="rounded-full border bg-background px-2 py-1 text-[0.65rem] text-primary"
              >
                p. {n}
              </span>
            ),
          )}
        </div>
      )}
    </div>
  )
}

/** A stored tool card, rendered from its payload. */
export function ToolSegmentCard({
  payload,
  onPage,
}: {
  payload: ToolPayload
  onPage?: (page: number) => void
}) {
  return (
    <ToolCard
      tool={payload.tool}
      args={payload.args}
      result={payload.result}
      ok={payload.ok}
      pages={payload.pages}
      onPage={onPage}
    />
  )
}

/* ── consulted pages ───────────────────────────────────────────────────── */

/** The pages an answer actually touched: what retrieval handed it plus what
 *  its tools went and read. Fed by events, never by parsing page numbers
 *  back out of the prose. */
export function ConsultedStrip({ sha, pages }: { sha: string; pages: number[] }) {
  const [preview, setPreview] = useState<number | null>(null)
  if (pages.length === 0) return null
  return (
    <div className="px-1 pt-3">
      <SmallCaps>Pages consulted</SmallCaps>
      <div className="mt-2 flex flex-wrap gap-2">
        {pages.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPreview(n)}
            title={`Preview page ${n}`}
            aria-label={`Preview page ${n}`}
            className="relative block h-28 w-[5.25rem] shrink-0 overflow-hidden rounded-md border bg-background transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <img
              src={api.pageImageUrl(sha, n)}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
            <span className="absolute right-0 bottom-0 rounded-tl-lg bg-background/95 px-2 py-1 font-mono text-xs text-muted-foreground shadow-sm">
              {n}
            </span>
          </button>
        ))}
      </div>
      <PagePreviewDialog sha={sha} page={preview} onClose={() => setPreview(null)} />
    </div>
  )
}

/** Full-size look at one page, with the door through to the reader. */
export function PagePreviewDialog({
  sha,
  page,
  onClose,
  readerHref,
}: {
  sha: string
  page: number | null
  onClose: () => void
  /** Defaults to the reader at that page; pass null for no door. */
  readerHref?: string | null
}) {
  const href = readerHref === undefined ? `/library/${sha}/read?page=${page}` : readerHref
  return (
    <Dialog open={page !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[min(92vw,60rem)] sm:max-w-[min(92vw,60rem)]">
        <DialogHeader>
          <DialogTitle>Page {page}</DialogTitle>
          <DialogDescription className="sr-only">
            Full-size preview of page {page}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-2">
          {page !== null && (
            <img
              src={api.pageImageUrl(sha, page)}
              alt={`Page ${page}`}
              className="max-h-[75vh] w-auto rounded-sm object-contain"
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {page !== null && href && (
            <Button variant="outline" asChild>
              <a href={href}>Open in reader</a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
