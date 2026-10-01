import type { Assignment, AssignmentRead, Detail, Estimate, Failure, Question, Summary } from '@/api/homework'
import type { Book } from '@/api/library'
import type { Block, Run } from '@/api/gen/doc'
import type { Usage } from '@/api/gen/usage'
import type { ScenarioContext } from '@/views/mock/scenario'
import type { HomeworkSet, Q } from './progress'
import { COVERS } from '@/lib/covers'

const t = (text: string): Run => ({ t: text })
const m = (tex: string): Run => ({ m: tex })

export const BOOK_ID = 'book-circuits'

/** The book the homework view sits in: its title never shows in the view,
 *  but its page numbering does (a question's page chip). */
export const BOOK: Book = {
  id: BOOK_ID,
  sha256: 'circuits0',
  title: 'Fundamentals of Electric Circuits',
  author: 'Alexander and Sadiku',
  pageCount: 980,
  pageRuns: [{ from: 1, offset: 16 }],
  problems: { form: 'section', sure: true, confirmed: true } as Book['problems'],
  cover: COVERS[2],
  aspect: 11 / 8.5,
  kind: 'digital',
  state: { kind: 'ready' },
  addedAt: '2026-09-03T12:00:00Z',
  updatedAt: '2026-09-03T12:00:00.000000000Z',
}

