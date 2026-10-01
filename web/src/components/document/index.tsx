import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { Block, Run } from '@/api/gen/doc'
import { Skeleton } from '@/components/skeleton'
import {
  AnswersCard,
  AnswerTable,
  Callout,
  CodeBlock,
  GuidePara,
  MathDisplay,
  MathInline,
  Note,
  PageRef,
  PartHeader,
  Plot,
  Statement,
  StepHeading,
  WorkedSteps,
} from '@/components/transcript'
import { cn } from '@/lib/utils'

import { selBlock, selLine, selPart, selStep } from './selection'
import { Selectable, type AskWiring, type Scope } from './selectable'
import { answersOf, buildTree, type Group, type Section } from './tree'

/**
 * A document of blocks, drawn. The server has already split every text
 * field into runs and checked the math, so nothing here parses anything:
 * a run is text, math, a citation, or math that failed and shows as its
 * source. The tree comes from the part and step markers (see `buildTree`).
 * Spec: design/workspace.md, "Walkthrough".
 */
type Jump = (pdf: number) => void

// ---------------------------------------------------------------- runs

/** Runs, inline: text with its marks, math, citation chips. */
export function Runs({ runs, onJump }: { runs: Run[]; onJump?: Jump }) {
  // Punctuation right after inline math stays with it: a line may not
  // begin with the comma that follows a formula.
  const out: ReactNode[] = []
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i]
    const next = runs[i + 1]
    const glue = r.m !== undefined && !r.d && !r.raw && next?.t !== undefined && !next.code ? /^[,.;:!?)\]]+/.exec(next.t) : null
    if (glue) {
      out.push(
        <span key={i} className="whitespace-nowrap">
          <RunView r={r} onJump={onJump} />
          {glue[0]}
        </span>,
      )
      runs = [...runs.slice(0, i + 1), { ...next, t: next.t!.slice(glue[0].length) }, ...runs.slice(i + 2)]
      continue
    }
    out.push(<RunView key={i} r={r} onJump={onJump} />)
  }
  return <>{out}</>
}

function RunView({ r, onJump }: { r: Run; onJump?: Jump }) {
  if (r.m !== undefined) {
    if (r.raw)
      // Math that would not parse, even after repair: its source, quiet.
      return <code className="rounded-sm bg-muted/50 px-1 font-mono text-xs text-muted-foreground">{r.m}</code>
    return r.d ? <MathDisplay tex={r.m} /> : <MathInline tex={r.m} />
  }
  if (r.cite) {
    return (
      <>
        <PageRef pdf={r.cite} onJump={onJump} />
        {r.citeTo ? (
          <>
            –<PageRef pdf={r.citeTo} onJump={onJump} />
          </>
        ) : null}
      </>
    )
  }
  const lines = (r.t ?? '').split('\n')
  const text = lines.map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {line}
    </Fragment>
  ))
  if (r.code) return <code className="rounded-sm bg-muted/50 px-1 font-mono text-xs">{text}</code>
  if (r.b) return <strong className="font-semibold">{text}</strong>
  if (r.i) return <em>{text}</em>
  return <>{text}</>
}

// ---------------------------------------------------------------- blocks

/** What a block is drawn as, plus where it is (`reading`: a guide's
 *  paragraphs read at the guide's size; Ask's stay compact). */
type Look = { reading?: boolean; onJump?: Jump }

function Para({ runs, look }: { runs: Run[]; look: Look }) {
  const inner = <Runs runs={runs} onJump={look.onJump} />
  return look.reading ? <GuidePara>{inner}</GuidePara> : <p>{inner}</p>
}

/** One block, as a component. `part` and `step` are drawn by the tree; a
 *  stray one (a block list not built into a tree) draws as its heading.
 *  `pick` is the selection wiring when the block sits in a document
 *  that selects: a derivation passes it down so one of its lines can be
 *  picked on their own. */
