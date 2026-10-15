import { ERRORS, type ErrorId } from './gen/errors';
import type { View } from './gen/errs';

/** A catalog entry as the view the server would have sent for it, for the
 *  two failures only the web app sees: a server that doesn't answer, and an
 *  answer that isn't the error shape. The words are the catalog's. */
export function viewOf(id: ErrorId): View {
  const e = ERRORS[id];
  return {
    id,
    what: e.what,
    why: e.why,
    fix: e.fix,
    action: e.action,
    scope: e.scope,
    chain: [id],
  };
}

/**
 * Every failed call throws this: the server's error `View` (internal/errs).
 * A screen shows `view` with ErrorNotice, or switches on `view.id`; `message`
 * is the what, for the places that print one line.
 */
export class ApiError extends Error {
  readonly view: View;
  readonly status: number;

  constructor(status: number, view: View) {
    super(view.what);
    this.name = 'ApiError';
    this.status = status;
    this.view = view;
  }

  /** The input at fault, when the error is about one. */
  get field(): string | undefined {
    return this.view.field;
  }
}

/** The view of anything that was thrown: an ApiError's own, else the
 *  catalog's fallback. */
export function errorView(e: unknown): View {
  return e instanceof ApiError ? e.view : viewOf('internal.unexpected');
}

/** The server's error view from a response body, or the fallback when the
 *  body isn't one (a proxy's page, a crash). */
function errorBody(data: unknown): View {
  if (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof data.id === 'string' &&
    'what' in data &&
    typeof data.what === 'string'
  ) {
    return data as View;
  }
  return viewOf('internal.unexpected');
}

/** One fetch wrapper for the whole app. JSON in, JSON out; 204 is
 *  `undefined`. A server that doesn't answer at all is `request.unreachable`. */
export async function api<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers:
        body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, viewOf('request.unreachable'));
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, errorBody(data));
  }
  return data as T;
}

/** A file upload, as multipart form data: the same answers and errors as
 *  `api`, without the JSON body. */
export async function postForm<T>(path: string, body: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', body });
  } catch {
    throw new ApiError(0, viewOf('request.unreachable'));
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, errorBody(data));
  }
  return data as T;
}

/**
 * Where the pictures and documents an `<img>` or a new tab loads come from.
 * They are plain URLs, so `fetch` can't be stubbed under them: every such
 * URL passes through here, and /views points it at samples of its own so a
 * view never asks a real server for a scan.
 */
export const assets = { url: (path: string): string => path };

export const get = <T>(path: string) => api<T>('GET', path);
export const post = <T>(path: string, body?: unknown) =>
  api<T>('POST', path, body);
export const put = <T>(path: string, body?: unknown) =>
  api<T>('PUT', path, body);
export const patch = <T>(path: string, body?: unknown) =>
  api<T>('PATCH', path, body);
export const del = <T>(path: string) => api<T>('DELETE', path);
