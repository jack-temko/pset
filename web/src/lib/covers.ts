import type { Cover } from '@/api/library'

export type CoverHue = Cover

/**
 * The six cloth colours, in the engine's order. A book's colour is picked
 * when it's added (the one fewest books wear, seeded by its hash) and kept;
 * the student can change it in the Book dialog. Spec: design/contents.md.
 *
 * The colours themselves are the `--cover-*` tokens in index.css.
 */
export const COVERS: CoverHue[] = ['indigo', 'teal', 'amber', 'rose', 'violet', 'slate']
