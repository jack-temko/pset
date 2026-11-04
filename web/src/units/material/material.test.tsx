import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Material } from './index';
import { pageMemory } from './memory';
import { GRIFFITHS } from './sample';
import { pdfOf, printedOf } from './types';

// A whole screen in jsdom takes several times its solo time when the suite
// runs on every core at once (0.5 s alone, seconds under `make check`). These
// tests use fake time and wait on nothing; the default 5 s only measures a
// busy machine. Other files keep the 5 s.
vi.setConfig({ testTimeout: 15_000 });

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
function setValue(input: HTMLInputElement, value: string) {
  // React tracks the value itself, so set it through the prototype's setter.
  const proto = Object.getPrototypeOf(input) as HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
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
    expect(a.querySelector('input')?.value).toBe('112');
    expect(a.textContent).toContain('/ 640');
    const b = render(<Material {...base} memory={pageMemory()} startPdf={3} />);
    expect(b.textContent).toContain('PDF 3');
    expect(b.textContent).not.toContain('/ 640');
  });

  it('goes to the nearest page for a number past either end', () => {
    for (const [typed, want] of [
      ['900', '640'],
      ['0', '1'],
      ['-4', '1'],
    ] as const) {
      const fired: number[] = [];
      const el = render(
        <Material
          {...base}
          memory={pageMemory()}
          page={112}
          onPage={(p) => fired.push(p)}
        />,
      );
      const box = el.querySelector('input');
      if (!box) throw new Error('no page box');
      act(() => {
        box.focus();
      });
      act(() => {
        setValue(box, typed);
      });
      act(() => {
        box.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
      });
      expect(el.textContent).not.toContain('No p.');
      expect(box.value).toBe(want);
    }
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
