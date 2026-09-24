import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { del, get, patch, post } from './client'
import { on } from './events'
import { forget, observe } from '@/lib/eta'
import type {
  Detail,
  Draft,
  HomeworkChanged,
  HomeworkRemoved,
  Input,
  List,
  Patch,
  Question,
  QuestionChanged,
  QuestionPatch,
  QuestionRemoved,
  Questions,
  Retry,
  Summary,
} from './gen/homework'

export type * from './gen/homework'

export const homeworkKeys = {
  forBook: (bookId: string) => ['homework', 'book', bookId] as const,
  set: (id: string) => ['homework', 'set', id] as const,
  due: ['homework', 'due'] as const,
}

export const useBookHomework = (bookId: string) =>
  useQuery({
    queryKey: homeworkKeys.forBook(bookId),
    queryFn: () => get<List>(`/api/books/${bookId}/homework`).then((r) => r.homework),
  })

/** A question the engine still owes work on: queued, being found, found
 *  and waiting, having its figure read, or being written. */
export const outstanding = (q: Question) =>
  q.state === 'pending' ||
  q.state === 'locating' ||
  q.state === 'located' ||
  q.state === 'reading' ||
  q.state === 'writing'

/** A question the engine has yet to find in the book: one that isn't in
 *  it has nothing to find, and its guide is all it waits for. Until it's
 *  found, the worksheet prints only its label. */
export const toFind = (q: Question) => q.inBook && (q.state === 'pending' || q.state === 'locating')

export const useHomeworkSet = (id: string | null) =>
  useQuery({
    queryKey: homeworkKeys.set(id ?? ''),
    queryFn: () => get<Detail>(`/api/homework/${id}`),
    enabled: !!id,
    // Events carry every change, but a missed one mustn't strand a question
    // on Queued forever: while any is outstanding, poll as a backstop.
    refetchInterval: (query) => (query.state.data?.questions.some(outstanding) ? 5000 : false),
  })

export const useDue = () =>
  useQuery({ queryKey: homeworkKeys.due, queryFn: () => get<List>('/api/due').then((r) => r.homework) })

// ---------------------------------------------------------------- cache

function putSummary(qc: QueryClient, h: Summary) {
  qc.setQueryData<Summary[]>(homeworkKeys.forBook(h.bookId), (list) => {
    if (!list) return list
    const i = list.findIndex((x) => x.id === h.id)
    return i === -1 ? [h, ...list] : list.map((x) => (x.id === h.id ? h : x))
  })
  qc.setQueryData<Detail>(homeworkKeys.set(h.id), (d) => d && { ...d, homework: h })
  // The due list's order depends on dates across books: refetch it.
  qc.invalidateQueries({ queryKey: homeworkKeys.due })
}

function dropSummary(qc: QueryClient, id: string, bookId: string) {
  qc.setQueryData<Summary[]>(homeworkKeys.forBook(bookId), (list) => list?.filter((x) => x.id !== id))
  qc.removeQueries({ queryKey: homeworkKeys.set(id) })
  qc.invalidateQueries({ queryKey: homeworkKeys.due })
}

// A question only moves forward through its states. The stream is ordered,
// but a mutation's response is a snapshot that can land after a newer event
// already applied (the question failed within a second, say): the older
// snapshot must lose, or it resurrects a state nothing will ever revisit.
const stateRank: Record<Question['state'], number> = {
  pending: 0,
  locating: 1,
  located: 2,
  // Found, then read, then found again and waiting for its guide: a late
  // "located" from before the reading may land, and changes nothing that
  // the reading's own end won't put right.
  reading: 2,
  writing: 3,
  ready: 4,
  failed: 4,
}

/** One question's newest state into a set's cached questions, keeping
 *  position order. Returns the same Detail when the write would move the
 *  question backward; `force` overrides, for the acts a student restarts. */
export function applyQuestion(d: Detail, q: Question, force = false): Detail {
  const old = d.questions.find((x) => x.id === q.id)
  if (!force && old && stateRank[q.state] < stateRank[old.state]) return d
  const rest = d.questions.filter((x) => x.id !== q.id)
  return { ...d, questions: [...rest, q].sort((a, b) => a.position - b.position) }
}

function putQuestion(qc: QueryClient, q: Question, force = false) {
  qc.setQueryData<Detail>(homeworkKeys.set(q.homeworkId), (d) => (d ? applyQuestion(d, q, force) : d))
}

function dropQuestion(qc: QueryClient, id: string, homeworkId: string) {
  qc.setQueryData<Detail>(homeworkKeys.set(homeworkId), (d) => d && { ...d, questions: d.questions.filter((x) => x.id !== id) })
}

on<HomeworkChanged>('homework.changed', (d, qc) => putSummary(qc, d.homework))
on<HomeworkRemoved>('homework.removed', (d, qc) => dropSummary(qc, d.id, d.bookId))
/** The step a question is in, for its time left (lib/eta): being found,
 *  having its figure read, or being written, none otherwise. */
export const questionStep = (q: Pick<Question, 'state'>) =>
  q.state === 'locating' || q.state === 'reading' || q.state === 'writing' ? `homework:${q.state}` : undefined

on<QuestionChanged>('question.changed', (d, qc) => {
  observe(`question:${d.question.id}`, questionStep(d.question))
  putQuestion(qc, d.question)
})
on<QuestionRemoved>('question.removed', (d, qc) => {
  forget(`question:${d.id}`)
  dropQuestion(qc, d.id, d.homeworkId)
})

// ---------------------------------------------------------------- sets

