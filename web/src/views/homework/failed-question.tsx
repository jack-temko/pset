import { useState } from 'react';
import { CircleAlert, SquareDashedMousePointer } from 'lucide-react';
import { AutoTextarea, Field, Input } from '@/components/input';
import { Button } from '@/components/button';
import { useBoxing } from '@/pages/workspace/boxing-state';
import type { Failure, Question, Retry } from '@/api/homework';
import { usePages } from '@/lib/pages';
import { failedLine } from './failed-line';

/**
 * A question the engine couldn't write a guide for, as a recoverable
 * state about that question: a title naming what failed, a sentence
 * saying what happened, and the ways out that fit the kind. Not found:
 * give the page. The guide didn't finish, or the provider didn't answer:
 * Try again. The connection is wrong: Open Settings. Below, where it can
 * help, pasting the problem as a fallback. Every action is enabled; one
 * with nothing to go on says what it needs.
 */
export function FailedQuestion({
  q,
  onRetry,
  onOpenSettings,
}: {
  q: Question;
  onRetry: (r: Retry) => void;
  /** The way out of a setup failure: the OpenRouter key is fixed in Settings. */
  onOpenSettings: () => void;
}) {
  const pages = usePages();
  const boxing = useBoxing();
  const [page, setPage] = useState('');
  const [text, setText] = useState('');
  const [pageError, setPageError] = useState('');
  const [textError, setTextError] = useState('');
  // A plain text field, not a number spinner: people type "57", "p. 57"
  // or "page 57", and all of them mean the first number in it.
  const pageNumber = Number(page.match(/\d+/)?.[0] ?? 0);
  // Failed before failures had kinds: found (or never looked for) means
  // the guide failed, otherwise it wasn't found.
  const kind: Failure =
    q.failure ||
    (q.page !== undefined || !q.inBook ? 'generation' : 'not_found');
  const name = /^\d/.test(q.label) ? q.label : 'this question';

  const title = {
    generation: "Couldn't write the guide",
    unavailable: "OpenRouter isn't responding",
    setup: 'OpenRouter needs setting up',
    not_found: `Couldn't find ${name} in this book`,
  }[kind];

  const retryButton = (variant: 'primary' | 'ghost') => (
    <Button
      variant={variant}
      onClick={() => {
        onRetry({});
      }}
    >
      Try again
    </Button>
  );

  // Pasting helps when the book is the trouble (not found, or found and
  // read wrong); it can't help a model that isn't answering.
  const fallback =
    kind === 'not_found'
      ? {
          title: 'Not from this book?',
          body: 'Paste the problem, and the guide is written from your text alone.',
        }
      : kind === 'generation' && q.inBook
        ? {
            title: 'Having trouble with this problem?',
            body: 'If the problem above looks wrong, paste it, and the guide is written from your text instead.',
          }
        : null;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-base font-semibold">
            <CircleAlert className="size-4 shrink-0 text-destructive" />
            {title}
          </p>
          <p className="text-sm text-muted-foreground">{q.reason}</p>
          {/* A second failure says it is one; a model outage, how long ago. */}
          {failedLine(q) && (
            <p className="text-xs text-muted-foreground">{failedLine(q)}</p>
          )}
        </div>

        {kind === 'not_found' ? (
          <div className="space-y-3">
            {/* The way out that always works: show it on the page. */}
            <Button
              onClick={() => {
                boxing.start({ kind: 'find', questionId: q.id, label: name });
              }}
            >
              <SquareDashedMousePointer />
              Show me where it is
            </Button>
            <form
              className="flex items-start gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (pageNumber > 0)
                  onRetry({ page: pages.nearest(pageNumber) });
                else setPageError('Type the page number first.');
              }}
            >
              <Field
                label="Printed page"
                error={pageError || undefined}
                className="w-40"
              >
                <Input
                  inputMode="numeric"
                  value={page}
                  onChange={(e) => {
                    setPage(e.target.value);
                    setPageError('');
                  }}
                  className="tabular-nums"
                />
              </Field>
              {/* Level with the input, under the field's label. */}
              <Button type="submit" variant="outline" className="mt-6">
                Look there
              </Button>
            </form>
          </div>
        ) : kind === 'setup' ? (
          <div className="flex items-center gap-2">
            <Button onClick={onOpenSettings}>Open Settings</Button>
            {retryButton('ghost')}
          </div>
        ) : (
          retryButton('primary')
        )}
      </div>

      {fallback && (
        <div className="space-y-2 border-t pt-5">
          <p className="text-sm font-medium">{fallback.title}</p>
          <p className="text-xs text-muted-foreground">{fallback.body}</p>
          {/* A real text box: a whole question gets pasted here, so it
              starts four lines tall and grows from there. */}
          <AutoTextarea
            rows={4}
            value={text}
            placeholder="Paste the problem"
            className="py-2"
            onChange={(e) => {
              setText(e.target.value);
              setTextError('');
            }}
          />
          {textError && <p className="text-xs text-destructive">{textError}</p>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (text.trim()) onRetry({ text: text.trim() });
              else setTextError('Paste the problem first.');
            }}
          >
            Use this text
          </Button>
        </div>
      )}
    </div>
  );
}
