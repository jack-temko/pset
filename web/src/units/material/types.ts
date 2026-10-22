/** One line of a book's contents: its title, the printed page it starts on
 *  and what is under it. Two levels are shown; deeper ones fold. */
export interface Section {
  title: string;
  /** The printed page it starts on. */
  page: number;
  sections?: readonly Section[];
}

/** A book as the pane reads it: its PDF pages, where the printed numbers
 *  start, and its contents. Pages before the first printed page (a cover, the
 *  front matter) have no printed number. */
export interface Book {
  /** The number of PDF pages. */
  pdfPages: number;
  /** The PDF page that is printed page 1. */
  firstPdf: number;
  /** The last printed page. */
  printedPages: number;
  /** Width over height of a page. */
  aspect: number;
  contents: readonly Section[];
}

/** A rectangle on a page, each side as a share (0 to 1) of the page. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A box drawn on a page, which the pane hands back on Done. */
export interface Box extends Rect {
  /** The PDF page it is on. */
  pdf: number;
}

/** The printed number of a PDF page, or undefined when it has none. */
export function printedOf(book: Book, pdf: number): number | undefined {
  const p = pdf - book.firstPdf + 1;
  return p >= 1 && p <= book.printedPages ? p : undefined;
}

/** The PDF page of a printed page. */
export const pdfOf = (book: Book, printed: number) =>
  printed + book.firstPdf - 1;
