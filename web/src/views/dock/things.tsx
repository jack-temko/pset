import type { ReactNode } from 'react';
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  ListChecks,
  Presentation,
} from 'lucide-react';

/** What a thing in a course is: a material's kind (D18 of
 *  `ideas/courses-grill.md`), or a set, which is work. */
export type Kind = 'textbook' | 'slides' | 'sheet' | 'exam' | 'set';

/** Something the student can open in the dock. */
export interface Thing {
  id: string;
  kind: Kind;
  title: string;
}

/** A place in a thing. Only a page, for now. A new object each time the
 *  dock is asked, so a thing already showing that page is told again. */
export interface Place {
  page: number;
}

/** The one call the dock gives every view it draws (A6): open another thing
 *  on the left, at a place in it. */
export type OpenThing = (thing: Thing, place?: Place) => void;

export const KIND_ORDER: Kind[] = [
  'textbook',
  'slides',
  'sheet',
  'exam',
  'set',
];

/** The kind as the student says it: singular on a tab, plural over a list. */
export const KIND_WORD: Record<Kind, { one: string; many: string }> = {
  textbook: { one: 'Textbook', many: 'Textbooks' },
  slides: { one: 'Slides', many: 'Slides' },
  sheet: { one: 'Assignment sheet', many: 'Assignment sheets' },
  exam: { one: 'Past exam', many: 'Past exams' },
  set: { one: 'Set', many: 'Sets' },
};

export function kindIcon(kind: Kind): ReactNode {
  switch (kind) {
    case 'textbook':
      return <BookOpen />;
    case 'slides':
      return <Presentation />;
    case 'sheet':
      return <FileText />;
    case 'exam':
      return <ClipboardCheck />;
    case 'set':
      return <ListChecks />;
  }
}

/** The things grouped by kind, in the order a student looks for them, with
 *  empty groups left out. */
export function byKind(things: Thing[]): { kind: Kind; things: Thing[] }[] {
  return KIND_ORDER.map((kind) => ({
    kind,
    things: things.filter((t) => t.kind === kind),
  })).filter((g) => g.things.length > 0);
}
