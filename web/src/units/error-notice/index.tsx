import { Check, Copy, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import type { View } from '@/api/gen/errs';
import { Button } from '@/units/button';

/** What the notice says: the error catalog's words (design/errors.md). `why`
 *  may be a list, such as what was tried. */
export type ErrorWords = Pick<View, 'what'> &
  Partial<Pick<View, 'fix' | 'chain' | 'incident'>> & {
    why?: string | readonly string[];
  };

/** One thing to do about it. */
export interface ErrorAction {
  label: string;
  onPress?: () => void;
}

/** Every error in PSet, in one of two forms (error-notice-d1).
 *
 *  Line: one red line with its glyph, and at most one quiet action after it.
 *  Under a field (no action) or in a flow, such as a failed answer in Ask.
 *
 *  Block: the glyph and `what` in red, `why` and `fix` as muted lines under
 *  it, the actions (the first is primary), and a closed Details with the
 *  catalog ids and the incident to copy. No border (error-notice-d2). A pane
 *  that failed as a whole centres a block; the block does not fill it. */
export function ErrorNotice({
  variant = 'block',
  error,
  actions = [],
  startDetails,
}: {
  variant?: 'line' | 'block';
  /** Opens Details at first (the design page). */
  startDetails?: boolean;
  error: ErrorWords;
  /** Only actions that can work (error-notice-d3): no Try again when the fix
   *  must come first. A line takes the first only. */
  actions?: readonly ErrorAction[];
}) {
  if (variant === 'line') {
    const action = actions[0];
    const text = error.fix ? `${error.what} ${error.fix}` : error.what;
    return (
      <div
        role="alert"
        className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
      >
        <p className="ds-small flex min-w-0 items-start gap-1 text-(--ds-danger)">
          <TriangleAlert className="mt-[4px] size-3 shrink-0" aria-hidden />
          <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
        </p>
        {action && (
          <Button variant="quiet" onPress={action.onPress}>
            {action.label}
          </Button>
        )}
      </div>
    );
  }

  const why =
    typeof error.why === 'string' ? (
      <p className="ds-small text-(--ds-fg-muted)">{error.why}</p>
    ) : error.why && error.why.length > 0 ? (
      <ul className="ds-small list-disc space-y-1 pl-4 text-(--ds-fg-muted)">
        {error.why.map((w) => (
          <li key={w} className="[overflow-wrap:anywhere]">
            {w}
          </li>
        ))}
      </ul>
    ) : null;
  const hasDetails = (error.chain?.length ?? 0) > 0 || Boolean(error.incident);
  return (
    <div role="alert" className="min-w-0 max-w-[560px] space-y-2 text-left">
      <p className="ds-body flex min-w-0 items-start gap-2 font-medium text-(--ds-danger)">
        <TriangleAlert className="mt-[3px] size-4 shrink-0" aria-hidden />
        <span className="min-w-0 [overflow-wrap:anywhere]">{error.what}</span>
      </p>
      {(why || error.fix) && (
        <div className="space-y-1 pl-6">
          {why}
          {error.fix && (
            <p className="ds-small text-(--ds-fg-muted)">{error.fix}</p>
          )}
        </div>
      )}
      {(actions.length > 0 || hasDetails) && (
        <div className="flex flex-wrap items-center gap-2 pt-1 pl-6">
          {actions.map((a, i) => (
            <Button
              key={a.label}
              variant={i === 0 ? 'primary' : 'default'}
              onPress={a.onPress}
            >
              {a.label}
            </Button>
          ))}
          {hasDetails && <Details error={error} start={startDetails} />}
        </div>
      )}
    </div>
  );
}

/** The catalog ids and the incident, closed until asked for, with Copy, for
 *  a bug report. */
function Details({ error, start }: { error: ErrorWords; start?: boolean }) {
  const [open, setOpen] = useState(start ?? false);
  const [copied, setCopied] = useState<'yes' | 'failed'>();
  const text = [
    error.what,
    error.chain?.join(' > '),
    error.incident && `Incident ${error.incident}`,
  ]
    .filter(Boolean)
    .join('\n');
  let shown: ReactNode = null;
  if (open)
    shown = (
      <div className="flex w-full min-w-0 items-center gap-2 rounded-(--ds-radius-control) bg-(--ds-bg-inset) py-1 pr-1 pl-3">
        <p className="ds-code min-w-0 flex-1 text-(--ds-fg-muted) [overflow-wrap:anywhere]">
          {error.chain?.join(' > ')}
          {error.incident && ` · incident ${error.incident}`}
        </p>
        <Button
          variant="quiet"
          icon={copied === 'yes' ? Check : Copy}
          onPress={() => {
            // A refused clipboard says so instead of failing quietly.
            navigator.clipboard.writeText(text).then(
              () => {
                setCopied('yes');
              },
              () => {
                setCopied('failed');
              },
            );
          }}
        >
          {copied === 'yes'
            ? 'Copied'
            : copied === 'failed'
              ? "Couldn't copy"
              : 'Copy'}
        </Button>
      </div>
    );
  return (
    <>
      <Button
        variant="quiet"
        onPress={() => {
          setOpen((o) => !o);
        }}
      >
        {open ? 'Hide details' : 'Details'}
      </Button>
      {shown}
    </>
  );
}
