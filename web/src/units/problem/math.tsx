import 'katex/dist/katex.min.css';
import katex from 'katex';
import { Fragment } from 'react';

import { MATH_OPTIONS } from '@/lib/math';
import type { Run } from './types';

function tex(src: string, display: boolean) {
  return katex.renderToString(src, {
    ...MATH_OPTIONS,
    displayMode: display,
    throwOnError: false,
  });
}

/** Runs as the wire sends them: text with its marks, inline and display
 *  math, a citation as "p. 112". Math that did not parse shows as its
 *  source, quiet. The runs are drawn as they come; nothing here parses a
 *  string. */
export function Runs({ runs }: { runs: readonly Run[] }) {
  return (
    <>
      {runs.map((r, i) => {
        if (r.m !== undefined) {
          if (r.raw)
            return (
              <code
                key={i}
                className="rounded-(--ds-radius-segment) bg-(--ds-neutral-soft) px-1 text-(--ds-fg-muted)"
              >
                {r.m}
              </code>
            );
          return r.d ? (
            <span
              key={i}
              className="my-2 block overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: tex(r.m, true) }}
            />
          ) : (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: tex(r.m, false) }}
            />
          );
        }
        if (r.cite) return <Fragment key={i}>p. {r.cite}</Fragment>;
        const text = r.t ?? '';
        if (r.code)
          return (
            <code key={i} className="text-(--ds-fg-muted)">
              {text}
            </code>
          );
        if (r.b) return <strong key={i}>{text}</strong>;
        if (r.i) return <em key={i}>{text}</em>;
        return <Fragment key={i}>{text}</Fragment>;
      })}
    </>
  );
}
