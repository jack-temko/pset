import type { Thing } from './things';

/** The sample course. */
export const COURSE = { id: 'c-signals', name: 'Linear systems' };

const t = (id: string, kind: Thing['kind'], title: string): Thing => ({
  id,
  kind,
  title,
});

export const TEXTBOOK = t('m-oppenheim', 'textbook', 'Signals and Systems');
export const SLIDES_7 = t('m-lec-7', 'slides', 'Lecture 7: Fourier series');
export const SLIDES_8 = t(
  'm-lec-8',
  'slides',
  'Lecture 8: The Fourier transform',
);
export const SHEET_4 = t('m-sheet-4', 'sheet', 'Problem set 4 sheet');
export const EXAM = t('m-midterm', 'exam', 'Midterm 2023');
export const SET_4 = t('s-set-4', 'set', 'Problem set 4');
export const SET_5 = t('s-set-5', 'set', 'Problem set 5');

/** A course with a few of each kind. */
export const THINGS: Thing[] = [
  TEXTBOOK,
  SLIDES_7,
  SLIDES_8,
  SHEET_4,
  EXAM,
  SET_4,
  SET_5,
];

/** A course with more than a strip holds: eleven slide decks and the rest. */
export const MANY_THINGS: Thing[] = [
  TEXTBOOK,
  t('m-oppenheim-2', 'textbook', 'Signals and Systems, study guide'),
  ...Array.from({ length: 11 }, (_, i) =>
    t(
      `m-lec-${String(i + 1)}`,
      'slides',
      [
        'Lecture 1: Signals',
        'Lecture 2: Systems',
        'Lecture 3: Convolution',
        'Lecture 4: Differential equations',
        'Lecture 5: Impulse response',
        'Lecture 6: Stability',
        'Lecture 7: Fourier series',
        'Lecture 8: The Fourier transform',
        'Lecture 9: Sampling',
        'Lecture 10: The Laplace transform',
        'Lecture 11: Feedback',
      ][i] ?? 'Lecture',
    ),
  ),
  SHEET_4,
  t('m-sheet-5', 'sheet', 'Problem set 5 sheet'),
  EXAM,
  t('m-final', 'exam', 'Final 2023'),
  SET_4,
  SET_5,
];

/** How many pages a stand-in material has. Short, but each is tall enough
 *  for the whole to scroll. */
export const PAGES = 10;

/** The links inside a material, by page: where the text points to. */
export const MATERIAL_LINKS: Record<
  string,
  Record<number, { to: Thing; page: number; label: string }[]>
> = {
  'm-oppenheim': {
    3: [{ to: SLIDES_7, page: 4, label: 'Lecture 7, page 4' }],
    6: [{ to: EXAM, page: 2, label: 'Midterm 2023, page 2' }],
  },
  'm-lec-7': { 2: [{ to: TEXTBOOK, page: 7, label: 'Textbook, page 7' }] },
  'm-lec-8': { 5: [{ to: TEXTBOOK, page: 9, label: 'Textbook, page 9' }] },
};

/** The problems of a set; each carries a link to a page of a material. */
export const SET_PROBLEMS: Record<
  string,
  {
    label: string;
    text: string;
    link: { to: Thing; page: number; label: string };
  }[]
> = {
  's-set-4': [
    {
      label: '1',
      text: 'Find the Fourier series coefficients of a periodic square wave with period T and duty cycle one half.',
      link: { to: TEXTBOOK, page: 3, label: 'Textbook, page 3' },
    },
    {
      label: '2',
      text: 'A causal LTI system has impulse response h(t) = e^(-2t) u(t). Find its output for x(t) = cos(3t).',
      link: { to: SLIDES_7, page: 5, label: 'Lecture 7, page 5' },
    },
    {
      label: '3',
      text: 'Show that the Fourier transform of a real, even signal is real and even.',
      link: { to: SLIDES_8, page: 2, label: 'Lecture 8, page 2' },
    },
    {
      label: '4',
      text: 'Use the sampling theorem to find the lowest rate that recovers x(t) = sinc(100t) exactly.',
      link: { to: TEXTBOOK, page: 8, label: 'Textbook, page 8' },
    },
  ],
  's-set-5': [
    {
      label: '1',
      text: 'Compute the Laplace transform of t e^(-t) u(t) and state its region of convergence.',
      link: { to: TEXTBOOK, page: 9, label: 'Textbook, page 9' },
    },
    {
      label: '2',
      text: 'Find the poles of H(s) = 1 / (s^2 + 2s + 5) and decide whether the system is stable.',
      link: { to: SLIDES_8, page: 6, label: 'Lecture 8, page 6' },
    },
  ],
};
