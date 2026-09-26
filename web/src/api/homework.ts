import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { del, get, patch, post, postForm } from './client'
import { on } from './events'
import { forget, observe } from '@/lib/eta'
import type {
  AssignmentImport,
  AssignmentRead,
  AssignmentReads,
  AssignmentSource,
  Box,
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
  LineReading,
  LineReadings,
  QuestionRemoved,
  Questions,
  ReadChanged,
  ReadRemoved,
  Retry,
  Summary,
} from './gen/homework'

export type * from './gen/homework'

export const homeworkKeys = {
  forBook: (bookId: string) => ['homework', 'book', bookId] as const,
  set: (id: string) => ['homework', 'set', id] as const,
  due: ['homework', 'due'] as const,
  assignmentSource: (bookId: string) => ['homework', 'assignment-source', bookId] as const,
  reads: (bookId: string) => ['homework', 'reads', bookId] as const,
  read: (id: string) => ['homework', 'read', id] as const,
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

// Two snapshots of one question can land in either order: a mutation's
// response can arrive after a newer event already applied (the question
// failed within a second, say), and an event can race the worker's next
// one. The server bumps a question's `rev` on every change, so the higher
// rev is the newer snapshot, whatever it says and whenever it lands.

/** One question's snapshot into a set's cached questions, keeping
 *  position order. A snapshot no newer than the cached one (a lower or
 *  equal rev) returns the same Detail. `force` writes it anyway: for the
 *  student's own act drawn ahead of the server (a retry's pending), and
 *  for putting it back when the server refuses. */
export function applyQuestion(d: Detail, q: Question, force = false): Detail {
  const old = d.questions.find((x) => x.id === q.id)
  if (!force && old && q.rev <= old.rev) return d
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
          if (p.notes) n.notes = p.notes
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
    // before the request goes, at the failed snapshot's rev. Everything the
    // run says next (even an instant second failure) has a higher rev and
    // applies over it, and the response's snapshot loses to any of those
    // that landed first.
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
 *  at its old rev as a retry is: the student restarted it, and whatever
 *  the run says next is newer. */
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

/** A question from boxes drawn on the scan, added to a set. */
export function useAddBoxed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ setId, boxes }: { setId: string; boxes: Box[] }) =>
      post<Question>(`/api/homework/${setId}/boxed`, { boxes }),
    onSuccess: (q) => putQuestion(qc, q),
  })
}

/** Where a question is, shown with boxes: it's read from them and written
 *  again, forced over its state as a retry is. */
