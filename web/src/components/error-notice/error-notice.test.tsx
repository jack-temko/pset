import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { View } from '@/api/gen/errs';
import { detailsText, errorLine } from '@/lib/error-text';
import { ErrorNotice } from '.';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const view: View = {
  id: 'import.failed',
  what: "Couldn't prepare Calculus.",
  why: "Your OpenRouter account is out of credit, so PSet can't read the pages.",
  fix: 'Add credit on OpenRouter, then try again.',
  action: 'retry',
  scope: 'inline',
  incident: 'E7K2QF',
  chain: ['import.failed', 'key.out_of_credit'],
};

function render(error: View, onRetry?: () => void) {
  const host = document.createElement('div');
  const root = createRoot(host);
  act(() => {
    root.render(
      <MemoryRouter>
        <ErrorNotice error={error} onRetry={onRetry} />
      </MemoryRouter>,
    );
  });
  const button = (name: string) =>
    [...host.querySelectorAll('button')].find((b) => b.textContent === name);
  return { host, button };
}

describe('ErrorNotice', () => {
  it('says what, why and fix, with the ids hidden until Details opens', () => {
    const { host, button } = render(view, () => {});
    expect(host.textContent).toContain("Couldn't prepare Calculus.");
    expect(host.textContent).toContain('out of credit');
    expect(host.textContent).toContain('Add credit on OpenRouter');
    expect(host.textContent).not.toContain('key.out_of_credit');
    act(() => {
      button('Details')?.click();
    });
    expect(host.textContent).toContain('import.failed > key.out_of_credit');
    expect(host.textContent).toContain('incident E7K2QF');
  });

  it('copies the what, the ids and the incident', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { button } = render(view);
    act(() => {
      button('Details')?.click();
    });
    await act(async () => {
      button('Copy')?.click();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith(detailsText(view));
    expect(detailsText(view)).toBe(
      "Couldn't prepare Calculus.\nimport.failed > key.out_of_credit\nIncident E7K2QF",
    );
    vi.unstubAllGlobals();
  });

  it('shows the retry button only when the caller can retry', () => {
    const onRetry = vi.fn();
    const withRetry = render(view, onRetry);
    act(() => {
      withRetry.button('Try again')?.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(render(view).button('Try again')).toBeUndefined();
  });

  it('draws a field error as its one line', () => {
    const { host } = render({
      id: 'library.title_empty',
      what: 'A book needs a title.',
      scope: 'field',
      field: 'title',
      chain: ['library.title_empty'],
    });
    expect(host.textContent).toBe('A book needs a title.');
  });

  it('says an error in one line for a dense row', () => {
    expect(errorLine(view)).toBe(
      "Couldn't prepare Calculus. Add credit on OpenRouter, then try again.",
    );
  });
});
