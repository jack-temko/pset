import { Check, CircleAlert, Copy } from 'lucide-react';
import { useState } from 'react';

import type { View } from '@/api/gen/errs';
import { Button } from '@/units/button';
import { Fold } from '@/units/fold';

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

/** The error's mark: a red circle with "!", the one red in the notice. The
 *  words stay in the reading colours (error-notice-d6). */
function Mark({ size }: { size: 'line' | 'block' }) {
  return (
    <CircleAlert
      aria-hidden
      className={`mt-[3px] shrink-0 text-(--ds-danger) ${size === 'line' ? 'size-[14px]' : 'size-4'}`}
    />
  );
}

/** Every error in PSet, in one of two forms (error-notice-d1).
 *
 *  Line: the red mark and the words in ink, and at most one outlined action
 *  after them, which wraps under the words when the line is full. Under a
 *  field (no action) or in a flow, such as a failed answer in Ask.
 *
 *  Block: a quiet box like PSet's other boxes (error-notice-d5): the mark and
 *  `what` in ink, `why` and `fix` muted under it, the actions (the first is
 *  primary), and a closed Details fold with the catalog ids and the incident
 *  to copy. A pane that failed as a whole centres a block. */
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
    const action = actions.at(0);
    const text = error.fix ? `${error.what} ${error.fix}` : error.what;
    return (
      <div
        role="alert"
        className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2"
      >
        <p className="ds-small flex min-w-0 items-start gap-[6px] text-(--ds-fg)">
          <Mark size="line" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
        </p>
        {action && <Button onPress={action.onPress}>{action.label}</Button>}
      </div>
    );
  }

  const why =
    typeof error.why === 'string' ? (
      <p className="[overflow-wrap:anywhere]">{error.why}</p>
    ) : error.why && error.why.length > 0 ? (
      <ul className="list-disc space-y-1 pl-4 marker:text-(--ds-fg-muted)">
        {error.why.map((w) => (
          <li key={w} className="[overflow-wrap:anywhere]">
            {w}
          </li>
        ))}
      </ul>
    ) : null;
  const hasDetails = (error.chain?.length ?? 0) > 0 || Boolean(error.incident);
  return (
    <div
      role="alert"
      className="flex w-full max-w-[560px] min-w-0 gap-3 rounded-(--ds-radius-control) border border-(--ds-border) bg-(--ds-bg-raised) p-4 text-left"
    >
      <Mark size="block" />
      <div className="min-w-0 flex-1">
        <p className="ds-body font-medium text-(--ds-fg) [overflow-wrap:anywhere]">
          {error.what}
        </p>
        {(why || error.fix) && (
          <div className="ds-small mt-1 space-y-1 text-(--ds-fg-muted)">
            {why}
            {error.fix && (
              <p className="[overflow-wrap:anywhere]">{error.fix}</p>
            )}
          </div>
        )}
        {actions.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {actions.map((a, i) => (
              <Button
                key={a.label}
                variant={i === 0 ? 'primary' : 'default'}
                onPress={a.onPress}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
        {hasDetails && (
          <div className={actions.length > 0 ? 'mt-2' : 'mt-1'}>
            <Fold label="Details" defaultOpen={startDetails}>
              <Details error={error} />
            </Fold>
          </div>
        )}
      </div>
    </div>
  );
}

/** The catalog ids and the incident, in mono, with Copy, for a bug
 *  report. */
function Details({ error }: { error: ErrorWords }) {
  const [copied, setCopied] = useState<'yes' | 'failed'>();
  const text = [
    error.what,
    error.chain?.join(' > '),
    error.incident && `Incident ${error.incident}`,
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <div className="mt-1 flex w-full min-w-0 items-center gap-2 rounded-(--ds-radius-control) bg-(--ds-bg-inset) py-1 pr-1 pl-3">
      <p className="ds-code min-w-0 flex-1 text-(--ds-fg-muted) [overflow-wrap:anywhere]">
        {error.chain?.join(' > ')}
        {error.incident && (
          <span className="whitespace-nowrap">
            {` · incident ${error.incident}`}
          </span>
        )}
      </p>
      <Button
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
}
