import { Fragment, useMemo, type ReactNode } from 'react'

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

import { answersOf, buildTree, type Group, type Section } from './tree'

export { answersOf, buildTree } from './tree'
export { runsSource, runsText } from './runs'

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
 *  stray one (a block list not built into a tree) draws as its heading. */
export function BlockView({ block, look }: { block: Block; look: Look }) {
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
 * reading size; Ask's answers stay compact.
 */
export function Document({
  blocks,
  onJump,
  reading,
  before,
}: {
  blocks: Block[]
  onJump?: Jump
  reading?: boolean
  before?: (index: number) => ReactNode
}) {
  const tree = useMemo(() => buildTree(blocks), [blocks])
  const look: Look = { reading, onJump }
  const gap = reading ? 'space-y-4' : 'space-y-3'
  return (
    <div className={reading ? 'space-y-8' : 'space-y-3'}>
      {tree.map((section) => (
        <SectionView key={section.index} section={section} first={section === tree[0]} look={look} gap={gap} before={before} />
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
}: {
  section: Section
  first: boolean
  look: Look
  gap: string
  before?: (index: number) => ReactNode
}) {
  const body = section.groups.map((g) => <GroupView key={g.index} group={g} look={look} gap={gap} before={before} />)
  if (!section.part) return <>{body}</>
  return (
    <section className={cn(look.reading ? 'space-y-6' : 'space-y-3')}>
      {before?.(section.index)}
      <PartHeader label={section.part.label} title={<Runs runs={section.part.title} onJump={look.onJump} />} first={first} />
      {body}
    </section>
  )
}

function GroupView({
  group,
  look,
  gap,
  before,
}: {
  group: Group
  look: Look
  gap: string
  before?: (index: number) => ReactNode
}) {
  const items = group.items.map(({ block, index }) => (
    <Fragment key={index}>
      {before?.(index)}
      <BlockView block={block} look={look} />
    </Fragment>
  ))
  if (!group.step) return <div className={gap}>{items}</div>
  return (
    <div className={gap}>
      {before?.(group.index)}
      <StepHeading number={group.number} title={<Runs runs={group.step.title} onJump={look.onJump} />} />
      {items}
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
