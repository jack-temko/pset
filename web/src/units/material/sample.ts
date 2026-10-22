import type { Book, Rect, Section } from './types';

const CHAPTERS = [
  'Vector analysis',
  'Electrostatics',
  'Potentials',
  'Electric fields in matter',
  'Magnetostatics',
  'Magnetic fields in matter',
  'Electrodynamics',
  'Conservation laws',
  'Electromagnetic waves',
  'Potentials and fields',
  'Radiation',
  'Electrodynamics and relativity',
];

const SECTIONS = [
  'Introduction',
  'The basic equations',
  'Worked examples',
  'Boundary conditions',
  'Energy and work',
  'Further applications',
];

const DEEPER = ['Review', 'A closer look', 'Special cases'];

/** A contents tree: chapters, sections, and a third level that folds. */
function contents(chapters: number, long?: boolean): Section[] {
  let page = 1;
  return CHAPTERS.slice(0, chapters).map((c, i) => {
    const start = page;
    const sections = SECTIONS.map((s, j): Section => {
      const at = page;
      page += 8;
      return {
        title: `${String(i + 1)}.${String(j + 1)} ${long && j === 1 ? `${s}: ${c.toLowerCase()}, with the problems, the solutions and every figure redrawn for the fourth edition` : s}`,
        page: at,
        sections:
          j % 2 === 0
            ? DEEPER.map((d, k) => ({
                title: `${String(i + 1)}.${String(j + 1)}.${String(k + 1)} ${d}`,
                page: at + k * 2 + 1,
              }))
            : undefined,
      };
    });
    page += 3;
    return {
      title: `Chapter ${String(i + 1)}: ${long && i === 2 ? 'Potentials, boundary-value problems, multipole expansions and the method of images, with applications to conductors' : c}`,
      page: start,
      sections,
    };
  });
}

/** The textbook: 640 printed pages after 12 unnumbered ones (a cover and the
 *  front matter), so PDF page 3 is "PDF 3" and printed page 112 is PDF 124. */
export const GRIFFITHS: Book = {
  pdfPages: 652,
  firstPdf: 13,
  printedPages: 640,
  aspect: 8.5 / 11,
  contents: contents(12),
};

/** A short document: lecture notes or a lab manual. */
export function shortBook(printed: number): Book {
  return {
    pdfPages: printed + 2,
    firstPdf: 3,
    printedPages: printed,
    aspect: 8.5 / 11,
    contents: contents(3).map((c) => ({
      ...c,
      sections: c.sections?.slice(0, 3),
    })),
  };
}

/** The worst book: three thousand pages and long titles in the contents. */
export const HUGE: Book = {
  pdfPages: 3040,
  firstPdf: 41,
  printedPages: 3000,
  aspect: 8.5 / 11,
  contents: contents(12, true),
};

export const NAME = 'Griffiths';

/** A material name at its worst: 90 characters. */
export const LONG_NAME =
  'Introduction to Electrodynamics, fourth edition, by David J. Griffiths, with the solutions manual';

/** The books by the ids the sample course uses. */
export function bookOf(ref: string): Book {
  if (ref === 'notes') return shortBook(80);
  if (ref === 'lab') return shortBook(200);
  return GRIFFITHS;
}

/** The box of a problem on its page, for the sample (a real one is stored). */
export function boxOfProblem(id: string): Rect {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997;
  return { x: 0.1, y: 0.2 + (h % 40) / 100, w: 0.8, h: 0.16 };
}
