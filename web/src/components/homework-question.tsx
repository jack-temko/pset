import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EyeOff, Glasses, NotebookPen, RefreshCw, ScanLine } from 'lucide-react'

import {
  AnswerText,
  EquationCard,
  MathTitle,
  SmallCaps,
  StepsCard,
  type Seen,
} from '@/components/answer-blocks'
import { QuestionAdjust, type AdjustPatch } from '@/components/question-adjust'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { revealFor, setReveal } from '@/lib/homework'
import type { Homework, HomeworkQuestion, HomeworkReading } from '@/lib/types'

/** A guide card: the question as it prints (book screenshot or statement
 *  text) plus diagram crops, with the walkthrough underneath — hints open,
 *  steps and answer behind reveals. Actions sit in the card head; they are
 *  always visible on touch and hover-revealed from sm up. */
export function HomeworkQuestionCard({
  hw,
  q,
  n,
  bookExists,
  busy,
  onRedo,
  onRelocate,
  onAdjust,
}: {
  hw: Homework
  q: HomeworkQuestion
  n: number
  bookExists: boolean
  busy: boolean
  onRedo: () => void
  onRelocate: (page: number | undefined, note: string) => void
  onAdjust: (patch: AdjustPatch) => void
}) {
  const seen: Seen = { last: null }
  const [adjusting, setAdjusting] = useState(false)
  const [reveal, setRevealState] = useState(() => revealFor(q.id))
  const updateReveal = (which: 'steps' | 'answer', open: boolean) => {
    setRevealState((r) => ({ ...r, [which]: open }))
    setReveal(q.id, which, open)
  }
  const iconBtn =
    'size-7 text-muted-foreground/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50'

  return (
    <article className="group overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center gap-2 border-b bg-muted/30 py-2 pr-3 pl-4">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[0.7rem] font-medium text-primary">
          {n}
        </span>
        {q.standalone && (
          <span
            className="shrink-0 rounded-full border bg-background px-2 py-1 text-[0.65rem] text-muted-foreground"
            title="Self-contained question. Nothing to find in the book"
          >
            own text
          </span>
        )}
        <span className="min-w-0 flex-1" />
        {q.page !== null &&
          (bookExists ? (
            <Link
              to={`/library/${hw.bookSha256}/read?page=${q.page}`}
              title={`Open page ${q.page} in the reader`}
              className="shrink-0 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              p. {q.page}
            </Link>
          ) : (
            <span className="shrink-0 font-mono text-xs text-muted-foreground" title={`From page ${q.page}`}>
              p. {q.page}
            </span>
          ))}
        <span className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            className={iconBtn}
            aria-label={`Rewrite the walkthrough for question ${n}`}
            disabled={busy}
            title="Rewrite this walkthrough"
            onClick={onRedo}
          >
            <RefreshCw />
          </Button>
        </span>
      </div>

      <div className="space-y-4 px-5 py-5 text-sm">
        {q.page !== null && q.questionRect ? (
          <div className="space-y-2">
            {/* The crop is here so a wrong match is obvious at a glance.
                Locating the wrong problem never errors — it returns the
                practice item confidently and the question goes ready — so
                seeing what was found is the only thing that catches it. */}
            <img
              src={api.questionImageUrl(hw.id, q.id, 'question')}
              alt={`Question ${n}, page ${q.page} of ${hw.bookTitle}`}
              loading="lazy"
              className="w-full max-w-md rounded-lg border bg-background"
            />
            {!adjusting && bookExists ? (
              <p className="text-xs text-muted-foreground">
                Not the right one?{' '}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => setAdjusting(true)}
                >
                  Adjust
                </button>{' '}
                — or just say what’s wrong below.
              </p>
            ) : null}
          </div>
        ) : (
          <AnswerText text={q.transcription} seen={seen} />
        )}
        {adjusting ? (
          <QuestionAdjust
            hw={hw}
            q={q}
            busy={busy}
            onAdjust={onAdjust}
            onRelocate={(page, note) => {
              setAdjusting(false)
              onRelocate(page, note)
            }}
            onClose={() => setAdjusting(false)}
          />
        ) : null}
        {q.status === 'stale' ? (
          <p className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/[0.06] px-3 py-2 text-xs text-warning">
            <span>This walkthrough is out of date.</span>
            <button
              type="button"
              className="font-medium underline underline-offset-4"
              disabled={busy}
              onClick={onRedo}
            >
              Rewrite it
            </button>
          </p>
        ) : null}
        {q.status === 'failed' && q.error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/[0.06] px-3 py-2 text-xs text-destructive" role="alert">
            {q.error}
          </p>
        )}
        {q.diagrams.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {q.diagrams.map((d, i) => (
              <figure key={`${d.label}-${i}`} className="w-28 shrink-0">
                <img
                  src={api.questionImageUrl(hw.id, q.id, 'diagram', i)}
                  alt={d.label}
                  loading="lazy"
                  className="h-20 w-full rounded-lg border bg-background object-contain"
                />
                <figcaption className="mt-1 truncate text-center font-mono text-[0.6rem] text-muted-foreground">
                  {d.label}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>

      {q.guide?.reading && (
        <div className="border-t px-5 py-4">
          <ReadingBox reading={q.guide.reading} seen={seen} />
        </div>
      )}

      {q.understandingNotes.length > 0 && (
        <div className="border-t px-5 py-4">
          <UnderstandingNotes notes={q.understandingNotes} seen={seen} />
        </div>
      )}

      <div className="space-y-4 border-t bg-muted/20 px-5 py-5 text-sm">
        <SmallCaps>Walkthrough</SmallCaps>
        {q.guide ? (
          <>
            <AnswerText text={q.guide.setup} seen={seen} />
            {q.guide.hints.length > 0 && (
              <div className="space-y-2 border-l-2 border-border pl-4">
                <SmallCaps>Nudges</SmallCaps>
                <ul className="space-y-2">
                  {q.guide.hints.map((h, i) => (
                    <li key={i} className="leading-relaxed text-muted-foreground">
                      <AnswerText text={h} seen={seen} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {q.guide.equations.length > 0 && (
              <div className="space-y-3">
                {q.guide.equations.map((eq, i) => (
                  <EquationCard
                    key={i}
                    title={eq.title}
                    equations={[eq.tex]}
                    note={eq.note}
                    seen={seen}
                  />
                ))}
              </div>
            )}
            {reveal.steps ? (
              <StepsCard title={`Question ${n}`} steps={q.guide.steps} seen={seen} />
            ) : (
              <Button variant="outline" size="sm" onClick={() => updateReveal('steps', true)}>
                <EyeOff data-icon="inline-start" />
                Show the work
              </Button>
            )}
            {reveal.answer ? (
              <div className="rounded-xl border bg-primary/[0.04] px-5 py-4">
                <SmallCaps>Answer</SmallCaps>
                <div className="mt-2">
                  <AnswerText text={q.guide.answer} seen={seen} />
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => updateReveal('answer', true)}>
                <EyeOff data-icon="inline-start" />
                Show the answer
              </Button>
            )}
          </>
        ) : q.status === 'failed' ? (
          <p className="text-xs text-muted-foreground">
            No walkthrough yet — use the redo button above once the problem is fixed.
          </p>
        ) : (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ScanLine className="size-4" /> Walkthrough is on its way.
          </p>
        )}
      </div>
    </article>
  )
}

/** How the model read the problem, stated before any of the solving: the
 *  quantities it took as given, what it thinks is being asked, and how it
 *  read the figure. Ungated and first, because a wrong reading is what
 *  makes a whole walkthrough wrong and it is the fastest thing to check. */
export function ReadingBox({ reading, seen }: { reading: HomeworkReading; seen: Seen }) {
  return (
    <section
      aria-label="How this problem was read"
      className="rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-3 text-sm"
    >
      <p className="flex items-center gap-2">
        <Glasses aria-hidden className="size-4 shrink-0 text-primary" />
        <SmallCaps>How I read this</SmallCaps>
      </p>
      <dl className="mt-2 space-y-2">
        {reading.given.length > 0 && (
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 pt-1 font-mono text-[0.65rem] text-muted-foreground uppercase">
              Given
            </dt>
            <dd className="min-w-0 flex-1">
              <ul className="flex flex-wrap gap-x-2 gap-y-1">
                {reading.given.map((g, i) => (
                  <li
                    key={i}
                    className="rounded-md border bg-background px-2 py-1 text-[0.8rem] leading-relaxed"
                  >
                    <MathTitle text={g} />
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        <div className="flex gap-3">
          <dt className="w-14 shrink-0 pt-1 font-mono text-[0.65rem] text-muted-foreground uppercase">
            Find
          </dt>
          <dd className="min-w-0 flex-1 leading-relaxed">
            <MathTitle text={reading.find} />
          </dd>
        </div>
        {reading.figure ? (
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 pt-1 font-mono text-[0.65rem] text-muted-foreground uppercase">
              Figure
            </dt>
            <dd className="min-w-0 flex-1 text-muted-foreground">
              <AnswerText text={reading.figure} seen={seen} />
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        Wrong? Say so in the chat — the correction sticks and the walkthrough
        is rewritten with it.
      </p>
    </section>
  )
}

/** The corrections pinned on this question. They never print on the sheet;
 *  they are what the next rewrite is written against. */
export function UnderstandingNotes({
  notes,
  seen,
}: {
  notes: HomeworkQuestion['understandingNotes']
  seen: Seen
}) {
  return (
    <section aria-label="Understanding notes" className="space-y-2">
      <p className="flex items-center gap-2">
        <NotebookPen aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <SmallCaps>Understanding</SmallCaps>
      </p>
      <ul className="space-y-2">
        {notes.map((n, i) => (
          <li
            key={i}
            className="border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-muted-foreground"
          >
            <AnswerText text={n.note} seen={seen} />
          </li>
        ))}
      </ul>
    </section>
  )
}