export function useCreateHomework(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (in_: Input) => post<Summary>(`/api/books/${bookId}/homework`, in_),
    onSuccess: (h) => putSummary(qc, h),
  })
}

/** Title, date and turned in apply at once and roll back on refusal. */
export function useUpdateHomework(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: Patch) => patch<Summary>(`/api/homework/${id}`, p),
    onMutate: (p) => {
      const before = qc.getQueryData<Detail>(homeworkKeys.set(id))?.homework
      if (before) {
        const next: Summary = { ...before }
        if (p.title !== undefined) next.title = p.title
        if (p.dueDate !== undefined) next.dueDate = p.dueDate
        if (p.turnedIn !== undefined) next.turnedInAt = p.turnedIn ? new Date().toISOString() : ''
        putSummary(qc, next)
      }
      return { before }
    },
    onError: (_e, _p, ctx) => ctx?.before && putSummary(qc, ctx.before),
    onSuccess: (h) => putSummary(qc, h),
  })
}

export function useDeleteHomework() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (h: Summary) => del<void>(`/api/homework/${h.id}`),
    onSuccess: (_, h) => dropSummary(qc, h.id, h.bookId),
  })
}

// ---------------------------------------------------------------- questions

export function useAddQuestions(homeworkId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (drafts: Draft[]) => post<Questions>(`/api/homework/${homeworkId}/questions`, { drafts }),
    onSuccess: (r) => r.questions.forEach((q) => putQuestion(qc, q)),
  })
}

/** Reveal, done and order are the student's own marks: instant. */
export function useUpdateQuestion(homeworkId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch: p }: { id: string; patch: QuestionPatch }) =>
      patch<Question>(`/api/questions/${id}`, p),
    onMutate: ({ id, patch: p }) => {
      const before = qc.getQueryData<Detail>(homeworkKeys.set(homeworkId))
      if (before) {
        let qs = before.questions.map((q) => {
          if (q.id !== id) return q
          const n = { ...q }
          if (p.reveal && !n.revealed.includes(p.reveal)) n.revealed = [...n.revealed, p.reveal]
          if (p.done !== undefined) n.done = p.done
          return n
        })
        if (p.position !== undefined) {
          const from = qs.findIndex((q) => q.id === id)
          const [row] = qs.splice(from, 1)
          qs.splice(p.position - 1, 0, row)
          qs = qs.map((q, i) => ({ ...q, position: i + 1 }))
        }
        const done = qs.filter((q) => q.done).length
        qc.setQueryData<Detail>(homeworkKeys.set(homeworkId), {
          homework: { ...before.homework, done },
          questions: qs,
        })
      }
      return { before }
    },
    onError: (_e, _v, ctx) => ctx?.before && qc.setQueryData(homeworkKeys.set(homeworkId), ctx.before),
  })
}

export function useRemoveQuestion(homeworkId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del<void>(`/api/questions/${id}`),
    onMutate: (id) => {
      const before = qc.getQueryData<Detail>(homeworkKeys.set(homeworkId))
      dropQuestion(qc, id, homeworkId)
      return { before }
    },
    onError: (_e, _v, ctx) => ctx?.before && qc.setQueryData(homeworkKeys.set(homeworkId), ctx.before),
  })
}

export function useRetryQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, retry }: { id: string; retry: Retry }) => post<Question>(`/api/questions/${id}/retry`, retry),
    // Restarting is the student's own act: pending is forced over failed
    // before the request goes, so the run's own events (even an instant
    // second failure) apply forward from it, and the response's snapshot
    // loses to any of them that landed first.
    onMutate: ({ id }) => {
      for (const [, d] of qc.getQueriesData<Detail>({ queryKey: ['homework', 'set'] })) {
        const old = d?.questions.find((x) => x.id === id)
        if (old) {
          // Pending as of now: a wait that may be over in a moment.
          putQuestion(qc, { ...old, state: 'pending', updatedAt: new Date().toISOString() }, true)
          return { old }
        }
      }
    },
    onError: (_e, _v, ctx) => ctx?.old && putQuestion(qc, ctx.old, true),
    onSuccess: (q) => putQuestion(qc, q),
  })
}

/** A new reading of a question's figure: the student's correction
 *  (`lines`), or with none, a fresh read. Either way the guide is written
 *  again from it, so the question goes back to waiting for it, forced
 *  over its state as a retry is: the student restarted it. */
export function useRedoReading() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, lines }: { id: string; lines?: string[] }) =>
      patch<Question>(`/api/questions/${id}`, lines ? { reading: lines } : { reread: true }),
    onMutate: ({ id, lines }) => {
      for (const [, d] of qc.getQueriesData<Detail>({ queryKey: ['homework', 'set'] })) {
        const old = d?.questions.find((x) => x.id === id)
        if (old) {
          const next: Question = {
            ...old,
            reading: lines ?? [],
            readingEdited: !!lines,
            state: 'located',
            hint: [],
            walkthrough: [],
            failure: undefined,
            reason: undefined,
            activity: undefined,
            updatedAt: new Date().toISOString(),
          }
          putQuestion(qc, next, true)
          return { old }
        }
      }
    },
    onError: (_e, _v, ctx) => ctx?.old && putQuestion(qc, ctx.old, true),
    onSuccess: (q) => putQuestion(qc, q),
  })
}

export const worksheetURL = (homeworkId: string) => `/api/homework/${homeworkId}/worksheet`
export const figureURL = (questionId: string, n: number) => `/api/questions/${questionId}/figures/${n}`
