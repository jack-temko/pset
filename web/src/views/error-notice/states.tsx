import { ErrorNotice } from '@/components/error-notice';
import { Box } from '@/components/box';
import { Field, Input } from '@/components/input';
import { ImportRow } from '@/components/import-row';
import { UnreachableBanner } from '@/components/shell';
import { sampleBook } from '@/components/fixtures';
import { Errors } from '@/pages/settings/errors';
import { viewOf } from '@/api/client';
import { mockError } from '@/views/mock/errors';
import { IMPORT_FAILED } from './sample';
import type { Harness } from '../types';

/** A: the notice where the failure happened. */
export function Inline({ harness }: { harness: Harness }) {
  return (
    <div className="max-w-xl">
      <ErrorNotice
        error={IMPORT_FAILED}
        onRetry={() => {
          harness.handoff({ to: 'Library', what: 'Try the import again' });
        }}
      />
    </div>
  );
}

/** The same failure in the shelf's row for the book, among its neighbours. */
export function Row({ harness }: { harness: Harness }) {
  return (
    <Box className="max-w-xl">
      <ImportRow
        book={sampleBook({
          sha256: 'a41c09e2',
          title: 'Calculus',
          author: '',
          state: { kind: 'failed', error: IMPORT_FAILED },
        })}
        onRetry={() => {
          harness.handoff({ to: 'Library', what: 'Try the import again' });
        }}
        onDismiss={() => {
          harness.handoff({ to: 'Library', what: 'Dismiss the failed import' });
        }}
      />
      <ImportRow
        book={sampleBook({
          sha256: '7ce04a15',
          title: 'Statistics',
          author: '',
          state: { kind: 'queued' },
        })}
      />
    </Box>
  );
}

/** B: a failure of the whole screen: the banner, once, and nothing else. */
export function Banner({ harness }: { harness: Harness }) {
  return (
    <div className="max-w-3xl overflow-hidden rounded-lg border">
      <UnreachableBanner
        view={viewOf('request.unreachable')}
        onRetry={() => {
          harness.handoff({ to: 'Screen', what: 'Try the requests again' });
        }}
      />
      <p className="p-card text-sm text-muted-foreground">
        Everything below the banner carries on as it was; no row repeats the
        failure.
      </p>
    </div>
  );
}

/** A title left empty: one line under the field. */
export function FieldLine() {
  const error = mockError(['library.title_empty']);
  return (
    <div className="max-w-sm">
      <Field label="Title" error={error.what}>
        <Input defaultValue="" aria-invalid />
      </Field>
    </div>
  );
}

/** Settings, Errors: the real section, answered by the scenario's server. */
export function Kept() {
  return (
    <div className="max-w-3xl">
      <Errors />
    </div>
  );
}
