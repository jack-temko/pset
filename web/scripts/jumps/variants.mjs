// Every view's variants, which the audit must open at least once. This is a
// copy of web/src/variants.ts (added on branch loading-screens), made so the
// guard can be built before that lands; when it does, this file becomes
// `export { VARIANTS } from '../../src/variants.ts'` (Node strips the types).
// A variant is "<view>/<name>"; scenarios.mjs tags the scenario that shows it
// with `variant`, and variants.test.mjs fails when one has none.
export const VARIANTS = {
  home: ['books', 'empty'],
  book: ['contents', 'no-contents'],
  'homework-set': ['in-progress', 'finished', 'turned-in'],
  ask: ['turns', 'empty'],
  settings: ['key-missing', 'key-present'],
};

/** "view/name" for each variant of the manifest. */
export const variantIds = (manifest = VARIANTS) =>
  Object.entries(manifest).flatMap(([view, names]) =>
    names.map((n) => `${view}/${n}`),
  );
