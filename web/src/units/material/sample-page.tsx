import type { Book } from './types';
import { printedOf } from './types';

const SENTENCES = [
  'A changing flux through a loop induces an electromotive force around it.',
  'The field of a long straight wire falls off as the inverse of the distance.',
  'Inside a conductor in equilibrium the electric field is zero.',
  'Consider a thin spherical shell carrying a uniform surface charge.',
  'We now turn to the boundary conditions on the normal component of the field.',
  'The energy stored in the field is found by integrating its density over all space.',
  'Applying Stokes’ theorem to the loop gives the circulation directly.',
  'For a linear medium the polarization is proportional to the field.',
  'Example: find the potential on the axis of a uniformly charged disk.',
  'The answer does not depend on the shape of the path, only on its end points.',
];

/** A page as the sample draws it: a styled block that looks like a book page,
 *  sized in container units so it reads the same at any zoom. A real page is
 *  an image the server serves. Pages before the first printed one are front
 *  matter: the first is a cover and the rest are sparse. */
export function SamplePage({
  book,
  pdf,
  name,
  heading,
}: {
  book: Book;
  pdf: number;
  name: string;
  /** The title of a section that starts on this page. */
  heading?: string;
}) {
  const printed = printedOf(book, pdf);
  if (pdf === 1) {
    return (
      <div className="@container size-full overflow-hidden bg-(--ds-page) text-(--ds-page-ink)">
        <div className="flex size-full flex-col items-center justify-center gap-[3cqw] p-[10cqw] text-center">
          <p className="font-(family-name:--ds-font-serif) text-[6cqw] leading-[1.15] font-medium [overflow-wrap:anywhere]">
            {name}
          </p>
          <p className="font-(family-name:--ds-font-serif) text-[2.6cqw] opacity-70">
            Fourth edition
          </p>
        </div>
      </div>
    );
  }
  const lines = printed === undefined ? 5 : 22;
  return (
    <div className="@container size-full overflow-hidden bg-(--ds-page) text-(--ds-page-ink)">
      <div className="flex size-full flex-col px-[11cqw] py-[8cqw] font-(family-name:--ds-font-serif)">
        <div className="flex justify-between text-[1.9cqw] opacity-60">
          <span className="overflow-hidden whitespace-nowrap">
            {printed === undefined ? '' : name}
          </span>
          <span className="tabular-nums">{printed ?? ''}</span>
        </div>
        {heading !== undefined && (
          <p className="mt-[5cqw] text-[3.6cqw] leading-[1.2] font-medium [overflow-wrap:anywhere]">
            {heading}
          </p>
        )}
        <div className="mt-[4cqw] min-h-0 flex-1 overflow-hidden text-[2.35cqw] leading-[1.55]">
          {Array.from({ length: Math.ceil(lines / 5) }, (_, i) => (
            <p key={i} className="mb-[2.4cqw] text-justify hyphens-auto">
              {Array.from(
                { length: 5 },
                (_, k) =>
                  SENTENCES[(pdf * 3 + (i * 5 + k) * 7) % SENTENCES.length],
              ).join(' ')}
            </p>
          ))}
          {printed !== undefined && pdf % 5 === 0 && (
            <div className="mt-[3cqw] h-[16cqw] border border-current opacity-40" />
          )}
        </div>
      </div>
    </div>
  );
}
