import type { View } from '@/api/gen/errs';

/** The error in one line, for a dense row or a confirm: what it was, and the
 *  fix when it has one. */
export function errorLine(view: View): string {
  return view.fix ? `${view.what} ${view.fix}` : view.what;
}

/** The ids and incident, as text to paste into a bug report. */
export function detailsText(view: View): string {
  return [
    view.what,
    view.chain.join(' > '),
    view.incident && `Incident ${view.incident}`,
  ]
    .filter(Boolean)
    .join('\n');
}