export function BlockView({ block, look, pick }: { block: Block; look: Look; pick?: { scope: Scope; index: number } }) {
  const jump = look.onJump
  switch (block.type) {
    case 'hint':
    case 'para':
      return <Para runs={block.text} look={look} />
    case 'note':
      return (
        <Note>
          <Runs runs={block.text} onJump={jump} />
        </Note>
      )
    case 'math':
      return block.raw ? <RawTeX tex={block.tex} /> : <MathDisplay tex={block.tex} />
    case 'derivation':
      return (
        <WorkedSteps
          steps={block.steps.map((s) => ({
            math: s.tex,
            raw: s.raw,
            why: s.why?.length ? <Runs runs={s.why} onJump={jump} /> : undefined,
          }))}
          linePick={pick ? { scope: pick.scope, line: (n: number) => selLine(pick.index, n) } : undefined}
        />
      )
    case 'callout':
      return (
        <Callout tone={block.tone} title={block.title?.length ? <Runs runs={block.title} onJump={jump} /> : undefined}>
          <Para runs={block.text} look={look} />
        </Callout>
      )
    case 'statement':
      return (
        <Statement kind={block.kind.charAt(0).toUpperCase() + block.kind.slice(1)} number={block.number} name={block.name} page={block.page} onJump={jump}>
          <Para runs={block.text} look={{ ...look, reading: false }} />
        </Statement>
      )
    case 'table':
      return (
        <AnswerTable
          // Headers carry math too, so they render like the cells.
          columns={block.columns.map((c, i) => (
            <Runs key={i} runs={c} onJump={jump} />
          ))}
          rows={block.rows.map((r) => r.map((cell, i) => <Runs key={i} runs={cell} onJump={jump} />))}
        />
      )
    case 'plot':
      return <Plot title={block.title ?? ''} x={block.x} y={block.y} series={block.series} marks={block.marks} />
    case 'code':
      return <CodeBlock code={block.code} language={block.language} />
    case 'answer':
      // In place, at the end of its part: the same card the Answers veil
      // collects, one row.
      return (
        <AnswersCard
          answers={[{ label: block.label, children: <Para runs={block.text} look={{ ...look, reading: false }} /> }]}
        />
      )
    case 'raw':
      // A block that could not be made valid: what the model wrote, muted.
      return <CodeBlock code={block.text} language={block.of} />
    case 'part':
      return <PartHeader label={block.label} title={<Runs runs={block.title} onJump={jump} />} first />
    case 'step':
      return <StepHeading number={1} title={<Runs runs={block.title} onJump={jump} />} />
  }
  return null
}

function RawTeX({ tex }: { tex: string }) {
  return <code className="block overflow-x-auto font-mono text-xs text-muted-foreground">{tex}</code>
}

// ---------------------------------------------------------------- document

/**
 * The whole document. `before(i)` is drawn ahead of the block at index `i`
 * (and, once, at `blocks.length`): where Ask's step feed sits between the
 * blocks it happened between. `reading` draws paragraphs at the guide's
 * reading size; Ask's answers stay compact. With `ask` every element is
 * selectable: hover washes it, a click picks it, and the toolbar on the
 * outline asks about it (./selectable).
 */
export function Document({
  blocks,
  onJump,
  reading,
  before,
  ask,
}: {
  blocks: Block[]
  onJump?: Jump
  reading?: boolean
  before?: (index: number) => ReactNode
  ask?: AskWiring
}) {
  const tree = useMemo(() => buildTree(blocks), [blocks])
  const look: Look = { reading, onJump }
  const gap = reading ? 'space-y-4' : 'space-y-3'
  // Hover is read off the DOM (the innermost [data-sel] under the
  // pointer), so a block inside a step washes alone; CSS :hover would
  // light every selectable ancestor at once.
  const [hover, setHover] = useState<string | null>(null)
  // The pick lives above the documents (a page shows two: a hint and a
  // walkthrough), so `ask.selected` is already the one outlined element,
  // whether picked or asked about. This tree only reports clicks.
  const outlined = ask?.selected ?? null
  const scope: Scope = { ask, hover, outlined }

  // Esc lets go; what takes keys itself (a text box, a menu, a dialog)
  // takes Esc first.
  useEffect(() => {
    if (!ask || !outlined) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (e.defaultPrevented || document.querySelector('[role="menu"], [role="dialog"]')) return
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return
      ask.onClear()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ask, outlined])

  return (
    <div
      className={reading ? 'space-y-8' : 'space-y-3'}
      onMouseOver={
        ask
          ? (e) => {
              const el = (e.target as Element).closest('[data-sel]')
              const next = el?.getAttribute('data-sel') ?? null
              setHover((was) => (was === next ? was : next))
            }
          : undefined
      }
      onMouseLeave={ask ? () => setHover(null) : undefined}
      onClick={
        ask
          ? (e) => {
              // Page chips, links and the toolbar's own buttons keep
              // their clicks, and a drag that took the words isn't a
              // pick. The innermost [data-sel] under the pointer is
              // what the student pointed at.
              if (e.target instanceof Element && e.target.closest('button, a')) return
              if (window.getSelection()?.toString()) return
              const sel = (e.target as Element).closest('[data-sel]')?.getAttribute('data-sel')
              if (!sel) return
              // Clicking the outlined one lets go, chip and all.
              if (sel === outlined) ask.onClear()
              else ask.onPick(sel)
            }
          : undefined
      }
    >
      {tree.map((section) => (
        <SectionView key={section.index} section={section} first={section === tree[0]} look={look} gap={gap} before={before} scope={scope} />
      ))}
      {before?.(blocks.length)}
    </div>
  )
}

