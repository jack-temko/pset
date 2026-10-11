import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { useErrorAction } from '@/api/error-actions';
import type { View } from '@/api/gen/errs';
import { Button } from '@/components/button';
import { detailsText } from '@/lib/error-text';
import { cn } from '@/lib/utils';

/**
 * What went wrong, where it went wrong: the error's `what` in body weight,
 * its `why` and `fix` as quiet lines, the one button it asks for, and a small
 * Details link that opens the chain of ids and the incident id with a Copy.
 * A field error is only its line, red, and nothing else.
 *
 * Spec: design/errors.md (the table), ideas/error-catalog-grill.md.
 */
export function ErrorNotice({
  error,
  onRetry,
  className,
}: {
  error: View;
  /** What "Try again" does: the call that failed. Without it, no button. */
  onRetry?: () => void;
  className?: string;
}) {
  const action = useErrorAction(error, onRetry);
  if (error.scope === 'field') {
    return (
      <p className={cn('text-xs text-destructive', className)}>{error.what}</p>
    );
  }
  return (
    <div
      role="alert"
      className={cn(
        'space-y-3 rounded-md border border-destructive bg-card p-card',
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-base font-medium">{error.what}</p>
        {error.why && (
          <p className="text-sm text-muted-foreground">{error.why}</p>
        )}
        {error.fix && (
          <p className="text-sm text-muted-foreground">{error.fix}</p>
        )}
      </div>
      {(action || error.chain.length > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          {action && <Button onClick={action.run}>{action.label}</Button>}
          <Details error={error} />
        </div>
      )}
    </div>
  );
}

/** The collapsed Details: the chain of ids and the incident id, with Copy. */
function Details({ error }: { error: View }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="min-w-0 space-y-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
        className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Details
      </button>
      {open && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
          <p className="font-mono text-xs break-all text-muted-foreground">
            {error.chain.join(' > ')}
            {error.incident && ` · incident ${error.incident}`}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard
                .writeText(detailsText(error))
                .then(() => {
                  setCopied(true);
                });
            }}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      )}
    </div>
  );
}