export function usePointOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, boxes }: { id: string; boxes: Box[] }) => post<Question>(`/api/questions/${id}/boxes`, { boxes }),
    onMutate: ({ id, boxes }) => {
      for (const [, d] of qc.getQueriesData<Detail>({ queryKey: ['homework', 'set'] })) {
        const old = d?.questions.find((x) => x.id === id)
        if (old) {
          putQuestion(
            qc,
            {
              ...old,
              boxes,
              state: 'pending',
              page: undefined,
              figures: [],
              hint: [],
              walkthrough: [],
              reading: [],
              failure: undefined,
              reason: undefined,
              updatedAt: new Date().toISOString(),
            },
            true,
          )
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

// ---------------------------------------------------------------- assignments

/** Where an assignment is read from: a PDF or photo, a course web page, or
 *  text pasted in. */
export type AssignmentFrom = { file: File } | { url: string } | { text: string }

/** An assignment being read, or read and waiting for its review. */
const putRead = (qc: QueryClient, r: AssignmentRead) => {
  qc.setQueryData<AssignmentRead[]>(homeworkKeys.reads(r.bookId), (list) => {
    if (!list) return list
    const i = list.findIndex((x) => x.id === r.id)
    return i === -1 ? [r, ...list] : list.map((x) => (x.id === r.id ? r : x))
  })
  qc.setQueryData(homeworkKeys.read(r.id), r)
}

const dropRead = (qc: QueryClient, id: string, bookId: string) => {
  qc.setQueryData<AssignmentRead[]>(homeworkKeys.reads(bookId), (list) => list?.filter((x) => x.id !== id))
  qc.removeQueries({ queryKey: homeworkKeys.read(id) })
}

on<ReadChanged>('assignment.changed', (d, qc) => putRead(qc, d.read))
on<ReadRemoved>('assignment.removed', (d, qc) => dropRead(qc, d.id, d.bookId))

/** The book's assignments being read or waiting for review. */
export const useAssignmentReads = (bookId: string) =>
  useQuery({
    queryKey: homeworkKeys.reads(bookId),
    queryFn: () => get<AssignmentReads>(`/api/books/${bookId}/assignments/reads`).then((r) => r.reads),
    // Events carry every change; while one is reading, poll as a backstop
    // for a missed one.
    refetchInterval: (query) => (query.state.data?.some((r) => r.state === 'reading') ? 10_000 : false),
  })

/** One read, for its review. */
export const useAssignmentRead = (id: string | null) =>
  useQuery({
    queryKey: homeworkKeys.read(id ?? ''),
    queryFn: () => get<AssignmentRead>(`/api/assignment-reads/${id}`),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.state === 'reading' ? 10_000 : false),
  })

/** Starts reading an assignment in the background, or, with setId,
 *  reading it as an update to that set. Nothing is added until the
 *  student imports what they kept. */
export function useStartRead(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ from, setId }: { from: AssignmentFrom; setId?: string }) => {
      const path = `/api/books/${bookId}/assignments/read`
      if ('file' in from) {
        const body = new FormData()
        if (setId) body.append('setId', setId)
        body.append('file', from.file)
        return postForm<AssignmentRead>(path, body)
      }
      return post<AssignmentRead>(path, { ...from, setId })
    },
    onSuccess: (r) => putRead(qc, r),
  })
}

export function useRetryRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => post<AssignmentRead>(`/api/assignment-reads/${id}/retry`),
    onSuccess: (r) => putRead(qc, r),
  })
}

export function useDismissRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (r: AssignmentRead) => del<void>(`/api/assignment-reads/${r.id}`),
    onSuccess: (_, r) => dropRead(qc, r.id, r.bookId),
  })
}

/** Makes each kept due date a set, its lines questions, and applies the
 *  kept changes to the sets they update. The read is done with. */
export function useImportAssignment(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: AssignmentImport) => post<List>(`/api/books/${bookId}/assignments`, a).then((r) => r.homework),
    onSuccess: (sets, a) => {
      sets.forEach((h) => putSummary(qc, h))
      // An updated set's questions changed under it: fetch them again.
      for (const g of a.groups) {
        if (g.setId) qc.invalidateQueries({ queryKey: homeworkKeys.set(g.setId) })
      }
      if (a.readId) dropRead(qc, a.readId, bookId)
      qc.invalidateQueries({ queryKey: homeworkKeys.assignmentSource(bookId) })
    },
  })
}

/** The course page this book's homework was last read from, offered
 *  again for checking. */
export const useAssignmentSource = (bookId: string) =>
  useQuery({
    queryKey: homeworkKeys.assignmentSource(bookId),
    queryFn: () => get<AssignmentSource>(`/api/books/${bookId}/assignments/source`).then((r) => r.url),
  })

// ---------------------------------------------------------------- references

/** What lines read as in the book's numbering, by their text: the same
 *  reading Add gives them, asked while they're typed. */
export const useLineReadings = (bookId: string | undefined, lines: string[]) =>
  useQuery({
    queryKey: ['homework', 'references', bookId, lines] as const,
    queryFn: () =>
      post<LineReadings>(`/api/books/${bookId}/references`, { lines }).then(
        (r) => new Map(lines.map((l, i): [string, LineReading] => [l, r.lines[i]])),
      ),
    enabled: !!bookId && lines.length > 0,
    staleTime: Infinity,
  })
