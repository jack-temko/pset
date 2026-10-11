import type { View } from '@/api/gen/errs';

/** The error in one line, for a dense row or a confirm: what it was, and the
 *  fix when it has one. */
export function errorLine(view: View): string {
  return view.fix ? `${view.what} ${view.fix}` : view.what;
}

/** What, why and fix in one run, for a dense line that has room for them. */
export function errorFull(view: View): string {
  return [view.what, view.why, view.fix].filter(Boolean).join(' ');
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

/** When an error happened, as the errors list says it: the time today, "Yesterday
 *  23:05", else the date and time. */
export function incidentTime(at: string, now = new Date()): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000,
  );
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`;
}