const iso = (offsetDays: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const due = iso

const usage: Usage = {
  rows: [
    { model: 'deepseek/deepseek-v4', ms: 21_400, tokens: 9_812, cost: 0.0041, calls: 3 },
    { model: 'perceptron/isaac-0.2', ms: 3_200, tokens: 1_204, cost: 0.0006, calls: 1 },
  ],
  total: { ms: 24_600, tokens: 11_016, cost: 0.0047, calls: 4 },
  failed: 0,
}

/** The hint, apart from the guide: enough to start, not to finish. */
const HINT: Block[] = [{ type: 'hint', text: [t('Go around the loop once and write the voltage rises equal to the drops. The resistors are in series, so they share one current.')] }]

/** A guide as the writer sends it, for a two-part circuit problem. */
const WALKTHROUGH: Block[] = [
  { type: 'part', label: '(a)', title: [t('The loop current')] },
  { type: 'step', title: [t('Write Kirchhoff’s voltage law around the loop')] },
  {
    type: 'para',
    text: [t('Going clockwise, the voltage rises equal the drops '), { cite: 58 }, t('. The source gives a rise of '), m('12\\ \\text{V}'), t(' and the two resistors are drops:')],
  },
  { type: 'math', tex: '12 = 4i + 8i' },
  { type: 'step', title: [t('Solve for the current')] },
  {
    type: 'derivation',
    steps: [
      { tex: '12 = 12i', why: [t('Add the two drops: '), m('4i + 8i = 12i'), t('.')] },
      { tex: 'i = 1\\ \\text{A}', why: [t('Divide both sides by '), m('12\\ \\Omega'), t('.')] },
    ],
  },
  { type: 'answer', label: '(a)', text: [m('i = 1\\ \\text{A}'), t(' clockwise.')] },
  { type: 'part', label: '(b)', title: [t('The power in the 8 Ω resistor')] },
  { type: 'step', title: [t('Use the power in a resistor')] },
  { type: 'para', text: [t('Power is '), m('P = i^2 R'), t(' '), { cite: 74 }, t(', with the current from part (a):')] },
  { type: 'math', tex: 'P = (1)^2 \\cdot 8 = 8\\ \\text{W}' },
  { type: 'callout', tone: 'caveat', title: [t('A common slip')], text: [t('Using the 12 V across the 8 Ω resistor. Only 8 V of it drops there.')] },
  { type: 'answer', label: '(b)', text: [m('P = 8\\ \\text{W}'), t('.')] },
]

interface Sample {
  label: string
  statement: Run[]
  page: number
  figure?: boolean
  reading?: Run[][]
  doubts?: Run[][]
}

/** What the book says for each reference a student can type. */
export const SAMPLES: Sample[] = [
  {
    label: '4.27',
    page: 152,
    figure: true,
    statement: [t('For the circuit in Fig. 4.109, find the current '), m('i'), t(' through the '), m('8\\ \\Omega'), t(' resistor and the power it absorbs.')],
    reading: [[t('A 12 V source, + at the top, drives the loop.')], [t('A 4 Ω resistor on the top branch, in series.')], [t('An 8 Ω resistor on the right branch; '), m('i'), t(' points down through it.')]],
    doubts: [[t('The 12 V source: two readings have + at the top, one at the bottom; + is at the top.')]],
  },
  {
    label: '4.25',
    page: 151,
    statement: [t('Use superposition to find '), m('v_o'), t(' in the circuit of Fig. 4.107, with the professor’s sources '), m('V_s = 10\\ \\text{V}'), t(' and '), m('I_s = 2\\ \\text{A}'), t('.')],
  },
  {
    label: '4.32',
    page: 154,
    statement: [t('Determine the Thevenin equivalent of the circuit seen from terminals '), m('a\\text{-}b'), t('.')],
  },
  {
    label: '3.12',
    page: 108,
    statement: [t('Find '), m('v_1'), t(' and '), m('v_2'), t(' in the circuit of Fig. 3.55 using nodal analysis.')],
  },
  {
    label: '2.31',
    page: 78,
    statement: [t('Find '), m('i_1'), t(' through '), m('i_4'), t(' in the circuit in Fig. 2.83.')],
  },
]

/** The book's own reading of a typed line: a line that names a problem in
 *  the sample book is found; anything else is text. */
export function sampleFor(text: string): Sample | undefined {
  const label = /\d+(?:\.\d+)+/.exec(text)?.[0]
  return SAMPLES.find((s) => s.label === label)
}

export interface QuestionInit {
  homeworkId: string
  position: number
  label: string
  /** Where it is when the scenario starts. */
  state: Question['state']
  done?: boolean
  revealed?: string[]
  failure?: Failure
  reason?: string
  activity?: string
  notes?: Run[][]
  inBook?: boolean
  text?: string
  /** How hard it is against the rest of its set, 1 to 5 (the ranking step's score). */
  difficulty?: number
  /** Seconds the student has spent on it in the walkthrough. */
  seconds?: number
}

let ids = 0
export const nextId = (prefix: string) => `${prefix}-${++ids}`

/** A question as the server would send it in a given state. */
export function makeQuestion(init: QuestionInit): Q {
  const sample = sampleFor(init.label)
  const found = !['pending', 'locating'].includes(init.state) || init.state === 'failed'
  const guided = init.state === 'ready' || init.state === 'unwritten'
  const inBook = init.inBook ?? true
  const q: Q = {
    id: nextId('q'),
    homeworkId: init.homeworkId,
    position: init.position,
    text: init.text ?? init.label,
    inBook,
    label: init.label,
    statement: found ? (sample ? sample.statement : inBook ? [t(`Exercise ${init.label}, from the chapter’s problems.`)] : []) : [],
    page: found && inBook ? (sample ? sample.page : 120 + init.position) : undefined,
    figures: found && sample?.figure ? [{ label: 'Fig. 4.109' }] : [],
    hint: init.state === 'ready' || init.state === 'writing' ? HINT : [],
    walkthrough: init.state === 'ready' ? WALKTHROUGH : [],
    state: init.state,
    failure: init.failure,
    reason: init.reason,
    activity: init.activity,
    reading: found && sample?.reading ? sample.reading : [],
    readingEdited: false,
    readingDoubts: found && sample?.doubts ? sample.doubts : [],
    notes: init.notes ?? [],
    boxes: [],
    usage: guided ? usage : undefined,
    memory: [],
    revealed: init.revealed ?? [],
    done: init.done ?? false,
    difficulty: init.difficulty,
    seconds: init.seconds,
    // A question that starts failed failed a couple of minutes ago.
    failedAt: init.state === 'failed' ? new Date(Date.now() - 2 * 60_000).toISOString() : undefined,
    updatedAt: new Date().toISOString(),
    rev: 1,
  }
  return q
}

export function makeRead(over: Partial<AssignmentRead> & Pick<AssignmentRead, 'state' | 'source'>): AssignmentRead {
  return { id: nextId('read'), bookId: BOOK_ID, createdAt: '', updatedAt: new Date().toISOString(), ...over }
}

/**
 * What the backend will send as a set's estimate, worked out on the mock's
 * questions the way the real one will: the student's seconds per unit of
 * difficulty on what has been timed, times the difficulty left, with a
 * range either side. Nothing until two questions have been timed.
 */
export function mockEstimate(qs: Q[]): Estimate | undefined {
  const timed = qs.filter((q) => (q.seconds ?? 0) > 0)
  if (timed.length < 2) return undefined
  const perUnit = timed.reduce((n, q) => n + (q.seconds ?? 0), 0) / timed.reduce((n, q) => n + (q.difficulty ?? 1), 0)
  const left = qs.filter((q) => !q.done).reduce((n, q) => n + (q.difficulty ?? 1), 0) * perUnit
  return left > 0 ? { seconds: left, low: left * 0.8, high: left * 1.2 } : undefined
}

export function makeSet(title: string, dueOffset: number | null, over: Partial<Summary> = {}): Summary {
  return {
    id: nextId('set'),
    bookId: BOOK_ID,
    title,
    dueDate: dueOffset === null ? '' : iso(dueOffset),
    turnedInAt: '',
    total: 0,
    done: 0,
    createdAt: '2026-09-20T12:00:00Z',
    ...over,
  }
}

/** The assignment a course page reads out as, for the importing scenario. */
export const READ_ASSIGNMENT: Assignment = {
  source: 'https://people.example.edu/~prof/202/homework.htm',
  title: 'EECS 202 Homework',
  groups: [
    {
      due: iso(6),
      title: `Homework due ${new Date(iso(6) + 'T12:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      gone: [],
      rows: [
        { kind: 'book', text: '4.27, 4.32 (no PSpice)', labels: ['4.27', '4.32'], notes: ['no PSpice'], present: [], changed: [] },
        { kind: 'other', text: 'Reading: pages 147-148', labels: [], notes: [], present: [], changed: [] },
      ],
    },
  ],
}

/**
 * The homework the server would hold for one scenario, and what the engine
 * does with it: a question waits, is found in the book, has its figure
 * read, and has its guide written, each step an event into the view's
 * cache, as the live stream sends them.
 */
export class World {
  sets: Summary[] = []
  questions: Q[] = []
  reads: AssignmentRead[] = []
  private ctx: ScenarioContext
  private started = Date.now()
  /** When the guide writer is next free, in scenario time: one at a time. */
  private writerFree = 0
  /** When the finder is next free. */
  private finderFree = 0
  /** What the next retry of a failed question does: set by a scenario. */
  retryFails?: Failure
  retryReason = 'It failed again, the same way.'

  constructor(ctx: ScenarioContext) {
    this.ctx = ctx
  }

  /** Scenario time now, in milliseconds. */
  private vnow() {
    return (Date.now() - this.started) * this.ctx.speed
  }

  /** Runs `fn` at scenario time `v`. */
  private at(v: number, fn: () => void) {
    this.ctx.after(Math.max(0, v - this.vnow()), fn)
  }

  summary(id: string): HomeworkSet {
    const h = this.sets.find((x) => x.id === id)!
    const qs = this.questions.filter((q) => q.homeworkId === id)
    return {
      ...h,
      total: qs.length,
      done: qs.filter((q) => q.done).length,
      estimate: mockEstimate(qs),
      timed: qs.filter((q) => (q.seconds ?? 0) > 0).length,
      bar: [...qs].sort((a, b) => a.position - b.position).map((q) => ({ done: q.done, failed: q.state === 'failed', weight: q.difficulty })),
    }
  }

  detail(id: string): Detail {
    return {
      homework: this.summary(id),
      questions: this.questions.filter((q) => q.homeworkId === id).sort((a, b) => a.position - b.position),
    }
  }

  addSet(h: Summary, questions: Question[] = []): Summary {
    this.sets.unshift(h)
    this.questions.push(...questions)
    return this.summary(h.id)
  }

  /** A question changed: its rev goes up (the higher rev is newer), the
   *  event goes out, and the set's counts follow. */
  patch(id: string, change: Partial<Question>, silent = false): Question {
    const i = this.questions.findIndex((q) => q.id === id)
    const q = { ...this.questions[i], ...change, rev: this.questions[i].rev + 1, updatedAt: new Date().toISOString() }
    this.questions[i] = q
    if (!silent) {
      this.ctx.emit('question.changed', { question: q })
      this.ctx.emit('homework.changed', { homework: this.summary(q.homeworkId) })
    }
    return q
  }

  /** Sets the engine to work on a question from where it is, to ready or
   *  to a failure: what the worker does, on the clock. */
  work(id: string, opts: { fail?: { at: 'locating' | 'writing'; failure: Failure; reason: string } } = {}) {
    const q = this.questions.find((x) => x.id === id)!
    const sample = sampleFor(q.label)
    const step = (v: number, change: Partial<Question>) => this.at(v, () => this.patch(id, change))
    let v = this.vnow()

    if (q.state === 'pending' || q.state === 'locating') {
      v = Math.max(v, this.finderFree) + 1200
      step(v, { state: 'locating', activity: 'Finding it in the book…' })
      v += 2600
      if (opts.fail?.at === 'locating') {
        this.finderFree = v
        step(v, { state: 'failed', failure: opts.fail.failure, reason: opts.fail.reason, activity: undefined, failedAt: new Date().toISOString() })
        return
      }
      this.finderFree = v
      step(v, {
        state: 'located',
        activity: undefined,
        statement: q.inBook ? (sample?.statement ?? [t(q.text)]) : [t(q.text)],
        page: q.inBook ? (sample?.page ?? 120) : undefined,
        figures: sample?.figure ? [{ label: 'Fig. 4.109' }] : [],
      })
    }
    if (sample?.figure && !q.reading.length) {
      v += 900
      step(v, { state: 'reading', activity: 'Reading the figure…' })
      v += 2200
      step(v, { reading: sample.reading ?? [], readingDoubts: sample.doubts ?? [] })
    }
    v = Math.max(v + 800, this.writerFree)
    step(v, { state: 'writing', activity: 'Thinking…' })
    v += 2400
    step(v, { activity: 'Computing…' })
    v += 2200
    step(v, { activity: 'Writing the guide…', hint: HINT })
    v += 3200
    if (opts.fail?.at === 'writing') {
      this.writerFree = v
      step(v, { state: 'failed', failure: opts.fail.failure, reason: opts.fail.reason, activity: undefined, failedAt: new Date().toISOString() })
      return
    }
    this.writerFree = v
    step(v, { state: 'ready', activity: undefined, walkthrough: WALKTHROUGH, usage })
  }

  emit(type: string, data: unknown) {
    this.ctx.emit(type, data)
  }

  /** A set's summary changed (a count, a title, turned in). */
  ctxEmitSet(id: string) {
    if (this.sets.some((s) => s.id === id)) this.ctx.emit('homework.changed', { homework: this.summary(id) })
  }

  /** An assignment being read, as the engine reports it: thinking, then
   *  lines found as they come in, then ready to review. */
  playRead(id: string) {
    const change = (c: Partial<AssignmentRead>) => () => {
      const cur = this.reads.find((r) => r.id === id)
      if (!cur) return
      const next = { ...cur, ...c, updatedAt: new Date().toISOString() }
      this.reads = this.reads.map((r) => (r.id === id ? next : r))
      this.ctx.emit('assignment.changed', { read: next })
    }
    const v = this.vnow()
    this.at(v + 3000, change({ activity: 'Found 4 lines so far…' }))
    this.at(v + 6500, change({ activity: 'Found 9 lines so far…' }))
    this.at(v + 9000, change({ state: 'ready', activity: undefined, assignment: READ_ASSIGNMENT, usage }))
  }
}
