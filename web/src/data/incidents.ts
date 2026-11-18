import { ApiError, post } from '@/api/client';
import type { Done } from '@/api/gen/action';
import type { Resource } from '@/api/gen/change';
import type { Incident, PageReport } from '@/api/gen/incident';

import { runAction } from './actions';

/**
 * The page's side of the error module (`ideas/errors-grill.md`): failures
 * only the page sees become incidents like any other, and Try again and
 * Dismiss are actions. Where each incident is shown (once, at the closest
 * owner on screen) needs incidents from the change stream, and comes with
 * the store.
 *
 * What the page reports is its own failures only: a crash, a promise nobody
 * caught, a dead stream. A failed request is not reported again: the server
 * kept it already if it was a failure (a 5xx), and a refusal or your input is
 * answered, not kept.
 */

/** What the failing part of the page was about, when it names one thing. */
export interface About {
  subjectKind?: Resource;
  subjectId?: string;
  action?: string;
}

/** The same failure is sent at most once in this long: a part that fails on
 *  every change would otherwise report on every change (the loop
 *  `design/backend.md` warns of). The server counts repeats by itself. */
export const REPORT_EVERY_MS = 60_000;
/** And at most this many reports a page load, whatever they are. */
export const REPORTS_MAX = 20;

const sentAt = new Map<string, number>();
let sent = 0;

/** The text and stack of anything thrown. */
function detailOf(e: unknown): string {
  if (e instanceof Error) return e.stack ?? `${e.name}: ${e.message}`;
  try {
    // undefined for a function or undefined, whatever the types say.
    const json = JSON.stringify(e) as string | undefined;
    return json ?? String(e);
  } catch {
    return 'An unprintable value was thrown.';
  }
}

/** What names a failure for the throttle: an Error's name and message (a
 *  stack's first line is the message in Chrome, but the top frame in Firefox
 *  and Safari), else the first line of what was thrown. */
function nameOf(e: unknown, detail: string): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  return detail.split('\n')[0] ?? '';
}

/**
 * Keeps a failure of the page as an incident, and says which one. A request's
 * own failure (an ApiError) is not reported: it is the server's to keep. A
 * report that can't be sent is dropped: there is nobody left to tell. It still
 * uses its minute and its place in the cap, so a server that is down is not
 * asked again and again. Never rejects: a rejection here would be reported
 * here, for ever.
 */
export async function reportFailure(
  e: unknown,
  about: About = {},
  now: () => number = Date.now,
): Promise<Incident | undefined> {
  try {
    return await report(e, about, now);
  } catch {
    return undefined;
  }
}

async function report(
  e: unknown,
  about: About,
  now: () => number,
): Promise<Incident | undefined> {
  if (e instanceof ApiError) return undefined;
  const detail = detailOf(e);
  const route = window.location.pathname;
  const key = `${route}\n${about.subjectKind ?? ''}:${about.subjectId ?? ''}\n${nameOf(e, detail)}`;
  const last = sentAt.get(key);
  if (last !== undefined && now() - last < REPORT_EVERY_MS) return undefined;
  if (sent >= REPORTS_MAX) return undefined;
  sentAt.set(key, now());
  sent++;
  const body: PageReport = {
    // The page has no catalog entry of its own for a crash (gap 5 in
    // ideas/backend-courses.md): it is PSet's own unexpected failure.
    chain: ['internal.unexpected'],
    links: [{}],
    detail,
    route,
    ...about,
  };
  return await post<Incident>('/api/incidents', body);
}

/**
 * Reports every error and rejected promise nothing else caught, for the
 * whole page. Mounted once, by the shell; returns its undo.
 */
export function catchFailures(): () => void {
  const onError = (ev: ErrorEvent) => {
    // An event with no error is not PSet's: the browser's own notices
    // ("ResizeObserver loop completed ...") and other origins' scripts
    // ("Script error."), whose errors are hidden from the page.
    if (ev.error === null || ev.error === undefined) return;
    void reportFailure(ev.error);
  };
  const onRejection = (ev: PromiseRejectionEvent) => {
    void reportFailure(ev.reason);
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}

/** Try again: reruns the failed step, or heals the condition it waits on. */
export const tryAgain = (id: string): Promise<Done> =>
  runAction('incident.try_again', { id });

/** Puts an incident away. It can be undone. */
export const dismiss = (id: string): Promise<Done> =>
  runAction('incident.dismiss', { id });

/** Forgets what was sent: tests only. */
export function resetReportsForTest(): void {
  sentAt.clear();
  sent = 0;
}
