import { api } from '@/lib/api'
import { dueInfo } from '@/lib/homework'
import type { Homework, HomeworkDiagram, HomeworkQuestion } from '@/lib/types'
import { cn } from '@/lib/utils'

/** A cropped diagram from the book page, rendered live from the server.
 *  The row height carries the assignment's figure scale, exactly like the
 *  printed sheet's scaled diagram row. */
function DiagramCrop({
  hwId,
  q,
  d,
  i,
  figureScale,
  n,
}: {
  hwId: string
  q: HomeworkQuestion
  d: HomeworkDiagram
  i: number
  figureScale: number
  n: number
}) {
  // Width and height scale together, like the printed sheet's figure box:
  // beyond one-per-row width, the row wraps. The multiplier caps at n
  // because a box wider than the whole row just wraps anyway.
  const mult = Math.min(figureScale, n)
  return (
    <figure
      className="shrink-0"
      style={{ width: `calc((100% - ${((n - 1) * 0.75).toFixed(2)}rem) / ${n} * ${mult})` }}
    >
      <img
        src={api.questionImageUrl(hwId, q.id, 'diagram', i)}
        alt={d.label}
        loading="lazy"
        style={{ height: `${5 * figureScale}rem` }}
        className="w-full rounded border border-neutral-300/80 bg-white object-contain"
      />
      <figcaption className="mt-1 truncate text-center font-mono text-[0.6rem] text-neutral-500">
        {d.label}
      </figcaption>
    </figure>
  )
}

function QuestionBlock({ hw, q, n }: { hw: Homework; q: HomeworkQuestion; n: number }) {
  const located = q.page !== null && q.questionRect !== null
  // Mirror the printed sheet: both fit boxes shrink by the assignment's
  // scales, so the preview answers the knobs the way the download does.
  const questionScale = (hw.questionScale || 100) / 100
  const figureScale = (hw.figureScale || 100) / 100
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs font-semibold text-neutral-800">Q{n}</span>
        {q.page !== null && (
          <span className="font-mono text-[0.65rem] text-neutral-500">p. {q.page}</span>
        )}
      </div>
      {located ? (
        <img
          src={api.questionImageUrl(hw.id, q.id, 'question')}
          alt={`Question ${n} from page ${q.page}`}
          style={{ maxWidth: `${28 * questionScale}rem`, maxHeight: `${14 * questionScale}rem` }}
          className="w-full rounded border border-neutral-300/80 bg-white object-contain object-top"
        />
      ) : (
        <p className="text-[0.8rem] leading-relaxed whitespace-pre-line text-neutral-800">
          {q.transcription}
        </p>
      )}
      {q.diagrams.length > 0 && (
        <div className="flex flex-wrap gap-3 pt-1">
          {q.diagrams.map((d, i) => (
            <DiagramCrop
              key={`${d.label}-${i}`}
              hwId={hw.id}
              q={q}
              d={d}
              i={i}
              figureScale={figureScale}
              n={q.diagrams.length}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** One sheet of the downloadable template: the paper is rendered light in
 *  both themes because it stands in for physical paper. */
export function HomeworkSheet({
  hw,
  questions,
  q,
  n,
  isFirst,
}: {
  hw: Homework
  questions: HomeworkQuestion[]
  q: HomeworkQuestion
  n: number
  isFirst: boolean
}) {
  const due = dueInfo(hw.dueDate)
  return (
    <figure className="mx-auto w-full max-w-[34rem]">
      <div
        className={cn(
          'flex aspect-[17/22] flex-col overflow-hidden rounded-md border border-neutral-300/90 bg-[#fdfcfa] p-[7%] text-neutral-800 shadow-[0_10px_24px_-18px_rgb(0_0_0/0.5)]',
          isFirst && 'gap-4',
        )}
      >
        {isFirst && (
          <header className="space-y-2 border-b border-neutral-300/80 pb-4">
            <h3 className="font-heading text-lg leading-snug font-medium text-neutral-900">
              {hw.title}
            </h3>
            <p className="font-mono text-[0.65rem] text-neutral-500">
              {due.tone === 'none' ? 'No due date' : due.label} · {questions.length} questions
            </p>
            <p className="text-[0.7rem] leading-relaxed text-neutral-600">
              {questions.map((qq, i) => (
                <span key={qq.id}>
                  {i > 0 && ' '}
                  <span className="whitespace-nowrap">
                    {i > 0 && '· '}
                    <span className="font-mono">Q{i + 1}</span>
                    {qq.page !== null && <span className="font-mono text-neutral-500"> p. {qq.page}</span>}
                  </span>
                </span>
              ))}
            </p>
          </header>
        )}
        <div className={cn('flex min-h-0 flex-1 flex-col gap-3', !isFirst && 'pt-1')}>
          <QuestionBlock hw={hw} q={q} n={n} />
          {/* The preview mirrors the downloaded sheet's budget: the question
              block is capped so the working space below always survives. */}
          <div className="min-h-24 flex-1" aria-label="Working space" />
        </div>
        <footer className="flex items-center justify-between pt-3 text-[0.6rem] text-neutral-400">
          <span className="font-mono uppercase tracking-[0.18em]">PSet</span>
          <span className="font-mono">
            {n} / {questions.length}
          </span>
        </footer>
      </div>
      <figcaption className="mt-2 text-center font-mono text-[0.65rem] text-muted-foreground">
        Sheet {n} · Q{n}
      </figcaption>
    </figure>
  )
}
