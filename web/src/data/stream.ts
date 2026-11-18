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

/** Where the store's stream is served. The old bus still has
 *  `/api/events`; this is the route gap 1 in `ideas/backend-courses.md`
 *  asks the backend for, until the cut-over. */
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
      store.apply(msg.data as Change);
      return;
    case 'resync':
      store.resync(Number.isFinite(id) ? id : store.seq);
      return;
    default:
      live({ type: msg.type, data: msg.data });
  }
}

/**
 * Opens the stream for a store; returns its close. `live` hears every event
 * that is not logged.
 */
export function connect(
  store: Store,
  live: (e: LiveEvent) => void = () => undefined,
  url: string = STREAM_URL,
): () => void {
  const es = new EventSource(url);
  es.onopen = () => {
    store.open();
  };
  es.onmessage = (ev: MessageEvent<string>) => {
    dispatch(store, ev.data, ev.lastEventId, live);
  };
  es.onerror = () => {
    // EventSource tries again by itself after a dropped connection; it
    // gives up (CLOSED) only on an answer that isn't a stream, such as a
    // missing route.
    if (es.readyState === EventSource.CLOSED) store.lose();
    else store.reconnecting();
  };
  return () => {
    es.close();
  };
}
