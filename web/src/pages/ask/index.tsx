import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  BookOpen,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

import {
  AnswerText,
  EnvelopeBlock,
  SmallCaps,
  type Seen,
} from '@/components/answer-blocks'
import { CoverDot } from '@/components/book-chip'
import {
  AssistantBubble,
  ChatComposer,
  ConsultedStrip,
  ToolCard,
  ToolSegmentCard,
  UserBubble,
} from '@/components/chat'
import { TaskSpinner } from '@/components/task-progress'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useBooks } from '@/hooks/use-books'
import { useConfig } from '@/hooks/use-config'
import { useConversations } from '@/hooks/use-conversations'
import { useMutation } from '@/hooks/use-mutation'
import { api, askBook, isAbortError } from '@/lib/api'
import {
  applyChatEvent,
  consultedPages,
  segmentsToText,
  type StreamSegment,
} from '@/lib/ask-stream'
import { coverHueFromSha } from '@/lib/covers'
import { relTime } from '@/lib/format'
import type {
  ChatEvent,
  Conversation,
  EnvelopeKind,
  Message,
  MessageRole,
} from '@/lib/types'
import { cn } from '@/lib/utils'

export interface ChatMsg {
  id: string | null
  role: MessageRole
  text?: string
  segments?: StreamSegment[]
  /** Legacy extracted citations; still what an old thread's strip shows. */
  citations?: number[] | null
  /** The pages retrieval gave this turn (this visit's stream only). */
  retrieved?: number[]
}

/* ── helpers ───────────────────────────────────────────────────────────── */

/** The wire form of a stored message folded into a chat bubble: user turns
 *  speak content, assistant turns speak segments. */
function messageFromApi(m: Message): ChatMsg {
  return {
    id: m.id,
    role: m.role,
    text: m.role === 'user' ? m.content : undefined,
    segments: m.role === 'assistant' ? m.segments : undefined,
    citations: m.citations,
  }
}

function CodeBlock({ raw, muted = false }: { raw: string; muted?: boolean }) {
  if (raw === '') return null
  return (
    <pre
      className={cn(
        'overflow-x-auto rounded-xl border bg-muted/30 px-4 py-3 font-mono text-xs leading-relaxed',
        muted ? 'text-muted-foreground' : 'text-foreground',
      )}
    >
      {raw}
    </pre>
  )
}

/* ── streaming skeleton ────────────────────────────────────────────────── */

const envelopeLabels: Record<EnvelopeKind, string> = {
  equation: 'Writing an equation…',
  steps: 'Working the steps…',
  theorem: 'Stating a theorem…',
  definition: 'Defining a term…',
  note: 'Adding a note…',
}

const envelopeRepairingLabels: Record<EnvelopeKind, string> = {
  equation: 'Tidying an equation…',
  steps: 'Tidying the steps…',
  theorem: 'Tidying the theorem…',
  definition: 'Tidying the definition…',
  note: 'Tidying the note…',
}

/** Shaped glimmer shown while an envelope is open: labelled while the model
 *  writes it, swapped to the repairing label during the repair round. */