function SectionView({
  section,
  first,
  look,
  gap,
  before,
  scope,
}: {
  section: Section
  first: boolean
  look: Look
  gap: string
  before?: (index: number) => ReactNode
  scope: Scope
}) {
  const body = section.groups.map((g) => <GroupView key={g.index} group={g} look={look} gap={gap} before={before} scope={scope} />)
  if (!section.part) return <>{body}</>
  return (
    <section className={cn(look.reading ? 'space-y-6' : 'space-y-3')}>
      {before?.(section.index)}
      {/* A part header selects its whole part. */}
      <Selectable sel={selPart(section.index)} scope={scope} className={cn(look.reading ? 'space-y-6' : 'space-y-3')}>
        <PartHeader label={section.part.label} title={<Runs runs={section.part.title} onJump={look.onJump} />} first={first} />
        {body}
      </Selectable>
    </section>
  )
}

function GroupView({
  group,
  look,
  gap,
  before,
  scope,
}: {
  group: Group
  look: Look
  gap: string
  before?: (index: number) => ReactNode
  scope: Scope
}) {
  const items = group.items.map(({ block, index }) => {
    const sel = selBlock(index)
    return (
      <Fragment key={index}>
        {before?.(index)}
        <Selectable sel={sel} scope={scope} block={block}>
          <BlockView block={block} look={look} pick={scope.ask ? { scope, index } : undefined} />
        </Selectable>
      </Fragment>
    )
  })
  if (!group.step) return <div className={gap}>{items}</div>
  return (
    <div className={gap}>
      {before?.(group.index)}
      {/* A step heading selects its whole step. */}
      <Selectable sel={selStep(group.index)} scope={scope} className={gap}>
        <StepHeading number={group.number} title={<Runs runs={group.step.title} onJump={look.onJump} />} />
        {items}
      </Selectable>
    </div>
  )
}

/** The answers of a document as one card: what the Answers veil holds. */
export function AnswersOf({ blocks, onJump }: { blocks: Block[]; onJump?: Jump }) {
  const answers = answersOf(blocks)
  if (answers.length === 0) return null
  return (
    <AnswersCard
      answers={answers.map((a) => ({
        label: a.label,
        children: (
          <p>
            <Runs runs={a.text} onJump={onJump} />
          </p>
        ),
      }))}
    />
  )
}

// ---------------------------------------------------------------- skeletons

const NAMES: Record<string, string> = {
  hint: 'a hint',
  part: 'a part',
  step: 'a step',
  para: 'a paragraph',
  note: 'a note',
  math: 'an equation',
  derivation: 'worked steps',
  callout: 'a callout',
  statement: 'a statement',
  table: 'a table',
  plot: 'a plot',
  code: 'code',
  answer: 'an answer',
}

const TEXT_BLOCKS = new Set(['hint', 'para', 'note', 'callout', 'statement', 'answer'])

/**
 * A block being written: its skeleton in roughly its own shape, labelled
 * ("Writing a plot"), with a text block's words as they stream, and
 * "Tidying" while a malformed one is repaired. The block replaces it in
 * place.
 */
export function BlockSkeleton({
  type,
  runs,
  repairing,
  reading,
  onJump,
}: {
  type: string
  runs?: Run[]
  repairing: boolean
  reading?: boolean
  onJump?: Jump
}) {
  const name = NAMES[type] ?? 'a block'
  const label = repairing ? `Tidying ${name}` : `Writing ${name}`
  if (TEXT_BLOCKS.has(type)) {
    const streaming = (runs?.length ?? 0) > 0
    return (
      <div aria-busy="true" className="space-y-1">
        {streaming ? (
          type === 'note' ? (
            <Note>
              <Runs runs={runs!} onJump={onJump} />
            </Note>
          ) : (
            <Para runs={runs!} look={{ reading, onJump }} />
          )
        ) : (
          <p>
            <Skeleton className="h-3 w-full" />
          </p>
        )}
        {repairing && <p className="text-xs text-muted-foreground">{label}</p>}
      </div>
    )
  }
  if (type === 'part' || type === 'step') {
    return (
      <div aria-busy="true" className="space-y-1">
        <Skeleton className={type === 'part' ? 'h-6 w-2/3' : 'h-5 w-1/2'} />
        {repairing && <p className="text-xs text-muted-foreground">{label}</p>}
      </div>
    )
  }
  const rows = type === 'derivation' ? 3 : type === 'table' ? 4 : type === 'code' ? 5 : 2
  return (
    <div className="overflow-hidden rounded-md border bg-card" aria-busy="true">
      <div className="border-b bg-card-header px-card py-2 text-xs text-muted-foreground">{label}</div>
      {type === 'plot' ? (
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
