import { post } from '@/api/client';
import type { Done, Entry, Undone } from '@/api/gen/action';
import { ACTIONS, type ActionId, type ActionInputs } from '@/api/gen/actions';
import type { Condition } from '@/api/gen/condition';

/**
 * Everything the student does goes through here: one route per action,
 * `POST /api/actions/{id}`, typed by the generated catalog, so a wrong input
 * is a compile error and not a 400. A refusal throws the server's ApiError
 * (`action.blocked`, your input, a conflict), like any other call.
 *
 * Nothing here touches what is on screen: the change stream brings the new
 * copies, and the store keeps the higher seq (`Done.seq` says how far the
 * log had got, so a screen can wait for its copy to catch up).
 */
export function runAction<A extends ActionId>(
  id: A,
  input: ActionInputs[A],
): Promise<Done> {
  return post<Done>(`/api/actions/${id}`, input);
}

/** The catalog entry of an action: its name, key, needs and whether it can be
 *  undone or costs. */
export const entryOf = (id: ActionId): Entry => ACTIONS[id];

/** A reply Undo can take back. The server leaves `action` out when there is
 *  nothing to undo (it changed nothing, or can't be undone), and Undo is
 *  offered only then: an Undo with no id would take back something else. */
export const canUndo = (done: Done): done is Done & { action: string } =>
  done.action !== undefined && done.action !== '';

/** Takes one action back: the Undo on "Removed Problem set 4. Undo". */
export const undoAction = (action: string): Promise<Undone> =>
  post<Undone>('/api/undo', { action });

/** Ctrl+Z: the newest action of the student's not yet undone. Pressed again,
 *  it walks further back; it never toggles. */
export const undoNewest = (): Promise<Undone> =>
  post<Undone>('/api/undo', { newest: true });

/** Puts back what an undo took back: an undo is an action, and undoing it is
 *  redo. */
export const redo = (undone: Undone): Promise<Undone> =>
  undoAction(undone.undo);

/**
 * The condition that stops an action from running, if one does: the first of
 * its `needs` that does not hold (C5: said at the action, before the student
 * tries). A condition the page has no copy of yet is taken to hold, so a
 * button is never greyed out by a list still loading; the server refuses it
 * with `action.blocked` if it doesn't.
 */
export function blockedBy(
  id: ActionId,
  conditions: readonly Condition[],
): Condition | undefined {
  const needs = ACTIONS[id].needs;
  if (needs.length === 0) return undefined;
  return conditions.find((c) => needs.includes(c.id) && !c.holds);
}
