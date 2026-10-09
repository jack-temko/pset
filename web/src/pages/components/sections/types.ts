import type { ReactNode } from 'react';

import type { GalleryEntry } from '@/pages/gallery/registry';

/** A section of /components: a gallery entry that draws its specimens. */
export interface ComponentEntry extends GalleryEntry {
  /** The component folders whose README documents it, for the Docs toggle. */
  docs?: string[];
  /** The specimens. No hooks of its own: state lives in a demo component. */
  Demo: () => ReactNode;
}
