import {
  cloneElement,
  isValidElement,
  useMemo,
  type ReactElement,
  type ReactNode,
} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import katex from 'katex'
import { Sigma } from 'lucide-react'

import type { EnvelopeSegment } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Message-scoped citation dedupe: a pill is emitted only when its page set
 *  differs from the previous pill's. */
export interface Seen {
  last: number[] | null
}

/** One citation marker: `[p. 58]`, `[pp. 58–61]`, `[page 12]`, … (single page
 *  or range; en/em/hyphen all tolerated as the range dash). */
const CITATION = /\[pp?(?:age)?\.?\s*(\d{1,4})(?:\s*[–—-]\s*(\d{1,4}))?\s*\]/gi
/** Run of adjacent markers separated only by whitespace and/or commas or
 *  semicolons, optionally with the word "and" — merged into one pill. */
const CITATION_RUN = new RegExp(
  `${CITATION.source}(?:(?:[\\s,;]+and[\\s,;]+|[\\s,;]+)${CITATION.source})*`,
  'gi',
)

/** Sorted, deduped pages expanded from the markers in one run (ranges flattened). */
function pagesOfRun(raw: string): number[] {
  const pages = new Set<number>()
  for (const m of raw.matchAll(new RegExp(CITATION.source, 'gi'))) {
    const start = Number.parseInt(m[1] ?? '', 10)
    if (Number.isNaN(start)) continue
    const end = m[2] !== undefined ? Number.parseInt(m[2], 10) : start
    if (!Number.isNaN(end) && end >= start) {
      for (let p = start; p <= end; p += 1) pages.add(p)
    } else {
      pages.add(start)
    }
  }
  return [...pages].sort((a, b) => a - b)
}

function samePages(a: number[], b: number[] | null): boolean {
  if (b === null || a.length !== b.length) return false
  return a.every((p, i) => p === b[i])
}

/** Consecutive pages compressed into runs with an en dash: ["58", "58–61", "63"]. */
function pageRuns(pages: number[]): string[] {
  const runs: string[] = []
  let i = 0
  while (i < pages.length) {
    let j = i
    while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j += 1
    runs.push(i === j ? String(pages[i]) : `${pages[i]}–${pages[j]}`)
    i = j + 1
  }
  return runs
}

/** "p. 58" for a single page, "pp. 58–61, 63" for a set of runs. */
function formatPages(pages: number[]): string {
  const joined = pageRuns(pages).join(', ')
  return pages.length === 1 ? `p. ${joined}` : `pp. ${joined}`
}

/** Inert citation pills; adjacent markers merge into one pill, and a pill is
 *  emitted only when its page set differs from the previous pill's. */
function citeChildren(children: ReactNode, seen: Seen): ReactNode {
  const walk = (node: ReactNode, key: string): ReactNode => {
    if (typeof node === 'string') {
      const out: ReactNode[] = []
      let last = 0
      let k = 0
      for (const run of node.matchAll(new RegExp(CITATION_RUN.source, 'gi'))) {
        const start = run.index ?? 0
        if (start > last) out.push(node.slice(last, start))
        last = start + run[0].length
        const pages = pagesOfRun(run[0])
        if (pages.length === 0) {
          out.push(run[0])
        } else if (!samePages(pages, seen.last)) {
          seen.last = pages
          out.push(
            <span
              key={`${key}:${k++}`}
              title={pages.length === 1 ? `Page ${pages[0]}` : `Pages ${pageRuns(pages).join(', ')}`}
              className="mx-1 inline-flex cursor-default items-baseline rounded-full border bg-muted/40 px-2 font-mono text-[0.65rem] leading-4 text-primary"
            >
              {formatPages(pages)}
            </span>,
          )
        }
      }
      if (last < node.length) out.push(node.slice(last))
      return out
    }
    if (isValidElement(node)) {
      const el = node as ReactElement<{ children?: ReactNode }>
      if (el.props.children != null) {
        return cloneElement(el, { children: walk(el.props.children, key) })
      }
    }
    return node
  }
  if (Array.isArray(children)) return children.map((c, i) => walk(c, String(i)))
  return walk(children, '0')
}

export function SmallCaps({ children }: { children: ReactNode }) {
  return (
    <span className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </span>
  )
}

/** One line of heading text where $…$ spans render as inline math, so a
 *  card title like "Left mesh KVL (clockwise $I_a$)" reads as typeset
 *  symbols instead of raw TeX. Failed renders fall back to the raw span. */
export function MathTitle({ text }: { text: string }) {
  const parts = useMemo(() => {
    return text.split(/(\$[^$]+\$)/g).map((part, i) => {
      if (!part.startsWith('$') || !part.endsWith('$') || part.length < 3) {
        return <span key={i}>{part}</span>
      }
      try {
        const html = katex.renderToString(part.slice(1, -1), {
          displayMode: false,
          throwOnError: false,
        })
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
      } catch {
        return <span key={i}>{part}</span>
      }
    })
  }, [text])
  return <span className="[&_.katex]:text-[1.05em]">{parts}</span>
}

