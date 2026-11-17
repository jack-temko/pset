import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { del, get, post } from './client';
import { on } from './events';
import type { Block, Run } from './gen/doc';
import type {
  Question,
  Turn,
  TurnBlock,
  TurnBlockRepairing,
  TurnBlockStart,
  TurnBlockText,
  TurnChanged,
  Turns,
  TurnsCleared,
} from './gen/ask';

export type * from './gen/ask';

/** A turn as the transcript holds it: what the server saved, plus what's
 *  streamed since, and the block being written right now, if any: its
 *  type, the runs of its text so far, and whether it is being repaired. */
export type LiveTurn = Turn & {
  pending?: { type: string; runs: Run[]; repairing: boolean };
};

export const askKeys = {
  turns: (bookId: string) => ['turns', bookId] as const,
};

export const useTurns = (bookId: string) =>
  useQuery({
    queryKey: askKeys.turns(bookId),
    queryFn: () =>
      get<Turns>(`/api/books/${bookId}/turns`).then(
        (r) => r.turns as LiveTurn[],
      ),
  });

// ---------------------------------------------------------------- cache

/** A turn's newest copy into a book's cached turns. Returns the same list
 *  when the copy is older than the one held: a reply can land after a
 *  newer event (the answer already streaming in), and must not roll the
 *  turn back. */
export function applyTurn(list: LiveTurn[], t: Turn): LiveTurn[] {
  const i = list.findIndex((x) => x.id === t.id);
  if (i === -1) return [...list, t];
  if (t.updatedAt < list[i].updatedAt) return list;
  // A card mid-write survives a step update; a settled turn has none.
  const pending = t.state === 'running' ? list[i].pending : undefined;
  return list.map((x) => (x.id === t.id ? { ...t, pending } : x));
}

function putTurn(qc: QueryClient, t: Turn) {
  qc.setQueryData<LiveTurn[]>(
    askKeys.turns(t.bookId),
    (list) => list && applyTurn(list, t),
  );
}

/** Patch the turn wherever it is: stream events carry only its id. */
function patchTurn(qc: QueryClient, id: string, fn: (t: LiveTurn) => LiveTurn) {
  for (const [key, list] of qc.getQueriesData<LiveTurn[]>({
    queryKey: ['turns'],
  })) {
    if (list?.some((t) => t.id === id))
      qc.setQueryData(
        key,
        list.map((t) => (t.id === id ? fn(t) : t)),
      );
  }
}

/** What each block event does to a turn. Pure, so the streaming can be
 *  tested without a stream. */
export const stream = {
  /** A block's type has arrived: its skeleton. */
  start: (t: LiveTurn, type: string): LiveTurn => ({
    ...t,
    pending: { type, runs: [], repairing: false },
  }),
  /** The open text block's new runs join the ones already there. */
  text: (t: LiveTurn, runs: Run[]): LiveTurn => ({
    ...t,
    pending: {
      type: t.pending?.type ?? 'para',
      repairing: false,
      runs: [...(t.pending?.runs ?? []), ...runs],
    },
  }),
  /** The block is being repaired: "Tidying". */
  repairing: (t: LiveTurn, type: string): LiveTurn => ({
    ...t,
    pending: {
      type: t.pending?.type || type,
      runs: t.pending?.runs ?? [],
      repairing: true,
    },
  }),
  /** A finished block, valid or raw, takes the skeleton's place. */
  block: (t: LiveTurn, block: Block): LiveTurn => ({
    ...t,
    pending: undefined,
    answer: [...t.answer, block],
  }),
};

on<TurnChanged>('turn.changed', (d, qc) => {
  putTurn(qc, d.turn);
});
on<TurnBlockStart>('turn.block.start', (d, qc) => {
  patchTurn(qc, d.turnId, (t) => stream.start(t, d.type));
});
on<TurnBlockText>('turn.block.text', (d, qc) => {
  patchTurn(qc, d.turnId, (t) => stream.text(t, d.runs));
});
on<TurnBlockRepairing>('turn.block.repairing', (d, qc) => {
  patchTurn(qc, d.turnId, (t) => stream.repairing(t, d.type));
});
on<TurnBlock>('turn.block', (d, qc) => {
  patchTurn(qc, d.turnId, (t) => stream.block(t, d.block));
});
on<TurnBlock>('turn.block.failed', (d, qc) => {
  patchTurn(qc, d.turnId, (t) => stream.block(t, d.block));
});
on<TurnsCleared>('turns.cleared', (d, qc) =>
  qc.setQueryData(askKeys.turns(d.bookId), []),
);

// ---------------------------------------------------------------- mutations

export function useAsk(bookId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (q: Question) => post<Turn>(`/api/books/${bookId}/turns`, q),
    onSuccess: (t) => {
      putTurn(qc, t);
    },
  });
}

export function useStopTurn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<Turn>(`/api/turns/${id}/stop`),
    onSuccess: (t) => {
      putTurn(qc, t);
    },
  });
}

export function useClearTurns(bookId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => del<undefined>(`/api/books/${bookId}/turns`),
    onSuccess: () => qc.setQueryData(askKeys.turns(bookId), []),
  });
}
