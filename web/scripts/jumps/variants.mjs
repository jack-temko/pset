// Every view's variants, which the audit must open at least once: the manifest
// the views are typed by (Node strips the types). scenarios.mjs tags the
// scenario that shows a variant with `variant: "<view>/<name>"`, and
// variants.test.mjs fails when one has none.
import { VARIANTS } from '../../src/variants.ts';

export { VARIANTS };

/** "view/name" for each variant of the manifest. */
export const variantIds = (manifest = VARIANTS) =>
  Object.entries(manifest).flatMap(([view, names]) =>
    names.map((n) => `${view}/${n}`),
  );