export function AnswerText({ text, seen }: { text: string; seen: Seen }) {
  const c = (children: ReactNode) => citeChildren(children, seen)
  return (
    <div className="space-y-3 [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:rounded-xl [&_.katex-display]:border [&_.katex-display]:bg-muted/30 [&_.katex-display]:px-4 [&_.katex-display]:py-3 [&_.katex-display]:text-left">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="leading-relaxed first:mt-0">{c(children)}</p>,
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-2">{c(children)}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-2">{c(children)}</ol>,
          li: ({ children }) => <li className="leading-relaxed pl-1">{c(children)}</li>,
          strong: ({ children }) => <strong className="font-semibold">{c(children)}</strong>,
          a: ({ children, href }) => (
            <a href={href} className="text-primary underline underline-offset-2">
              {c(children)}
            </a>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-1 font-mono text-[0.8em]">{children}</code>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

/** Bare TeX rendered straight through KaTeX in display mode — no $$
 *  delimiters anywhere, so nothing can mis-pair. */
function DisplayMath({ tex }: { tex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { displayMode: true, throwOnError: false })
    } catch {
      return null
    }
  }, [tex])
  if (html === null) {
    return <code className="block overflow-x-auto rounded-xl border bg-muted/30 px-4 py-3 font-mono text-xs">{tex}</code>
  }
  return (
    <div
      className="overflow-x-auto rounded-xl border bg-muted/30 px-4 py-3 text-left [&_.katex-display]:my-0"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function EquationCard({
  title,
  equations,
  note,
  seen,
}: {
  title: string
  equations: string[]
  note?: string
  seen: Seen
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
        <Sigma aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <SmallCaps>Equation</SmallCaps>
        <span className="min-w-0 flex-1 truncate pl-1 font-heading text-sm font-medium">
          <MathTitle text={title || 'Equation'} />
        </span>
      </div>
      {equations.length > 0 && (
        <div className="space-y-2 px-3 py-3 sm:px-4">
          {equations.map((t, i) => (
            <DisplayMath key={i} tex={t} />
          ))}
        </div>
      )}
      {note && (
        <div className="border-t px-4 py-2 text-xs leading-relaxed text-muted-foreground italic">
          <AnswerText text={note} seen={seen} />
        </div>
      )}
    </div>
  )
}

const theoremStyles = {
  theorem: { box: 'border-indigo-400/50 bg-indigo-500/[0.05]', accent: 'bg-indigo-400', label: 'Theorem' },
  definition: { box: 'border-teal-400/50 bg-teal-500/[0.05]', accent: 'bg-teal-400', label: 'Definition' },
} as const

export function TheoremCard({
  variant,
  title,
  statement,
  seen,
}: {
  variant: 'theorem' | 'definition'
  title: string
  statement: string
  seen: Seen
}) {
  const s = theoremStyles[variant]
  return (
    <div className={cn('overflow-hidden rounded-xl border', s.box)}>
      <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: 'inherit' }}>
        <span aria-hidden className={cn('h-4 w-1 rounded-full', s.accent)} />
        <SmallCaps>{s.label}</SmallCaps>
        <span className="min-w-0 flex-1 truncate pl-1 font-heading text-sm font-medium">
          <MathTitle text={title || s.label} />
        </span>
      </div>
      {statement !== '' && (
        <div className="px-4 py-3">
          <AnswerText text={statement} seen={seen} />
        </div>
      )}
    </div>
  )
}

export function StepsCard({
  title,
  steps,
  note,
  seen,
}: {
  title: string
  steps: string[]
  note?: string
  seen: Seen
}) {
  return (
    <div className="rounded-xl border">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
        <SmallCaps>Worked steps</SmallCaps>
        <span className="min-w-0 flex-1 truncate pl-1 font-heading text-sm font-medium">
          <MathTitle text={title || 'Step by step'} />
        </span>
      </div>
      {steps.length > 0 && (
        <ol className="space-y-3 px-4 py-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[0.65rem] text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                <AnswerText text={s} seen={seen} />
              </div>
            </li>
          ))}
        </ol>
      )}
      {note && (
        <div className="border-t px-4 py-2 text-xs leading-relaxed text-muted-foreground italic">
          <AnswerText text={note} seen={seen} />
        </div>
      )}
    </div>
  )
}

export function NoteCard({
  title,
  body,
  seen,
}: {
  title: string
  body: string[]
  seen: Seen
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
      <SmallCaps>Note</SmallCaps>
      <div className="mt-2 space-y-2">
        {title !== '' && <p className="text-sm leading-relaxed font-medium">{title}</p>}
        {body.map((line, i) => (
          <AnswerText key={i} text={line} seen={seen} />
        ))}
      </div>
    </div>
  )
}

/** One envelope segment rendered as its card. Both chats use this, so an
 *  equation looks the same wherever it lands. */
export function EnvelopeBlock({ seg, seen }: { seg: EnvelopeSegment; seen: Seen }) {
  switch (seg.kind) {
    case 'equation':
      return (
        <EquationCard
          title={seg.payload.title}
          equations={seg.payload.equations}
          note={seg.payload.note}
          seen={seen}
        />
      )
    case 'steps':
      return (
        <StepsCard
          title={seg.payload.title}
          steps={seg.payload.steps}
          note={seg.payload.note}
          seen={seen}
        />
      )
    case 'theorem':
    case 'definition':
      return (
        <TheoremCard
          variant={seg.kind}
          title={seg.payload.title}
          statement={seg.payload.statement}
          seen={seen}
        />
      )
    case 'note':
      return <NoteCard title={seg.payload.title} body={seg.payload.body} seen={seen} />
  }
}

