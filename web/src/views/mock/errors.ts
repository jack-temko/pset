import { ERRORS, type ErrorId } from '@/api/gen/errors';
import type { View } from '@/api/gen/errs';

/**
 * An error as the server would send it, composed from the catalog for a
 * scenario: the what from the outermost id, the why, fix and action from
 * the deepest that has them (internal/errs, D5). `params` fill the
 * `{name}` placeholders.
 */
export function mockError(
  chain: ErrorId[],
  params: Record<string, string> = {},
  incident?: string,
): View {
  const fill = (text: string) =>
    text.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? `{${k}}`);
  const outer = ERRORS[chain[0]];
  const deepest = (pick: (e: (typeof ERRORS)[ErrorId]) => string | undefined) =>
    [...chain]
      .reverse()
      .map((id) => pick(ERRORS[id]))
      .find(Boolean);
  const action = [...chain]
    .reverse()
    .map((id) => ERRORS[id].action)
    .find(Boolean);
  const why = deepest((e) => e.why);
  const fix = deepest((e) => e.fix);
  return {
    id: chain[0],
    what: fill(outer.what),
    why: why && fill(why),
    fix: fix && fill(fix),
    action,
    scope: outer.scope,
    incident,
    chain,
  };
}
