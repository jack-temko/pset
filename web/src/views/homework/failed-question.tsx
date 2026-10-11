import { useState } from 'react';
import { SquareDashedMousePointer } from 'lucide-react';
import { AutoTextarea, Field, Input } from '@/components/input';
import { Button } from '@/components/button';
import { ErrorNotice } from '@/components/error-notice';
import { useBoxing } from '@/pages/workspace/boxing-state';
import type { Question, Retry } from '@/api/homework';
import { viewOf } from '@/api/client';
import { usePages } from '@/lib/pages';
import { failedLine } from './failed-line';
import { failureKind } from './failure-kind';

/**
 * A question the engine couldn't write a guide for, as a recoverable
 * state about that question: the error notice (what happened, why, and the
 * one button that fits: Try again, or Open Settings with Try again behind
 * it), and the ways out that fit the kind. Not found: show the page, give
 * the page, or paste it. Below, where it can help, pasting the problem as a
 * fallback. Every action is enabled; one with nothing to go on says what it
 * needs.
 */
export function FailedQuestion({
  q,
  onRetry,
}: {
  q: Question;
  onRetry: (r: Retry) => void;
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
  const kind = failureKind(q.error);
  const name = /^\d/.test(q.label) ? q.label : 'this question';

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
        <ErrorNotice
          error={q.error ?? viewOf('internal.unexpected')}
          onRetry={
            // Not found is retried by showing, naming or pasting it below.
            kind === 'not_found'
              ? undefined
              : () => {
                  onRetry({});
                }
          }
        />
        {/* A second failure says it is one; a model outage, how long ago. */}
        {failedLine(q) && (
          <p className="text-xs text-muted-foreground">{failedLine(q)}</p>
        )}

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
        ) : null}
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
