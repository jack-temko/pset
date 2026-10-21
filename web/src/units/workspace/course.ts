import type { Tab } from './model';

export interface Problem {
  id: string;
  title: string;
  text: string;
  page: number;
}

export interface CourseSet {
  id: string;
  name: string;
  /** The material its problems point into. */
  material: string;
  problems: readonly Problem[];
}

export interface Material {
  id: string;
  name: string;
}

/** What the workspace needs to know of a course. */
export interface Course {
  id: string;
  name: string;
  materials: readonly Material[];
  sets: readonly CourseSet[];
}

export const setOf = (c: Course, id: string) => c.sets.find((s) => s.id === id);
export const materialOf = (c: Course, id: string) =>
  c.materials.find((m) => m.id === id);

/** A tab's label (workspace-d11): a set's name; a material's name and page,
 *  "Griffiths · p. 112"; "Ask". */
export function tabLabel(c: Course, t: Tab): string {
  if (t.kind === 'set') return setOf(c, t.ref)?.name ?? t.ref;
  if (t.kind === 'ask') return 'Ask';
  return `${materialOf(c, t.ref)?.name ?? t.ref} · p. ${String(t.page ?? 1)}`;
}

/** The problem an Ask tab is about, as "Problem 2, Problem set 4". */
export function aboutOf(c: Course, problem: string | undefined) {
  if (!problem) return undefined;
  for (const s of c.sets) {
    const p = s.problems.find((x) => x.id === problem);
    if (p) return `${p.title}, ${s.name}`;
  }
  return undefined;
}
