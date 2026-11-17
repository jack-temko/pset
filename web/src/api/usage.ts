import { useQuery, type QueryClient } from '@tanstack/react-query';

import { get } from './client';
import { on } from './events';
import type { BookUsage, Detail } from './gen/usage';

export type * from './gen/usage';

/** What a job's usage is of: a homework question, an assignment read or an
 *  Ask turn. The server keeps each under its own id. */
export type UsageSource = { kind: 'question' | 'read' | 'turn'; id: string };

const paths: Record<UsageSource['kind'], string> = {
  question: '/api/questions',
  read: '/api/assignment-reads',
  turn: '/api/turns',
};

const detailQuery = (source: UsageSource) => ({
  queryKey: ['usage', source.kind, source.id],
  queryFn: () => get<Detail | null>(`${paths[source.kind]}/${source.id}/usage`),
});

const bookQuery = (bookId: string) => ({
  queryKey: ['usage', 'book', bookId],
  queryFn: () => get<BookUsage | null>(`/api/books/${bookId}/usage`),
});

/** A job's detail, fetched when its modal opens. It stays cached, so the
 *  second open is instant; the event stream marks it stale when a job
 *  changes, and it refreshes in place. */
export const useUsageDetail = (source: UsageSource, enabled: boolean) =>
  useQuery({ ...detailQuery(source), enabled });

/** What a whole book has cost, fetched when its dialog opens; cached like a
 *  job's detail. */
export const useBookUsage = (bookId: string, enabled: boolean) =>
  useQuery({ ...bookQuery(bookId), enabled });

const noop = () => undefined;

/** Starts a job's detail loading before its modal opens (as the pointer
 *  reaches the trigger). Nothing happens when it is already cached. */
export const prefetchUsageDetail = (client: QueryClient, source: UsageSource) =>
  client.query(detailQuery(source)).then(noop, noop);

/** The same for a book's usage aggregate. */
export const prefetchBookUsage = (client: QueryClient, bookId: string) =>
  client.query(bookQuery(bookId)).then(noop, noop);

// A job that finished, or a book that changed or lost something, has changed
// what was spent: mark every cached usage stale. What is open refetches and swaps in place; the
// rest refetches when it is next opened, showing the old figures meanwhile.
//
// A book carries the shape of its usage dialog (Book.usage: how many kinds
// spent anything), which a guide, an Ask turn or a read can change without a
// book event, so the books are marked stale too and the next first open knows.
const stale = (type: string, qc: QueryClient) => {
  void qc.invalidateQueries({ queryKey: ['usage'] }, { cancelRefetch: false });
  if (type !== 'book.changed')
    void qc.invalidateQueries(
      // The shelf and each book (['books'], ['books', id]), not a book's
      // contents or anything else under it. The dialog reads the book.
      { predicate: (q) => q.queryKey[0] === 'books' && q.queryKey.length <= 2 },
      { cancelRefetch: false },
    );
};
for (const type of [
  'question.changed',
  'question.removed',
  'assignment.changed',
  'assignment.removed',
  'homework.removed',
  'turn.changed',
  'turns.cleared',
  'book.changed',
])
  on(type, (_, qc) => {
    stale(type, qc);
  });
