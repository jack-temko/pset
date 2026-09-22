import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import type { CodeCard, PlotCard, Segment, StatementCard, StepsCard, TableCard } from '@/api/gen/cards'
import { AnswerTable, CodeBlock, PageRef, Plot, Statement, WorkedSteps } from '@/components/transcript'
import { Skeleton } from '@/components/skeleton'
import { usePageOffset } from '@/lib/pages'

/**
 * What the engine wrote, rendered: prose as markdown with KaTeX math and
 * page chips, cards as the transcript's cards. The engine never sends a
 * fence; the segments are already typed. Citations arrive as [p. N], N a
 * PDF page, and become chips that jump the scan (they take printed pages).
 */
type Jump = (printed: number) => void

const citation = /\[(pp?)\.\s*(\d+)(?:\s*[–-]\s*\d+)?\]/g

export function Prose({ text, onJump, inline }: { text: string; onJump?: Jump; inline?: boolean }) {
  const offset = usePageOffset()
  const md = text.replace(citation, (_m, _pp, n) => `[p. ${n}](#pdf-${n})`)
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: ({ children }) => (inline ? <>{children}</> : <p>{children}</p>),
        // The reset strips list markers; prose wants them back.
        ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
        a: ({ href, children }) => {
          const m = href?.match(/^#pdf-(\d+)$/)
          if (m) return <PageRef page={Number(m[1]) - offset} onJump={onJump} />
          return (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
              {children}
            </a>
          )
        },
      }}
    >
      {md}
    </ReactMarkdown>
  )
}

function Card({ s, onJump }: { s: Segment; onJump?: Jump }) {
  const offset = usePageOffset()
  switch (s.kind) {
    case 'statement': {
      const c = s.card as StatementCard
      return (
        <Statement kind={c.kind} number={c.number} name={c.name} page={c.page - offset} onJump={onJump}>
          <Prose text={c.text} onJump={onJump} />
        </Statement>
      )
    }
    case 'steps': {
      const c = s.card as StepsCard
      return (
        <WorkedSteps
          steps={c.steps.map((st) => ({ math: st.math, why: st.why ? <Prose text={st.why} onJump={onJump} inline /> : undefined }))}
        />
      )
    }
    case 'plot': {
      const c = s.card as PlotCard
      return <Plot title={c.title} x={c.x} y={c.y} series={c.series} />
    }
    case 'table': {
      const c = s.card as TableCard
      return (
        <AnswerTable
          columns={c.columns}
          rows={c.rows.map((r) => r.map((cell, i) => <Prose key={i} text={cell} onJump={onJump} inline />))}
        />
      )
    }
    case 'code': {
      const c = s.card as CodeCard
      return <CodeBlock code={c.code} language={c.language} />
    }
  }
  return null
}

export function Segments({ segments, onJump }: { segments: Segment[]; onJump?: Jump }) {
  return (
    <>
      {segments.map((s, i) =>
        s.type === 'prose' ? (
          <Prose key={i} text={s.text ?? ''} onJump={onJump} />
        ) : s.type === 'card' ? (
          <Card key={i} s={s} onJump={onJump} />
        ) : (
          // A card that couldn't be made valid: kept as written, quietly.
          <CodeBlock key={i} code={s.text ?? ''} language={s.kind} />
        ),
      )}
    </>
  )
}

const CARD_NAMES: Record<string, string> = {
  statement: 'statement',
  steps: 'worked steps',
  plot: 'plot',
  table: 'table',
  code: 'code',
}

/**
 * A card being written: its skeleton in roughly the card's own shape, with
 * a label saying what's coming ("Writing a plot"), and "Tidying" while a
 * malformed one is repaired. The card replaces it in place.
 */
export function CardSkeleton({ kind, repairing }: { kind: string; repairing: boolean }) {
  const name = CARD_NAMES[kind] ?? 'card'
  const rows = kind === 'steps' ? 3 : kind === 'table' ? 4 : kind === 'code' ? 5 : 2
  return (
    <div className="overflow-hidden rounded-md border bg-card" aria-busy="true">
      <div className="border-b bg-card-header px-card py-2 text-xs text-muted-foreground">
        {repairing ? `Tidying the ${name}` : `Writing ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`}
      </div>
      {kind === 'plot' ? (
        <Skeleton className="m-card block h-48 w-auto rounded-sm" />
      ) : (
        <div className="space-y-2 p-card text-base">
          {Array.from({ length: rows }, (_, i) => (
            <p key={i}>
              <Skeleton className={i === rows - 1 ? 'h-3 w-2/3' : 'h-3 w-full'} />
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
