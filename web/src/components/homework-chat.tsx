import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessagesSquare, RefreshCw } from 'lucide-react'

import { AnswerText, EnvelopeBlock, type Seen } from '@/components/answer-blocks'
import {
  AssistantBubble,
  ChatComposer,
  ConsultedStrip,
  PagePreviewDialog,
  ToolCard,
  ToolSegmentCard,
  UserBubble,
} from '@/components/chat'
import { TaskSpinner } from '@/components/task-progress'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api, homeworkChat, isAbortError } from '@/lib/api'
import { applyChatEvent, consultedPages, segmentsToText, type StreamSegment } from '@/lib/ask-stream'
import type { ChatEvent, Homework, HomeworkQuestion, Message } from '@/lib/types'
import { cn } from '@/lib/utils'

/** One turn as the panel holds it. `questionId` is the question that was
 *  selected when it was sent, which is what the divider chips read. */
interface Turn {
  id: string | null
  role: 'user' | 'assistant'
  text?: string
  segments?: StreamSegment[]
  questionId?: string
  /** True while this turn is the one being streamed. */
  live?: boolean
}

function turnFromMessage(m: Message): Turn {
  return {
    id: m.id,
    role: m.role === 'user' ? 'user' : 'assistant',
    text: m.role === 'user' ? m.content : undefined,
    segments: m.role === 'assistant' ? m.segments : undefined,
    questionId: m.questionId,
  }
}

/** Did a turn pin a correction? Its reply then offers the rewrite, because
 *  a note without a rewrite is a walkthrough that stays wrong. */
function pinnedNote(turn: Turn): boolean {
  return (turn.segments ?? []).some(
    (seg) => seg.type === 'tool' && seg.kind === 'add_understanding_note' && seg.payload.ok,
  )
}

/** The assignment's tutor chat: one thread for the whole assignment, with
 *  the selected question riding along as the anchor of each message. */
export function HomeworkChatPanel({
  hw,
  question,
  questions,
  disabled,
  onQuestionChanged,
  onRewrite,
  rewriting,
}: {
  hw: Homework
  /** The question in the centre pane; the turn's anchor. */
  question: HomeworkQuestion | null
  questions: HomeworkQuestion[]
  /** No chatting while the assignment is still generating. */
  disabled: boolean
  /** A tool changed a question row. */
  onQuestionChanged: (q: HomeworkQuestion) => void
  /** Rewrite the walkthrough of the question a note landed on. */
  onRewrite: (questionId: string) => void
  /** The question currently being rewritten, if any. */
  rewriting: string | null
}) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .homeworkChatHistory(hw.id)
      .then((r) => {
        if (cancelled) return
        setTurns(r.messages.map(turnFromMessage))
      })
      .catch(() => {
        // An empty chat is the normal first state; a real failure surfaces
        // when the first message is sent.
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [hw.id])

  // Follow the tail while a reply streams in.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns, streaming])

  useEffect(() => () => abortRef.current?.abort(), [])

  const questionLabel = useCallback(
    (id: string | undefined) => {
      if (!id) return null
      const q = questions.find((x) => x.id === id)
      return q ? `Q${q.position}` : null
    },
    [questions],
  )

  const send = () => {
    const message = draft.trim()
    if (!message || streaming || disabled) return
    const controller = new AbortController()
    abortRef.current = controller
    setDraft('')
    setError(null)
    setStreaming(true)
    setTurns((t) => [
      ...t,
      { id: null, role: 'user', text: message, questionId: question?.id },
      { id: null, role: 'assistant', segments: [], questionId: question?.id, live: true },
    ])

    const fold = (ev: ChatEvent) =>
      setTurns((t) => {
        const last = t[t.length - 1]
        if (!last || last.role !== 'assistant') return t
        return [...t.slice(0, -1), { ...last, segments: applyChatEvent(last.segments ?? [], ev) }]
      })

    void homeworkChat(
      hw.id,
      { message, questionId: question?.id },
      (ev) => {
        switch (ev.type) {
          case 'meta':
            break
          case 'question':
            onQuestionChanged(ev.question)
            break
          case 'error':
            setError(ev.error)
            break
          case 'done':
            break
          default:
            fold(ev)
        }
      },
      controller.signal,
    )
      .catch((e: unknown) => {
        if (isAbortError(e)) return
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        abortRef.current = null
        setStreaming(false)
        setTurns((t) => {
          const last = t[t.length - 1]
          if (!last || last.role !== 'assistant') return t
          // A reply that never produced anything leaves nothing behind.
          if ((last.segments?.length ?? 0) === 0) return t.slice(0, -1)
          return [...t.slice(0, -1), { ...last, live: false }]
        })
      })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2">
        <MessagesSquare aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <h2 className="min-w-0 flex-1 truncate font-heading text-sm font-medium">Tutor</h2>
        {question && (
          <span className="shrink-0 rounded-full border bg-muted/40 px-2 py-1 font-mono text-[0.65rem] text-muted-foreground">
            Q{question.position}
          </span>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-4/5 rounded-2xl" />
            <Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" />
          </div>
        ) : turns.length === 0 ? (
          <EmptyChat question={question} />
        ) : (
          <ol className="space-y-4">
            {turns.map((turn, i) => {
              const prev = turns[i - 1]
              const switched =
                turn.role === 'user' &&
                turn.questionId !== undefined &&
                turn.questionId !== prev?.questionId
              return (
                <li key={turn.id ?? `live-${i}`} className="space-y-4">
                  {switched && <QuestionDivider label={questionLabel(turn.questionId)} />}
                  {turn.role === 'user' ? (
                    <div className="flex justify-end">
                      <UserBubble text={turn.text ?? ''} />
                    </div>
                  ) : (
                    <ChatReply
                      turn={turn}
                      sha={hw.bookSha256}
                      onRewrite={onRewrite}
                      rewriting={rewriting}
                      onPage={setPreview}
                    />
                  )}
                </li>
              )
            })}
          </ol>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/40 bg-destructive/[0.06] px-3 py-2 text-xs text-destructive"
          >
            {error}
          </p>
        )}
      </div>

      <PagePreviewDialog
        sha={hw.bookSha256}
        page={preview}
        onClose={() => setPreview(null)}
      />

      <div className="shrink-0 border-t p-3">
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSend={send}
          canSend={draft.trim() !== '' && !streaming && !disabled}
          streaming={streaming}
          onStop={() => abortRef.current?.abort()}
          disabled={disabled}
          rows={2}
          placeholder={
            disabled
              ? 'Wait for the assignment to finish generating…'
              : question
                ? `Ask about Q${question.position}, or say what it got wrong…`
                : 'Ask about this assignment…'
          }
          ariaLabel="Message the tutor"
        />
      </div>
    </div>
  )
}

