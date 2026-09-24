import { useState, type ReactNode } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { Check, CircleAlert, Copy, X } from 'lucide-react'

import { Button } from '@/components/button'
import { Spinner } from '@/components/spinner'
import { Tooltip } from '@/components/tooltip'
import { pdfOf, printedLabel, usePageOffset } from '@/lib/pages'

/**
 * The Ask transcript's pieces. Asymmetric by design: you speak in a
 * compact soft block, the book answers in full-width quiet text: chat
 * where you ask, page where it answers. Spec: design/workspace.md.
 */

/** The question: a compact `primary-soft` block on the right. */
export function UserTurn({ about, children }: { about?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {/* The transcript records what a question was about, not just the
          words: "this one" means nothing a week later. */}
      {about && <AboutChip label={about} />}
      <div className="max-w-5/6 rounded-md bg-primary-soft px-3 py-2 text-sm text-primary">
        {children}
      </div>
    </div>
  )
}

/**
 * The homework question a turn is about, carried by "Ask about this".
 * Above the composer it has an ×, the one way to drop it; on a sent
 * turn it's a record and has none.
 */
export function AboutChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex h-control-sm items-center gap-1 rounded-md border border-primary/30 bg-primary-soft pr-1 pl-2 text-xs text-primary">
      About <span className="font-mono">{label}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Stop asking about ${label}`}
          className="grid size-5 cursor-pointer place-items-center rounded-sm transition-colors duration-150 ease-out hover:bg-primary/15 motion-reduce:transition-none"
        >
          <X className="size-3" />
        </button>
      ) : (
        <span className="w-1" />
      )}
    </span>
  )
}

/** A step line's ink: the live one in full foreground, the rest quiet.
 *  Colour eases, so a line fades back as the next begins or the answer
 *  ends. */
const stepInk = (live: boolean) =>
  `flex items-center gap-2 text-xs font-normal transition-colors duration-150 ease-out motion-reduce:transition-none ${
    live ? 'text-foreground' : 'text-muted-foreground'
  }`

/**
 * The step feed: one quiet line per tool call, giving verb, object, count.
 * The line is the whole story; nothing expands.
 *
 * With `running`, the last line is the call in flight: present tense, a
 * Spinner at its start ("Searching 'eigenvalue'…"), and full ink. When it
 * finishes, the caller replaces it with the past-tense line and its count,
 * the spinner goes, and the line fades back to the feed's quiet ink.
 */
export function Steps({ steps, running, thinking }: { steps: StepLine[]; running?: boolean; thinking?: boolean }) {
  return (
    // Not part of the answer: Copy skips it.
    <div className="space-y-1" data-copy-skip="">
      {steps.map((s, i) => {
        const live = running && i === steps.length - 1
        const line = typeof s === 'string' ? { label: s } : s
        return (
          <p key={i} className={stepInk(!!live)}>
            {live && <Spinner className="size-3" label="Working" />}
            <span className="min-w-0">
              {line.label}
              {line.action && (
                <>
                  <span aria-hidden> · </span>
                  {line.action}
                </>
              )}
            </span>
          </p>
        )
      })}
      {thinking && <Thinking />}
    </div>
  )
}

/** The loop waiting on the model, with nothing else on screen saying so:
 *  before the first step or word, and between a step and what follows.
 *  Drawn as a live step line, since that is what it is; after steps,
 *  `Steps` draws it in their group. */
export function Thinking() {
  return (
    <p className={stepInk(true)} data-copy-skip="">
      <Spinner className="size-3" label="Thinking" />
      <span>Thinking…</span>
    </p>
  )
}

/** A step line, and what you can do about it: a remember step carries
 *  its Undo. */
export type StepLine = string | { label: string; action?: ReactNode }

/** The one action a step line has: quiet text in the line's own size,
 *  primary ink so it reads as something to press. */
export function StepAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-sm font-medium text-primary underline-offset-2 hover:underline"
    >
      {children}
    </button>
  )
}

/** What's left of an answer you stopped: the partial text above it, then
 *  this quiet line. Nothing to click; asking again is the retry. */
export function StoppedNote() {
  return <p className="text-xs text-muted-foreground">Stopped</p>
}

/** The answer: full-width on the panel ground, with Copy on hover. */
export function AssistantTurn({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="group relative space-y-3 text-base">
      {children}
      <button
        type="button"
        aria-label="Copy answer"
        onClick={(e) => {
          // The answer, not the feed: the step lines between paragraphs
          // are the app talking, and copying them would paste the
          // machinery along with the words.
          const button = e.currentTarget
          const text = Array.from(button.parentElement?.children ?? [])
            .filter((el) => el !== button && !el.hasAttribute('data-copy-skip'))
            .map((el) => (el as HTMLElement).innerText)
            .filter(Boolean)
            .join('\n\n')
          try {
            void navigator.clipboard.writeText(text)
          } catch {
            /* clipboard can be blocked; the button just doesn't confirm */
          }
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="flex h-control-sm w-control-sm items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 hover:bg-muted/50 hover:text-foreground focus-visible:opacity-100 motion-reduce:transition-none"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  )
}

/** An inline citation: a small mono chip that reads as an object in the
 *  prose. Click scrolls the scan to the page and flashes its edge. */
export function PageRef({ page, onJump }: { page: number; onJump?: (page: number) => void }) {
  // The chip says the printed page; the PDF page is one hover away.
  const offset = usePageOffset()
  return (
    <Tooltip label={`PDF page ${pdfOf(page, offset)}`}>
      <button
        type="button"
        onClick={() => onJump?.(page)}
        className="mx-px inline-flex shrink-0 translate-y-px items-center rounded-sm bg-primary-soft px-1 font-mono text-xs whitespace-nowrap text-primary transition-colors duration-150 ease-out hover:bg-primary hover:text-primary-foreground motion-reduce:transition-none"
      >
        p.&thinsp;{printedLabel(pdfOf(page, offset), offset)}
      </button>
    </Tooltip>
  )
}

/** Inline math, in the prose's own size. */
export function MathInline({ tex }: { tex: string }) {
  return (
    <span
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(tex, { throwOnError: false }),
      }}
    />
  )
}

/** Display math: a centered block with room to breathe. */
export function MathDisplay({ tex }: { tex: string }) {
  return (
    <div
      className="overflow-x-auto py-1"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(tex, { throwOnError: false, displayMode: true }),
      }}
    />
  )
}

/** The date changed: a quiet centered mark on a hairline. */
export function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-border-muted" />
      <span className="text-xs font-normal text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border-muted" />
    </div>
  )
}

/** The very top of the history: where it begins, and the one way to
 *  start over. Clearing asks once, in place. */
export function ConversationStart({ onClear }: { onClear?: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="flex items-center justify-center gap-2 text-xs font-normal text-muted-foreground">
      {confirming ? (
        <>
          <span>Clear this conversation?</span>
          <Button variant="destructive" size="sm" onClick={onClear}>
            Clear
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
        </>
      ) : (
        <>
          <span>Start of conversation</span>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="underline underline-offset-2 transition-colors duration-150 ease-out hover:text-foreground motion-reduce:transition-none"
          >
            Clear
          </button>
        </>
      )}
    </div>
  )
}

/** A loop that died: the feed above freezes, this says why in one line,
 *  and Try again re-runs the same question. A setup failure (no chat
 *  model) also takes `onSetup`: Open Settings leads, since trying again
 *  can't help until that's fixed, and Try again steps back to ghost. */
export function FailedTurn({
  reason,
  onRetry,
  onSetup,
}: {
  reason: string
  onRetry?: () => void
  onSetup?: () => void
}) {
  const line = (
    <>
      <span className="flex h-5 shrink-0 items-center">
        <CircleAlert className="size-4" />
      </span>
      <span className="min-w-0 flex-1 font-normal">{reason}</span>
    </>
  )
  // Two actions don't fit beside a sentence in a 440px panel: they drop
  // to their own row, under the text.
  if (onSetup)
    return (
      <div className="space-y-2 text-xs text-destructive">
        <div className="flex gap-2">{line}</div>
        <div className="flex gap-2 pl-6">
          <Button variant="outline" size="sm" onClick={onSetup}>
            Open Settings
          </Button>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </div>
    )
  return (
    <div className="flex items-center gap-2 text-xs text-destructive">
      {line}
      <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
        Try again
      </Button>
    </div>
  )
}

export { AnswerTable, CodeBlock, Plot, Statement, WorkedSteps } from './cards'