function PendingSkeleton({
  kind,
  repairing,
}: {
  kind: EnvelopeKind
  repairing: boolean
}) {
  const label = repairing ? envelopeRepairingLabels[kind] : envelopeLabels[kind]
  let shape: ReactNode
  if (kind === 'equation') {
    shape = (
      <div className="rounded-xl border bg-muted/20 px-4 py-5">
        <Skeleton className="mx-auto h-6 w-2/3 rounded-lg" />
      </div>
    )
  } else if (kind === 'steps') {
    shape = (
      <div className="space-y-2 rounded-xl border bg-muted/20 px-4 py-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    )
  } else if (kind === 'note') {
    shape = (
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-4">
        <Skeleton className="h-4 w-3/4" />
      </div>
    )
  } else {
    shape = (
      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <span aria-hidden className="h-4 w-1 rounded-full bg-muted-foreground/40" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <div className="space-y-2 px-4 py-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-3" role="status" aria-label={label}>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <TaskSpinner /> {label}
      </p>
      {shape}
    </div>
  )
}

/* ── message chrome ────────────────────────────────────────────────────── */

const NO_SEGMENTS: StreamSegment[] = []

export function AssistantMessage({
  msg,
  sha,
  streaming,
  readingPages,
}: {
  msg: ChatMsg
  sha: string
  streaming: boolean
  readingPages: number[] | null
}) {
  const segments = msg.segments ?? NO_SEGMENTS
  // Fresh dedupe state every render pass: chips depend only on content order.
  const seen: Seen = { last: null }
  const copyText = useMemo(() => segmentsToText(segments), [segments])
  // What the answer actually touched: retrieval plus whatever its tools
  // read. Legacy threads have neither and fall back to their stored
  // citations.
  const pages = useMemo(
    () => consultedPages(msg.retrieved ?? msg.citations ?? [], segments),
    [msg.retrieved, msg.citations, segments],
  )

  return (
    <AssistantBubble
      copyText={streaming ? undefined : copyText}
      meta={!streaming && <ConsultedStrip sha={sha} pages={pages} />}
    >
      {streaming && segments.length === 0 ? (
        <p className="flex items-center gap-2 text-muted-foreground" role="status">
          <TaskSpinner />{' '}
          {readingPages && readingPages.length > 0 ? (
            <span>
              Reading pages <span className="font-mono">{readingPages.join(', ')}</span>…
            </span>
          ) : (
            'Thinking…'
          )}
        </p>
      ) : (
        <>
          {segments.map((seg, i) => {
            const last = i === segments.length - 1
            if (seg.type === 'prose') {
              if (streaming && last) {
                return (
                  <p key={i} className="leading-relaxed whitespace-pre-wrap">
                    {seg.text.replace(/\s+$/, '')}
                  </p>
                )
              }
              return <AnswerText key={i} text={seg.text} seen={seen} />
            }
            if (seg.type === 'envelope') return <EnvelopeBlock key={i} seg={seg} seen={seen} />
            if (seg.type === 'code') return <CodeBlock key={i} raw={seg.text} muted />
            if (seg.type === 'tool') return <ToolSegmentCard key={i} payload={seg.payload} />
            if (seg.type === 'tool-running') {
              return <ToolCard key={i} tool={seg.tool} args={seg.args} running />
            }
            if (streaming) return <PendingSkeleton key={i} kind={seg.kind} repairing={seg.repairing} />
            return null
          })}
        </>
      )}
    </AssistantBubble>
  )
}

/* ── history ───────────────────────────────────────────────────────────── */

function HistoryPanel({
  conversations,
  selectedId,
  loading,
  error,
  actionError,
  onRetry,
  onOpen,
  onDelete,
  onTogglePin,
  onRename,
}: {
  conversations: Conversation[]
  selectedId: string | null
  loading: boolean
  error: string | null
  actionError: string | null
  onRetry: () => void
  onOpen: (id: string) => void
  onDelete: (c: Conversation) => void
  onTogglePin: (c: Conversation) => void
  onRename: (id: string, title: string) => void
}) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')

  const pinned = conversations.filter((c) => c.pinned)
  const rest = conversations.filter((c) => !c.pinned)

  const row = (c: Conversation) => {
    const active = c.id === selectedId
    const hue = c.bookSha256 ? coverHueFromSha(c.bookSha256) : null
    return (
      <li key={c.id} className="group relative">
        {renaming === c.id ? (
          <Input
            autoFocus
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onRename(c.id, renameText.trim() || c.title)
                setRenaming(null)
              } else if (e.key === 'Escape') {
                setRenaming(null)
              }
            }}
            onBlur={() => {
              onRename(c.id, renameText.trim() || c.title)
              setRenaming(null)
            }}
            className="h-8 text-sm"
            aria-label="Rename conversation"
          />
        ) : (
          <button
            type="button"
            onClick={() => onOpen(c.id)}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'w-full rounded-lg px-3 py-2 pr-[5.6rem] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              active ? 'bg-muted' : 'hover:bg-muted/60',
            )}
          >
            <span className="block truncate text-sm" title={c.title}>
              {c.title}
            </span>
            <span className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              {hue && <CoverDot hue={hue} className="size-3" />}
              <span className="min-w-0 truncate">{c.bookTitle ?? 'Conversation'}</span>
              <span aria-hidden className="shrink-0">·</span>
              <span className="shrink-0 font-mono text-xs whitespace-nowrap">
                {relTime(c.lastActivityAt || c.createdAt)}
              </span>
            </span>
          </button>
        )}
        {renaming !== c.id && (
          <span className="absolute top-1 right-1 flex gap-1 pr-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={c.pinned ? 'Unpin conversation' : 'Pin conversation'}
              onClick={() => onTogglePin(c)}
              className="text-muted-foreground"
            >
              {c.pinned ? <PinOff /> : <Pin />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Rename conversation"
              onClick={() => {
                setRenaming(c.id)
                setRenameText(c.title)
              }}
              className="text-muted-foreground"
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${c.title}`}
              onClick={() => onDelete(c)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 />
            </Button>
          </span>
        )}
      </li>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {actionError && (
          <p className="px-3 pb-1 text-xs text-destructive" role="alert">
            {actionError}
          </p>
        )}
        {loading ? (
          <div className="space-y-2 px-3 pt-1">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        ) : error ? (
          <div className="space-y-2 px-3 pt-1">
            <p className="text-xs text-destructive">{error}</p>
            <Button variant="outline" size="xs" onClick={onRetry}>
              Retry
            </Button>
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-3 pt-1 text-xs leading-relaxed text-muted-foreground/80">
            Questions you ask are kept here. Pin the ones you keep coming back to.
          </p>
        ) : (
          <>
            {pinned.length > 0 && (
              <section className="mb-1">
                <div className="px-3 pb-1 pt-1">
                  <SmallCaps>Pinned</SmallCaps>
                </div>
                <ul>{pinned.map(row)}</ul>
              </section>
            )}
            <section>
              {pinned.length > 0 && (
                <div className="px-3 pb-1 pt-1">
                  <SmallCaps>Recent</SmallCaps>
                </div>
              )}
              <ul>{rest.map(row)}</ul>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

/* ── composer ──────────────────────────────────────────────────────────── */

/* ── page ──────────────────────────────────────────────────────────────── */

function ThreadSkeleton() {
  return (
    <div className="space-y-4">
      <div className="ml-auto w-2/3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="ml-auto h-4 w-3/4" />
      </div>
      <div className="w-3/4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

function QuietState({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="font-heading text-lg">{title}</p>
      <div className="max-w-prose text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

export function Ask() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Ask fuses text search with vector search, so a book without a finished
  // search index would quietly answer from half its evidence. A book that
  // isn't ready simply isn't offered.
  const { books: allBooks, loading: booksLoading } = useBooks()
  const books = allBooks?.filter((b) => b.ready) ?? null
  const { config, loading: configLoading } = useConfig()

  const [pickedSha, setPickedSha] = useState<string | null>(() => searchParams.get('book'))
  const [aboutPage, setAboutPage] = useState<number | null>(() => {
    const n = Number.parseInt(searchParams.get('page') ?? '', 10)
    return Number.isNaN(n) || n < 1 ? null : n
  })

  // No default book: the hero picker is the only way a new conversation gets one.
  const activeSha = pickedSha && books?.some((b) => b.sha256 === pickedSha) ? pickedSha : null
  const activeBook = books?.find((b) => b.sha256 === activeSha) ?? null
  const configured = config !== null && config.apiBaseURL !== '' && config.hasAPIKey

  const {
    conversations,
    loading: convLoading,
    error: convError,
    refetch: refetchConversations,
  } = useConversations()

  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('c'))
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [readingPages, setReadingPages] = useState<number[] | null>(null)
  const [askError, setAskError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null)
  const [railOpen, setRailOpen] = useState(true)

  const sortedConversations = useMemo(() => {
    const activityMs = (c: Conversation) => Date.parse(c.lastActivityAt || c.createdAt) || 0
    return [...(conversations ?? [])].sort((a, b) => activityMs(b) - activityMs(a))
  }, [conversations])
  const selected = sortedConversations.find((c) => c.id === selectedId) ?? null

  const del = useMutation((input: { sha: string; id: string }) =>
    api.deleteConversation(input.sha, input.id),
  )
  const update = useMutation((input: { id: string; body: { title?: string; pinned?: boolean } }) =>
    api.updateConversation(input.id, input.body),
  )
  const abortRef = useRef<AbortController | null>(null)
  const threadSeq = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedBottom = useRef(true)

  const syncUrl = (id: string | null, replace: boolean, sha: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (sha) next.set('book', sha)
    else next.delete('book')
    if (id) {
      next.set('c', id)
      next.delete('page')
    } else {
      next.delete('c')
    }
    setSearchParams(next, { replace })
  }

  const open = (id: string | null, shaOverride?: string) => {
    const seq = ++threadSeq.current
    abortRef.current?.abort()
    abortRef.current = null
    let sha: string | null
    if (shaOverride !== undefined) {
      sha = shaOverride
      setPickedSha(shaOverride)
    } else if (id === null) {
      // New conversation: back to the landing, no book preselected.
      sha = null
      setPickedSha(null)
    } else {
      sha = activeSha
    }
    setSelectedId(id)
    syncUrl(id, false, sha)
    setStreaming(false)
    setReadingPages(null)
    setAskError(null)
    setThreadError(null)
    setMessages([])
    if (id === null) return
    setThreadLoading(true)
    void api
      .conversationById(id)
      .then(
        (r) => {
          if (seq !== threadSeq.current) return
          // Opening a conversation selects and locks its book.
          if (r.conversation.bookSha256) setPickedSha(r.conversation.bookSha256)
          setMessages(r.messages.map(messageFromApi))
        },
        (e: Error) => {
          if (seq !== threadSeq.current) return
          setThreadError(e.message)
        },
      )
      .finally(() => {
        if (seq !== threadSeq.current) return
        setThreadLoading(false)
      })
  }

  // The last question this visit tried to send, so a failed stream can be
  // retried with exactly what was asked, page anchor included.
  const [lastAsk, setLastAsk] = useState<{ text: string; page: number | null } | null>(null)

  const send = (resend?: { text: string; page: number | null }) => {
    if (!activeSha || !configured || streaming || threadLoading) return
    const text = (resend?.text ?? draft).trim()
    if (!text) return
    const page = resend ? resend.page : aboutPage
    const seq = ++threadSeq.current
    const live = () => seq === threadSeq.current
    const controller = new AbortController()
    abortRef.current = controller
    const wasNew = selectedId === null
    let convId = selectedId
    let didAbort = false
    let hadError = false
    setStreaming(true)
    setReadingPages(null)
    setAskError(null)
    setDraft('')
    setAboutPage(null)
    setLastAsk({ text, page })
    setMessages((m) => [
      ...m,
      { id: null, role: 'user', text },
      { id: null, role: 'assistant', segments: [] },
    ])
    // The pages retrieval chose ride on the bubble, so its consulted strip
    // is what actually happened rather than a re-parse of the prose.
    const rememberRetrieved = (pages: number[]) =>
      setMessages((m) => {
        if (m.length === 0 || m[m.length - 1].role !== 'assistant') return m
        const last = m[m.length - 1]
        return [...m.slice(0, -1), { ...last, retrieved: pages }]
      })
    // Every typed event folds into the trailing assistant bubble.
    const fold = (ev: ChatEvent) =>
      setMessages((m) => {
        if (m.length === 0 || m[m.length - 1].role !== 'assistant') return m
        const last = m[m.length - 1]
        return [...m.slice(0, -1), { ...last, segments: applyChatEvent(last.segments ?? [], ev) }]
      })
    void askBook(
      activeSha,
      { question: text, conversationId: selectedId, page: page ?? undefined },
      (ev) => {
        if (!live()) return
        switch (ev.type) {
          case 'meta':
            convId = ev.conversationId
            setReadingPages(ev.pages ?? [])
            rememberRetrieved(ev.pages ?? [])
            if (wasNew) {
              setSelectedId(ev.conversationId)
              syncUrl(ev.conversationId, true, activeSha)
            }
            break
          case 'error':
            hadError = true
            setAskError(ev.error)
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
        if (!live()) return
        if (isAbortError(e)) {
          didAbort = true
          return
        }
        setAskError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!live()) return
        abortRef.current = null
        setStreaming(false)
        setReadingPages(null)
        void refetchConversations()
        setMessages((m) =>
          m.length > 0 &&
          m[m.length - 1].role === 'assistant' &&
          (m[m.length - 1].segments?.length ?? 0) === 0
            ? m.slice(0, -1)
            : m,
        )
        // Settle the thread from the server (message ids, citations) after a
        // clean finish. After an abort or error the locally shown content
        // stays exactly as streamed.
        if (!didAbort && !hadError && convId) {
          void api.conversationById(convId).then(
            (r) => {
              if (!live()) return
              setMessages(r.messages.map(messageFromApi))
            },
            () => {
              // keep the streamed content
            },
          )
        }
      })
  }

  const openRef = useRef(open)
  openRef.current = open
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId
  const urlConversation = searchParams.get('c')
  const initialConversation = useRef<string | null>(urlConversation)
  const lastUrlConversation = useRef<string | null>(urlConversation)
  useEffect(() => {
    if (initialConversation.current) openRef.current(initialConversation.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (urlConversation === lastUrlConversation.current) return
    lastUrlConversation.current = urlConversation
    if ((urlConversation ?? null) === (selectedRef.current ?? null)) return
    openRef.current(urlConversation)
  }, [urlConversation])

  const stop = () => abortRef.current?.abort()

  const pickBook = (sha: string) => {
    if (sha === activeSha) return
    setPickedSha(sha)
    setAboutPage(null)
    open(null, sha)
  }

  const togglePin = (c: Conversation) => {
    void update.mutate({ id: c.id, body: { pinned: !c.pinned } }).then((r) => {
      if (r) refetchConversations()
    })
  }

  const rename = (id: string, title: string) => {
    const current = conversations?.find((c) => c.id === id)
    if (!current || title === '' || title === current.title) return
    void update.mutate({ id, body: { title } }).then((r) => {
      if (r) refetchConversations()
    })
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const id = pendingDelete.id
    void del.mutate({ sha: pendingDelete.bookSha256 ?? (activeSha ?? ''), id }).then((ok) => {
      if (!ok) return
      refetchConversations()
      setPendingDelete(null)
      if (selectedId === id) open(null)
    })
  }

  useEffect(() => {
    if (pinnedBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, readingPages, threadLoading])

  useEffect(
    () => () => {
      threadSeq.current++
      abortRef.current?.abort()
    },
    [],
  )

  if (configLoading) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center">
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-4 animate-spin text-primary" />
          Checking the connection…
        </p>
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="h-[calc(100dvh-3.5rem)]">
        <QuietState icon={<Sparkles className="size-5" />} title="Ask needs a connection">
          <p>
            Answers come from a model service you point PSet at. It takes a minute to{' '}
            <Link
              to="/settings"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              set it up in Settings
            </Link>
            .
          </p>
        </QuietState>
      </div>
    )
  }

  if (!booksLoading && (!books || books.length === 0)) {
    return (
      <div className="h-[calc(100dvh-3.5rem)]">
        <QuietState
          icon={<BookOpen className="size-5" />}
          title={allBooks && allBooks.length > 0 ? 'No books are ready yet' : 'No books yet'}
        >
          <p>
            Ask answers from the books in your library.{' '}
            <Link
              to="/?import=1"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Import one
            </Link>{' '}
            to get started.
          </p>
        </QuietState>
      </div>
    )
  }

  const hero = !threadLoading && !threadError && messages.length === 0 && selectedId === null
  // The bar names the book you are asking: a thread carries its own book,
  // the landing shows the picked one, before any pick there is none.
  const barSha = selected?.bookSha256 ?? activeBook?.sha256 ?? null
  const barHue = barSha ? coverHueFromSha(barSha) : null
  const barTitle = selected ? selected.title : activeBook ? activeBook.title : 'New conversation'

  const historyProps = {
    conversations: sortedConversations,
    selectedId,
    loading: convLoading,
    error: convError?.message ?? null,
    actionError: update.state === 'error' && update.error ? update.error.message : null,
    onRetry: refetchConversations,
    onOpen: (id: string) => open(id),
    onDelete: setPendingDelete,
    onTogglePin: togglePin,
    onRename: rename,
  }

  const composer = (
    <ChatComposer
      value={draft}
      onChange={setDraft}
      onSend={send}
      canSend={activeBook !== null && draft.trim().length > 0 && !streaming}
      sendLabel="Send question"
      streaming={streaming}
      onStop={stop}
      ariaLabel="Ask a question"
      placeholder={
        hero
          ? activeBook
            ? `Ask about ${activeBook.title}…`
            : 'Type your question, then pick a book…'
          : 'Ask a follow-up…'
      }
      rows={hero ? 3 : 1}
      book={
        hero
          ? { books, loading: booksLoading, picked: activeBook, onPick: pickBook }
          : undefined
      }
      notice={
        aboutPage !== null ? (
          <div className="px-1 pb-2 pt-1">
            <span className="inline-flex items-center gap-2 rounded-4xl border bg-muted px-3 py-1 text-xs text-muted-foreground">
              Asking about page <span className="font-mono text-foreground">{aboutPage}</span>
              <button
                type="button"
                onClick={() => setAboutPage(null)}
                aria-label="Stop asking about this page"
                className="rounded-full p-1 transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          </div>
        ) : undefined
      }
      autoFocus
    />
  )

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-96 flex-col lg:flex-row">
      <h1 className="sr-only">Ask</h1>

      <aside className={cn('hidden shrink-0 flex-col border-r lg:flex', railOpen ? 'w-72' : 'lg:hidden')}>
        <HistoryPanel {...historyProps} />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
          {railOpen ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Hide conversations"
              onClick={() => setRailOpen(false)}
              className="hidden lg:inline-flex"
            >
              <PanelLeftClose />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Show conversations"
              onClick={() => setRailOpen(true)}
              className="hidden lg:inline-flex"
            >
              <PanelLeftOpen />
            </Button>
          )}
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {barHue !== null && <CoverDot hue={barHue} className="size-4 shrink-0" />}
            <span
              className="min-w-0 truncate text-sm text-muted-foreground"
              title={barTitle}
            >
              {barTitle}
            </span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => open(null)}
            aria-label="New conversation"
            className="shrink-0"
          >
            <Plus />
          </Button>
        </div>

        {hero ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
            <h2 className="text-center font-heading text-2xl font-medium tracking-tight text-balance md:text-3xl">
              What do you want to learn?
            </h2>
            <p className="mt-2 max-w-md text-center font-heading text-base text-muted-foreground italic text-balance">
              Pick a book, ask anything, and get answers that cite the exact pages they come from.
            </p>
            <div className="mt-6 w-full max-w-2xl">{composer}</div>
            <p className="mt-3 text-xs text-muted-foreground">Enter to send · Shift+Enter for a new line</p>
            {askError && (
              <div role="alert" className="mt-2 flex flex-col items-center gap-2">
                <p className="text-sm text-destructive">{askError}</p>
                {lastAsk && (
                  <Button variant="outline" size="sm" onClick={() => send(lastAsk)}>
                    Retry
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto"
              onScroll={(e) => {
                const el = e.currentTarget
                pinnedBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
              }}
            >
              <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 md:px-6">
                {threadLoading ? (
                  <ThreadSkeleton />
                ) : threadError ? (
                  <div className="flex flex-col items-center gap-2 py-16 text-center">
                    <p className="text-sm text-destructive" role="alert">
                      {threadError}
                    </p>
                    <Button variant="outline" size="sm" onClick={() => open(selectedId)}>
                      Retry
                    </Button>
                  </div>
                ) : messages.length === 0 ? (
                  <QuietState
                    icon={<Sparkles className="size-5" />}
                    title={activeBook ? `Ask about ${activeBook.title}` : 'Ask'}
                  >
                    <p>Answers come from this book's pages and link back to them.</p>
                  </QuietState>
                ) : (
                  messages.map((m, i) => (
                    <div
                      key={`${i}-${m.id ?? 'local'}`}
                      className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                    >
                      {m.role === 'user' ? (
                        <UserBubble text={m.text ?? ''} />
                      ) : (
                        <AssistantMessage
                          msg={m}
                          sha={activeSha ?? ''}
                          streaming={streaming && i === messages.length - 1}
                          readingPages={readingPages}
                        />
                      )}
                    </div>
                  ))
                )}
                {askError && (
                  <div
                    role="alert"
                    className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive"
                  >
                    <p>{askError}</p>
                    {lastAsk && (
                      <div>
                        <Button variant="outline" size="sm" onClick={() => send(lastAsk)}>
                          Retry
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="shrink-0 border-t bg-background/80 px-4 py-3 backdrop-blur md:px-6">
              <div className="mx-auto w-full max-w-3xl">
                {composer}
                <p className="px-1 pt-2 text-xs text-muted-foreground">
                  Enter to send · Shift+Enter for a new line
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) {
            setPendingDelete(null)
            del.reset()
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Delete conversation?</DialogTitle>
            <DialogDescription>
              “{pendingDelete?.title}” and its messages will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={del.state === 'loading'}>
              {del.state === 'loading' && <LoaderCircle className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
          {del.state === 'error' && del.error && (
            <p className="text-xs text-destructive" role="alert">
              {del.error.message}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