function EmptyChat({ question }: { question: HomeworkQuestion | null }) {
  return (
    <div className="space-y-2 px-1 py-6 text-sm text-muted-foreground">
      <p className="text-foreground">Ask about this assignment.</p>
      <p className="leading-relaxed">
        {question
          ? `Whatever you send is about Q${question.position} unless you say otherwise.`
          : 'Pick a question on the left to anchor the conversation.'}
      </p>
      <p className="leading-relaxed">
        If it read a problem wrong — a source the other way, a figure
        misread — say so. The correction sticks to the question and the
        walkthrough gets rewritten with it.
      </p>
    </div>
  )
}

/** A chip marking where the conversation moved to another question. */
function QuestionDivider({ label }: { label: string | null }) {
  if (!label) return null
  return (
    <div className="flex items-center gap-2 pt-1" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <span className="rounded-full border bg-background px-2 py-1 font-mono text-[0.65rem] text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

function ChatReply({
  turn,
  sha,
  onRewrite,
  rewriting,
  onPage,
}: {
  turn: Turn
  sha: string
  onRewrite: (questionId: string) => void
  rewriting: string | null
  /** Opens a page a search or read tool turned up. */
  onPage: (page: number) => void
}) {
  const segments = turn.segments ?? []
  const seen: Seen = { last: null }
  const copyText = useMemo(() => segmentsToText(segments), [segments])
  const pages = useMemo(() => consultedPages([], segments), [segments])
  const noteLanded = pinnedNote(turn)
  const targetId = turn.questionId

  if (turn.live && segments.length === 0) {
    return (
      <AssistantBubble>
        <p className="flex items-center gap-2 text-muted-foreground" role="status">
          <TaskSpinner /> Thinking…
        </p>
      </AssistantBubble>
    )
  }

  return (
    <AssistantBubble
      copyText={turn.live ? undefined : copyText}
      meta={
        <>
          {!turn.live && <ConsultedStrip sha={sha} pages={pages} />}
          {noteLanded && targetId && (
            <div className="px-1 pt-3">
              <Button
                size="sm"
                variant="outline"
                disabled={rewriting !== null}
                onClick={() => onRewrite(targetId)}
              >
                <RefreshCw
                  data-icon="inline-start"
                  className={cn(rewriting === targetId && 'animate-spin')}
                />
                {rewriting === targetId ? 'Rewriting…' : 'Rewrite the walkthrough'}
              </Button>
            </div>
          )}
        </>
      }
    >
      {segments.map((seg, i) => {
        if (seg.type === 'prose') {
          if (turn.live && i === segments.length - 1) {
            return (
              <p key={i} className="leading-relaxed whitespace-pre-wrap">
                {seg.text.replace(/\s+$/, '')}
              </p>
            )
          }
          return <AnswerText key={i} text={seg.text} seen={seen} />
        }
        if (seg.type === 'tool') {
          return <ToolSegmentCard key={i} payload={seg.payload} onPage={onPage} />
        }
        if (seg.type === 'tool-running') {
          return <ToolCard key={i} tool={seg.tool} args={seg.args} running />
        }
        if (seg.type === 'code') {
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-xl border bg-muted/30 px-4 py-3 font-mono text-xs text-muted-foreground"
            >
              {seg.text}
            </pre>
          )
        }
        if (seg.type === 'pending') {
          return (
            <p key={i} className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
              <TaskSpinner /> Writing…
            </p>
          )
        }
        return <EnvelopeBlock key={i} seg={seg} seen={seen} />
      })}
    </AssistantBubble>
  )
}
