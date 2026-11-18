import type { Change } from '@/api/gen/change';

import type { Store } from './store';

/**
 * The change stream, into the store. The server sends each change with its
 * seq as the event id, so a dropped connection that EventSource opens again
 * sends `Last-Event-ID` and gets everything it missed. Events that are not
 * logged (a guide's block as it is written, a step's activity line) carry no
 * id and are lost on a reconnect, which costs nothing: the finished result
 * arrives as a change.
 *
 * The first connection sends no seq: the server starts it from now and says
 * where now is. The store's reads wait for that, so nothing that changes
 * between a read and the connection is missed.
 */

/** Where the store's stream is served: `GET /api/changes` on `backend`
 *  (#112, gap 1). The old screens keep the old bus at `/api/events` until
 *  the cut-over, when this takes that path. */
export const STREAM_URL = '/api/changes';

/** An event that is not logged, for whoever shows it live. */
export interface LiveEvent {
  type: string;
  data: unknown;
}

interface Envelope {
  type: string;
  data?: unknown;
}

const isEnvelope = (x: unknown): x is Envelope =>
  typeof x === 'object' &&
  x !== null &&
  'type' in x &&
  typeof x.type === 'string';

const isChange = (x: unknown): x is Change =>
  typeof x === 'object' &&
  x !== null &&
  'seq' in x &&
  typeof x.seq === 'number' &&
  'kind' in x &&
  typeof x.kind === 'string' &&
  'id' in x &&
  typeof x.id === 'string' &&
  'op' in x &&
  typeof x.op === 'string';

/** One message from the stream, given to the store. Exported for tests. */
export function dispatch(
  store: Store,
  raw: string,
  lastEventId: string,
  live: (e: LiveEvent) => void,
): void {
  const id = Number(lastEventId);
  let msg: unknown;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }
  if (!isEnvelope(msg)) return;
  switch (msg.type) {
    case 'change':
      if (isChange(msg.data)) store.apply(msg.data);
      return;
    case 'resync': {
      // Where the log starts now: in the data, else the event's id. Neither
      // is a log that started again from nothing.
      const data = msg.data as { seq?: unknown } | undefined;
      const seq =
        typeof data?.seq === 'number'
          ? data.seq
          : lastEventId !== '' && Number.isFinite(id)
            ? id
            : 0;
      store.resync(seq);
      return;
    }
    default:
      // Any event with an id says how far the log is: the first one on a
      // new connection says where it starts.
      if (id > 0) store.heard(id);
      if (msg.type !== 'open') live({ type: msg.type, data: msg.data });
  }
}

/** How long reads wait for the stream to open before going anyway. */
export const OPEN_WAIT_MS = 3000;
/** Waits before opening a closed stream again: doubling, up to the last. */
export const RETRY_MS = [1000, 2000, 5000, 10_000, 30_000];

/**
 * Opens the stream for a store; returns its close. `live` hears every event
 * that is not logged.
 *
 * EventSource opens a dropped connection again by itself, sending
 * `Last-Event-ID`. It gives up only on an answer that isn't a stream (the
 * server restarting behind a proxy, a missing route); then this opens a new
 * one from the last seq the page heard, after a wait that grows. A page that
 * had heard none reads everything on screen again once it is back.
 */
export function connect(
  store: Store,
  live: (e: LiveEvent) => void = () => undefined,
  url: string = STREAM_URL,
): () => void {
  let es: EventSource | undefined;
  let tries = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let wentEarly = false;
  const slow = setTimeout(() => {
    wentEarly = true;
    store.readAnyway();
  }, OPEN_WAIT_MS);

  const open = (again: boolean) => {
    const from = store.seq;
    const src = new EventSource(
      again && from > 0 ? `${url}?after=${String(from)}` : url,
    );
    es = src;
    src.onopen = () => {
      clearTimeout(slow);
      tries = 0;
      store.open();
      // Reads that went before the stream could tell of changes after them
      // (it was slow, or gone and with no seq to resume from): read again.
      if (wentEarly || (again && from === 0)) {
        wentEarly = false;
        store.rereadAll();
      }
    };
    src.onmessage = (ev: MessageEvent<string>) => {
      dispatch(store, ev.data, ev.lastEventId, live);
    };
    src.onerror = () => {
      if (src.readyState !== EventSource.CLOSED) {
        store.reconnecting();
        return;
      }
      store.lose();
      if (closed) return;
      const wait = RETRY_MS[Math.min(tries, RETRY_MS.length - 1)] ?? 30_000;
      tries++;
      retry = setTimeout(() => {
        open(true);
      }, wait);
    };
  };
  open(false);

  return () => {
    closed = true;
    clearTimeout(slow);
    clearTimeout(retry);
    es?.close();
  };
}
