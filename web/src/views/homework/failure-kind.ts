import type { View } from '@/api/gen/errs';

/** What a failed question needs, read from the ids of its error. */
export type FailureKind = 'not_found' | 'setup' | 'unavailable' | 'generation';

/**
 * Which way out a failed question offers. Not found: show the page, give a
 * page, or paste it. Setup: the key (the notice's own action). Unavailable:
 * the model isn't answering. Anything else is the guide failing to land.
 */
export function failureKind(e: View | undefined): FailureKind {
  const ids = e?.chain ?? [];
  if (ids.includes('homework.not_found_in_book')) return 'not_found';
  if (ids.some((id) => id.startsWith('key.'))) return 'setup';
  if (ids.includes('model.busy') || ids.includes('model.unreachable'))
    return 'unavailable';
  return 'generation';
}
