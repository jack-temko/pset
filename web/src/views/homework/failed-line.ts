import type { Question } from '@/api/homework';
import { failureKind } from './failure-kind';

/** How long ago, in words that read mid-sentence. */
export function agoWords(ms: number): string {
  const m = Math.floor(Math.max(ms, 0) / 60_000);
  if (m < 1) return 'just now';
  if (m === 1) return 'a minute ago';
  if (m < 60) return `${m} minutes ago`;
  const h = Math.floor(m / 60);
  return h === 1 ? 'an hour ago' : `${h} hours ago`;
}

/**
 * What a failed question adds to its sentence: that this is not the first
 * time, or, for a model that is not answering, when it last failed, so the
 * student can tell whether to wait. Nothing when there is nothing to add.
 */
export function failedLine(q: Question, now = Date.now()): string | null {
  const at = q.failedAt ? Date.parse(q.failedAt) : NaN;
  const ago = Number.isNaN(at) ? '' : agoWords(now - at);
  const tries = q.attempts ?? 0;
  if (tries > 0)
    return `${tries === 1 ? 'Tried once more' : `Tried ${tries} more times`} and it failed again${ago ? `, ${ago}` : ''}.`;
  if (failureKind(q.error) === 'unavailable' && ago) return `It failed ${ago}.`;
  return null;
}
