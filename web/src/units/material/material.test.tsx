import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Material } from './index';
import { pageMemory } from './memory';
import { GRIFFITHS } from './sample';
import { pdfOf, printedOf } from './types';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
function render(node: ReactNode) {
  const el = document.createElement('div');
  document.body.append(el);
  const root = createRoot(el);
  roots.push(root);
  act(() => {
    root.render(node);
  });
  return el;
}
afterEach(() => {
  act(() => {
    for (const r of roots.splice(0)) r.unmount();
  });
  document.body.replaceChildren();
});
const button = (el: Element, name: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent === name);

describe('printed pages', () => {
  it('number the PDF pages after the front matter and none before', () => {
    expect(printedOf(GRIFFITHS, 3)).toBeUndefined();
    expect(printedOf(GRIFFITHS, 13)).toBe(1);
    expect(printedOf(GRIFFITHS, 652)).toBe(640);
    expect(printedOf(GRIFFITHS, 653)).toBeUndefined();
    expect(pdfOf(GRIFFITHS, 112)).toBe(124);
  });
});

describe('Material', () => {
  const base = { name: 'Griffiths', book: GRIFFITHS, tabId: 't' } as const;

  it('shows the printed page, and PDF 3 on an unnumbered one', () => {
    const a = render(<Material {...base} memory={pageMemory()} page={112} />);
    expect(a.textContent).toContain('p. 112');
    expect(a.textContent).toContain('of 640');
    const b = render(<Material {...base} memory={pageMemory()} startPdf={3} />);
    expect(b.textContent).toContain('PDF 3');
    expect(b.textContent).not.toContain('of 640');
  });

  it('says a missing page is not there and stays', () => {
    const el = render(
      <Material
        {...base}
        memory={pageMemory()}
        page={112}
        startGoTo={{ text: '900', entered: true }}
      />,
    );
    expect(el.textContent).toContain('No p. 900, the book ends at 640');
  });

  it('hides Done until a box exists, and Cancel calls back', () => {
    const cancel = vi.fn();
    const none = render(
      <Material
        {...base}
        memory={pageMemory()}
        page={112}
        boxing={{ label: '4.62' }}
        onCancel={cancel}
      />,
    );
    expect(none.textContent).toContain('Draw a box around 4.62');
    expect(button(none, 'Done')?.closest('.invisible')).not.toBeNull();
    act(() => {
      button(none, 'Cancel')?.click();
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    const some = render(
      <Material
        {...base}
        memory={pageMemory()}
        page={112}
        boxing={{ label: '4.62' }}
        startBoxes={[{ pdf: 124, x: 0.1, y: 0.1, w: 0.3, h: 0.1 }]}
      />,
    );
    expect(button(some, 'Done')?.closest('.invisible')).toBeNull();
  });

  it('opens Contents over the pages and closes it on Escape', () => {
    const el = render(
      <Material {...base} memory={pageMemory()} page={112} startContents />,
    );
    expect(el.querySelector('[data-contents]')).not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(el.querySelector('[data-contents]')).toBeNull();
  });

  it('remembers the place per tab', () => {
    const memory = pageMemory();
    render(<Material {...base} tabId="a" memory={memory} page={112} />);
    render(<Material {...base} tabId="b" memory={memory} page={45} />);
    expect(memory.get('a')?.page).toBe(112);
    expect(memory.get('b')?.page).toBe(45);
    expect(memory.get('a')?.zoom).toBe(1);
  });

  it('shows one wait while the book is read in', () => {
    const el = render(<Material {...base} status="reading" readingMin={2} />);
    expect(el.textContent).toBe('Reading Griffiths, about 2 min');
  });
});
